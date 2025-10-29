const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');

// Import API modules
const { createVideo } = require('./api/video/create-video');
const { checkStatus } = require('./api/video/check-status');
const { uploadYouTube } = require('./api/youtube/upload-youtube');
const { mergeVideos, listAvailableVideos } = require('./api/video/merge-videos');
// const { createVideoFromYouTube } = require('./api/video/complete-workflow'); // File không tồn tại
const profileAPI = require('./api/profile/profile-management');
const labsAPI = require('./api/labs/labs-management');
const transcriptAPI = require('./api/transcript/transcript-management');
const { vbeeTTS } = require('./api/tts/vbee-tts');
const vibeeTTS = require('./api/tts/vibee-tts');
const storageUtils = require('./api/utils/storage');

// Veo3 Unified APIs
const { splitVideoAPI } = require('./api/video/veo3-video-splitter');
const { analyzeFramesAPI, generateVeo3JSONAPI } = require('./api/video/veo3-frame-analyzer');
// const { veo3UnifiedWorkflowAPI, veo3SimpleWorkflowAPI } = require('./api/video/veo3-unified-workflow'); // File không tồn tại
// const { veo3CompleteWorkflowAPI } = require('./api/video/veo3-complete-workflow'); // File không tồn tại
// const { veo3Parallel32sWorkflowAPI } = require('./api/video/veo3-parallel-32s-workflow'); // File không tồn tại
// const { veo3Sequential32sWorkflowAPI } = require('./api/video/veo3-sequential-32s-workflow'); // File không tồn tại
// const { veo3Optimized32sWorkflowAPI } = require('./api/video/veo3-optimized-32s-workflow'); // File không tồn tại

const app = express();
const PORT = Number(process.env.PORT || 8888);

// Run mode: default or vps (only accept credentials from client HTML)
(() => {
	try {
		const arg = (process.argv || []).find(a => a.startsWith('--mode='));
		if (arg) {
			process.env.RUN_MODE = arg.split('=')[1] || '';
		}
		if (!process.env.RUN_MODE) process.env.RUN_MODE = 'default';
		console.log(`⚙️  Run mode: ${process.env.RUN_MODE}`);
	} catch (_) {
		process.env.RUN_MODE = 'default';
	}
})();

// Middleware
const shouldCompress = (req, res) => {
	// Disable compression for SSE endpoint to prevent buffering
	if (req.path === '/logs/stream') return false;
	return compression.filter(req, res);
};
app.use(compression({ filter: shouldCompress }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
// Serve temp folder for preview/download (read-only)
try {
    const tempPath = path.join(__dirname, 'temp');
    app.use('/temp', express.static(tempPath));
} catch (_) {}

// ===== Realtime log streaming (SSE) =====
const sseClients = new Set();
function broadcastLog(event) {
	try {
		const payload = typeof event === 'string' ? { level: 'info', message: event } : event;
		const line = `data: ${JSON.stringify({ ts: Date.now(), ...payload })}\n\n`;
		for (const res of sseClients) {
			res.write(line);
		}
	} catch (_) {}
}

// Hook console methods to also broadcast to SSE clients
(() => {
	const orig = {
		log: console.log.bind(console),
		warn: console.warn.bind(console),
		error: console.error.bind(console)
	};
	console.log = (...args) => {
		orig.log(...args);
		broadcastLog({ source: 'server', level: 'log', message: args.map(a => (typeof a === 'string' ? a : (a && a.stack) || JSON.stringify(a))).join(' ') });
	};
	console.warn = (...args) => {
		orig.warn(...args);
		broadcastLog({ source: 'server', level: 'warn', message: args.map(a => (typeof a === 'string' ? a : (a && a.stack) || JSON.stringify(a))).join(' ') });
	};
	console.error = (...args) => {
		orig.error(...args);
		broadcastLog({ source: 'server', level: 'error', message: args.map(a => (typeof a === 'string' ? a : (a && a.stack) || JSON.stringify(a))).join(' ') });
	};
})();

// SSE endpoint for clients to subscribe to logs
app.get('/logs/stream', (req, res) => {
	// Keep socket alive indefinitely
	req.socket.setTimeout(0);
	res.set({
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache, no-transform',
		Connection: 'keep-alive',
		'X-Accel-Buffering': 'no' // for nginx (if any)
	});
	res.flushHeaders?.();
	// Client-side automatic retry hint
	res.write('retry: 5000\n');
	res.write(`data: ${JSON.stringify({ ts: Date.now(), level: 'info', message: '📡 Connected to log stream' })}\n\n`);

	// Heartbeat to keep connection alive across proxies
	const heartbeat = setInterval(() => {
		try { res.write(`: keep-alive ${Date.now()}\n\n`); } catch (_) {}
	}, 15000);

	sseClients.add(res);
	req.on('close', () => {
		clearInterval(heartbeat);
		sseClients.delete(res);
	});
});

// Load storage data
let storageData = storageUtils.loadStorageData();

// Auto batch polling
let autoBatchPollingInterval = null;
const AUTO_BATCH_POLLING_INTERVAL = 15000; // 15 seconds

function startAutoBatchPolling() {
    if (autoBatchPollingInterval) {
        clearInterval(autoBatchPollingInterval);
    }
    // Disabled by default; enable only when explicitly requested
    if (String(process.env.ENABLE_AUTO_POLLING || '').toLowerCase() !== 'true') {
        console.log('⏱️ Auto batch polling is disabled');
        return;
    }

    console.log(`⏱️ Auto batch polling enabled (interval ${AUTO_BATCH_POLLING_INTERVAL} ms)`);
    
    autoBatchPollingInterval = setInterval(async () => {
        try {
            const operations = storageData.requestHistory?.filter(req => 
                req.status === 'PENDING' && req.operationName
            ) || [];
            
            if (operations.length > 0) {
                console.log(`⏱️ Auto batch polling ${operations.length} operations...`);
                
                // Check status for all pending operations
                for (const operation of operations) {
                    try {
                        const mockReq = { body: { operationName: operation.operationName, tenantId: operation.tenantId || 'default' } };
                        const mockRes = {
                            json: (data) => {
                                if (data.success && data.videoStatus === 'COMPLETED') {
                                    // Update status in storage
                                    const historyItem = storageData.requestHistory.find(req => 
                                        req.operationName === operation.operationName
                                    );
                                    if (historyItem) {
                                        historyItem.status = 'COMPLETED';
                                        storageUtils.saveStorageData(storageData);
                                    }
                                }
                            },
                            status: () => ({ json: () => {} })
                        };
                        
                        await checkStatus(mockReq, mockRes, storageData);
                    } catch (error) {
                        console.error(`❌ Auto polling error for ${operation.operationName}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Auto batch polling error:', error);
        }
    }, AUTO_BATCH_POLLING_INTERVAL);
}

// ===== API ROUTES =====

// Helper: block Labs browser/cookie endpoints in VPS mode
function blockInVps(req, res, next) {
	if ((process.env.RUN_MODE || 'default').toLowerCase() === 'vps') {
		return res.status(403).json({ success: false, message: 'Endpoint bị vô hiệu hóa trong VPS mode. Hãy nhập Labs Cookies thủ công.' });
	}
	return next();
}

// Utility endpoint: reveal current run mode to UI
app.get('/api/run-mode', (req, res) => {
	res.json({ success: true, runMode: (process.env.RUN_MODE || 'default') });
});

// Logging middleware for all TTS endpoints
app.use('/api/tts', (req, res, next) => {
    const start = Date.now();
    const bodyPreview = (() => {
        try {
            const str = JSON.stringify(req.body || {});
            return str.length > 300 ? str.slice(0, 300) + '…' : str;
        } catch (_) { return '[unserializable]'; }
    })();
    console.log(`🔊 [TTS] -> ${req.method} ${req.originalUrl} body=${bodyPreview}`);
    res.on('finish', () => {
        const ms = Date.now() - start;
        console.log(`🔊 [TTS] <- ${req.method} ${req.originalUrl} status=${res.statusCode} (${ms}ms)`);
    });
    next();
});

// Video Generation APIs
app.post('/api/create-video', (req, res) => createVideo(req, res, storageData));
app.post('/api/check-status', (req, res) => checkStatus(req, res, storageData));

// Video Merge APIs
app.post('/api/merge-videos', mergeVideos);
app.get('/api/merge-videos/list', listAvailableVideos);

// Complete Workflow API
// app.post('/api/create-video-from-youtube', createVideoFromYouTube); // File không tồn tại

// Veo3 Unified APIs
app.post('/api/split-video', splitVideoAPI);
app.post('/api/analyze-frames', analyzeFramesAPI);
app.post('/api/generate-veo3-json', generateVeo3JSONAPI);
// app.post('/api/veo3-unified-workflow', veo3UnifiedWorkflowAPI); // File không tồn tại
// app.post('/api/veo3-simple-workflow', veo3SimpleWorkflowAPI); // File không tồn tại
// app.post('/api/veo3-complete-workflow', veo3CompleteWorkflowAPI); // File không tồn tại
// app.post('/api/veo3-parallel-32s-workflow', veo3Parallel32sWorkflowAPI); // File không tồn tại
// app.post('/api/veo3-sequential-32s-workflow', veo3Sequential32sWorkflowAPI); // File không tồn tại
// app.post('/api/veo3-optimized-32s-workflow', veo3Optimized32sWorkflowAPI); // File không tồn tại

// YouTube Upload API
app.post('/api/upload-youtube', uploadYouTube);

// Profile Management APIs
app.post('/api/create-profile', profileAPI.createProfile);
app.get('/api/list-profiles', profileAPI.listProfiles);
app.get('/api/check-profile/:profileName', profileAPI.checkProfile);
app.post('/api/check-youtube-login', profileAPI.checkYouTubeLogin);
app.post('/api/check-labs-login', profileAPI.checkLabsLogin);
app.post('/api/open-profile-login', profileAPI.openProfileForLogin);
app.post('/api/delete-profile', profileAPI.deleteProfile);
app.post('/api/extract-cookies', profileAPI.extractCookies);
app.post('/api/extract-cookies-all', profileAPI.extractCookiesAll);
app.post('/api/open-clean-chrome-youtube', profileAPI.openCleanChromeForYouTube);
app.post('/api/open-chrome-logged-in', profileAPI.openChromeWithLoggedInProfile);

// Labs Management APIs (blocked in VPS mode)
app.post('/api/open-labs-browser', blockInVps, labsAPI.openLabsBrowser);
app.post('/api/extract-labs-cookies', blockInVps, labsAPI.extractLabsCookies);
app.post('/api/test-labs-cookies', blockInVps, labsAPI.testLabsCookies);
app.post('/api/close-labs-browser', blockInVps, labsAPI.closeLabsBrowser);
app.get('/api/labs-profile-info', blockInVps, labsAPI.getLabsProfileInfo);

// Transcript APIs
app.post('/api/get-transcript', transcriptAPI.getTranscript);
app.post('/api/check-transcript-job', transcriptAPI.checkTranscriptJob);
app.post('/api/get-video-metadata', transcriptAPI.getVideoMetadata);
app.post('/api/translate-transcript', transcriptAPI.translateTranscript);
app.get('/api/list-transcripts', transcriptAPI.listTranscriptFiles);
app.get('/api/get-transcript-file/:filename', transcriptAPI.getTranscriptFile);
app.post('/api/rewrite-transcript', transcriptAPI.rewriteTranscript);
app.post('/api/compare-transcripts', transcriptAPI.compareTranscripts);
app.post('/api/replace-channel-names', transcriptAPI.replaceChannelNames);
app.post('/api/advanced-text-replacement', transcriptAPI.advancedTextReplacement);
app.post('/api/rewrite-with-chatgpt', transcriptAPI.rewriteWithChatGPT);

// TTS (Vibee) APIs
// Vbee TTS endpoint
app.post('/api/vbee-tts', vbeeTTS);

// Unified TTS endpoint (recommended)
app.post('/api/tts', vibeeTTS.unifiedTTS);
// Keep listing for UI convenience
app.get('/api/tts/list-audio', vibeeTTS.listAudio);

// Detailed Vibee TTS endpoints (create/check/get/download/wait)
app.post('/api/tts/create', vibeeTTS.createTTS);
app.post('/api/tts/status', vibeeTTS.checkTTSStatus);
app.post('/api/tts/audio-url', vibeeTTS.getAudioUrl);
app.post('/api/tts/download', vibeeTTS.downloadTTS);
app.post('/api/tts/wait', vibeeTTS.waitUntilReady);

// Utility APIs
app.post('/api/create-mh370-video', async (req, res) => {
    try {
        const { youtubeUrl, openaiApiKey, labsCookies } = req.body || {};
        if (!youtubeUrl) return res.status(400).json({ success: false, message: 'youtubeUrl is required' });
        if ((process.env.RUN_MODE || 'default').toLowerCase() === 'vps') {
            if (!openaiApiKey || typeof openaiApiKey !== 'string' || openaiApiKey.trim().length < 10) {
                return res.status(400).json({ success: false, message: 'VPS mode: Thiếu OpenAI API Key. Gửi openaiApiKey trong body.' });
            }
            if (!labsCookies || typeof labsCookies !== 'string' || labsCookies.trim().length < 10) {
                return res.status(400).json({ success: false, message: 'VPS mode: Thiếu Labs cookies. Gửi labsCookies trong body.' });
            }
        }
        const { spawn } = require('child_process');
        const path = require('path');
        const scriptPath = path.join(__dirname, 'create-mh370-32s-video.js');
        const child = spawn(process.execPath, [scriptPath, `--url=${youtubeUrl}`], {
            cwd: __dirname,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
            windowsHide: true,
            env: {
                ...process.env,
                ...(openaiApiKey ? { OPENAI_API_KEY: openaiApiKey } : {}),
                ...(labsCookies ? { LABS_COOKIES: labsCookies } : {})
            }
        });
        // Forward child stdout/stderr to SSE logs
        if (child.stdout) child.stdout.on('data', (d) => {
            try { process.stdout.write(d); } catch (_) {}
            try { broadcastLog({ source: 'mh370', level: 'log', message: String(d).trimEnd() }); } catch (_) {}
        });
        if (child.stderr) child.stderr.on('data', (d) => {
            try { process.stderr.write(d); } catch (_) {}
            try { broadcastLog({ source: 'mh370', level: 'error', message: String(d).trimEnd() }); } catch (_) {}
        });
        child.on('close', (code) => {
            try { broadcastLog({ source: 'mh370', level: 'info', message: `MH370 process exited with code ${code}` }); } catch (_) {}
        });
        res.json({ success: true, message: 'Job started', pid: child.pid });
    } catch (error) {
        console.error('❌ start MH370 job error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
app.get('/api/token-status', (req, res) => {
    try {
        const tokenStatus = storageUtils.getTokenStatus(storageData);
        res.json({
            success: true,
            ...tokenStatus,
            hasCookies: !!storageData.currentCookies,
            currentOperationName: storageData.currentOperationName
        });
    } catch (error) {
        console.error('❌ Token status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get token status',
            error: error.message
        });
    }
});

app.get('/api/list-videos', (req, res) => {
    try {
        const result = storageUtils.listVideos();
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('❌ List videos error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list videos',
            error: error.message
        });
    }
});

// List temp folder structure (top-level subdirectories and their files)
app.get('/api/list-temp', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const tempRoot = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempRoot)) {
            return res.json({ success: true, root: '/temp', entries: [], count: 0 });
        }
        const entries = [];
        const dirs = fs.readdirSync(tempRoot).filter(name => {
            try { return fs.statSync(path.join(tempRoot, name)).isDirectory(); } catch { return false; }
        });
        for (const dir of dirs) {
            const dirPath = path.join(tempRoot, dir);
            let files = [];
            try {
                files = fs.readdirSync(dirPath).filter(f => {
                    try { return fs.statSync(path.join(dirPath, f)).isFile(); } catch { return false; }
                }).map(f => {
                    const p = path.join(dirPath, f);
                    const st = fs.statSync(p);
                    return {
                        name: f,
                        sizeMB: Math.max(0, (st.size || 0) / (1024 * 1024)).toFixed(2),
                        mtimeMs: st.mtimeMs,
                        publicPath: `/temp/${encodeURIComponent(dir)}/${encodeURIComponent(f)}`
                    };
                }).sort((a,b)=> b.mtimeMs - a.mtimeMs);
            } catch (_) {}
            entries.push({ dir, count: files.length, files });
        }
        res.json({ success: true, root: '/temp', entries, count: entries.length });
    } catch (error) {
        console.error('❌ List temp error:', error);
        res.status(500).json({ success: false, message: 'Failed to list temp', error: error.message });
    }
});

app.get('/api/history', (req, res) => {
    try {
        const tenantId = (req.query && req.query.tenantId) ? String(req.query.tenantId) : null;
        const result = storageUtils.getHistory(storageData, tenantId);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('❌ Get history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get history',
            error: error.message
        });
    }
});

app.delete('/api/history', (req, res) => {
    try {
        const tenantId = (req.body && req.body.tenantId) ? String(req.body.tenantId) : null;
        const result = storageUtils.clearHistory(storageData, tenantId);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('❌ Clear history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear history',
            error: error.message
        });
    }
});

// ===== SERVER STARTUP =====

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`📝 API endpoints:`);
    console.log(`   POST /api/create-video - Tạo video từ text`);
    console.log(`   POST /api/check-status - Kiểm tra trạng thái video`);
    console.log(`   POST /api/upload-youtube - Upload video lên YouTube`);
    console.log(`   POST /api/create-profile - Tạo Chrome profile mới`);
    console.log(`   GET  /api/list-profiles - Liệt kê Chrome profiles`);
    console.log(`   POST /api/check-youtube-login - Kiểm tra đăng nhập YouTube`);
    console.log(`   POST /api/check-labs-login - Kiểm tra đăng nhập Google Labs`);
    console.log(`   POST /api/open-profile-login - Mở profile để đăng nhập`);
    console.log(`   POST /api/delete-profile - Xóa Chrome profile`);
    console.log(`   GET  /api/list-videos - Liệt kê video files`);
    console.log(`   POST /api/split-video - Tách video thành các đoạn 8s`);
    console.log(`   POST /api/analyze-frames - Phân tích frames với ChatGPT`);
    console.log(`   POST /api/generate-veo3-json - Tạo JSON format cho Veo3`);
    console.log(`   POST /api/veo3-unified-workflow - Workflow thống nhất Veo3`);
    console.log(`   POST /api/veo3-simple-workflow - Workflow đơn giản Veo3`);
    console.log(`   POST /api/veo3-complete-workflow - Workflow hoàn chỉnh: Video → Phân tích → ChatGPT → Veo3`);
    console.log(`   POST /api/veo3-parallel-32s-workflow - Workflow 32s song song: 4 đoạn 8s → Ghép lại`);
    console.log(`   POST /api/veo3-sequential-32s-workflow - Workflow 32s TUẦN TỰ: 4 đoạn 8s → Ghép lại`);
    console.log(`   POST /api/veo3-optimized-32s-workflow - Workflow 32s TỐI ƯU: Gửi Veo3 → Tiếp tục xử lý`);
    console.log(`   GET  /api/history - Xem lịch sử requests`);
    console.log(`   DELETE /api/history - Xóa lịch sử`);
    console.log(`   GET  /api/token-status - Kiểm tra trạng thái token`);
    console.log(`   POST /api/extract-cookies - Tự động lấy cookies từ profile`);
    console.log(`   POST /api/extract-cookies-all - Lấy cookies từ tất cả profiles`);
    console.log(`   POST /api/open-labs-browser - Mở Chrome Labs riêng biệt`);
    console.log(`   POST /api/extract-labs-cookies - Lấy cookies từ Labs browser`);
    console.log(`   POST /api/test-labs-cookies - Test Labs cookies`);
    console.log(`   POST /api/close-labs-browser - Đóng Labs browser`);
    console.log(`   GET  /api/labs-profile-info - Thông tin Labs profile`);
    console.log(`   POST /api/get-transcript - Lấy lời thoại video YouTube`);
    console.log(`   POST /api/check-transcript-job - Kiểm tra trạng thái job transcript`);
    console.log(`   POST /api/get-video-metadata - Lấy metadata video YouTube`);
    console.log(`   POST /api/translate-transcript - Dịch lời thoại video`);
    console.log(`   GET  /api/list-transcripts - Liệt kê file transcript đã lưu`);
    console.log(`   GET  /api/get-transcript-file/:filename - Đọc nội dung file transcript`);
    console.log(`   POST /api/rewrite-transcript - Viết lại transcript bằng ChatGPT`);
    console.log(`   POST /api/compare-transcripts - So sánh transcript gốc và đã viết lại`);
    console.log(`   POST /api/replace-channel-names - Thay đổi tên kênh trong transcript`);
    console.log(`   POST /api/advanced-text-replacement - Thay thế text nâng cao với nhiều pattern`);
    console.log(`   POST /api/rewrite-with-chatgpt - Viết lại transcript bằng ChatGPT (tối ưu 15% thay đổi)`);
    console.log(`   POST /api/tts - TTS thống nhất (tạo + chờ + tải)`);
    console.log(`   GET  /api/tts/list-audio - Liệt kê MP3 đã lưu`);
    console.log(`   POST /api/tts/create - Tạo job TTS (Vibee)`);
    console.log(`   POST /api/tts/status - Kiểm tra trạng thái job TTS`);
    console.log(`   POST /api/tts/audio-url - Lấy audioUrl khi sẵn sàng`);
    console.log(`   POST /api/tts/download - Tải MP3 về thư mục public/audio`);
    console.log(`   POST /api/tts/wait - Đợi đến khi có audioUrl (polling)`);
    console.log(`   POST /api/merge-videos - Ghép video ngẫu nhiên theo thời gian`);
    console.log(`   GET  /api/merge-videos/list - Liệt kê video có sẵn để ghép`);
    console.log(`   POST /api/create-video-from-youtube - Workflow hoàn chỉnh: YouTube → ChatGPT → TTS → Video`);
    console.log(`   POST /api/extract-frames - Extract frames từ video`);
    console.log(`   POST /api/analyze-video - Phân tích video với ChatGPT`);
    console.log(`   POST /api/create-veo3-videos - Tạo video Veo3 từ prompts`);
    console.log(`   POST /api/veo3-hybrid-workflow - Workflow Veo3 Hybrid hoàn chỉnh`);
    console.log(`   POST /api/analyze-second-by-second - Phân tích chi tiết từng giây`);
    console.log(`   POST /api/generate-veo3-format - Tạo format JSON cho Veo3 API`);
    console.log(`   POST /api/generate-veo3-timeline - Tạo timeline JSON cho Veo3`);
    console.log(`   POST /api/create-veo3-complete-video - Tạo video hoàn chỉnh 2 phút từ video gốc`);
    console.log(`   POST /api/create-simple-8s-video - Tạo video 8s đơn giản`);
    
    // Auto batch polling not started by default
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down server...');
    if (autoBatchPollingInterval) {
        clearInterval(autoBatchPollingInterval);
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down server...');
    if (autoBatchPollingInterval) {
        clearInterval(autoBatchPollingInterval);
    }
    process.exit(0);
});
