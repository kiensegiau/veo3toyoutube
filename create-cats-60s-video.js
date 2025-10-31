const fetch = require('node-fetch');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

// Load environment variables from .env if available (non-fatal if missing)
try {
    const dotenvPath = path.join(__dirname, '.env');
    if (fs.existsSync(dotenvPath)) {
        require('dotenv').config({ path: dotenvPath, override: true });
        console.log('🧩 Đã nạp biến môi trường từ .env');
    }
} catch (_) {}

const execAsync = promisify(exec);

// ChatGPT/Veo environment variables (đọc từ ENV hoặc .env)
const OPENAI_API_KEY = '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';
const LABS_COOKIES = (process.env.LABS_COOKIES || '').trim();
const RUN_MODE = (process.env.RUN_MODE || 'default').toLowerCase();
const VEO_PROJECT_ID = (process.env.VEO_PROJECT_ID || '').trim();

// Networking helpers for resilient OpenAI calls
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
async function fetchOpenAIWithRetry(payload, { maxRetries = 7, baseDelayMs = 1500 } = {}){
    let attempt = 0;
    while (true){
        attempt++;
        const controller = new AbortController();
        const timeout = setTimeout(()=> controller.abort(), 90000);
        try{
            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                agent: keepAliveAgent,
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (resp.ok){ return await resp.json(); }
            const status = resp.status;
            const text = await resp.text().catch(()=> '');
            if ((status === 429 || status >= 500) && attempt <= maxRetries){
                const retryAfter = Number(resp.headers.get('retry-after') || 0) * 1000;
                const backoff = retryAfter || Math.min(30000, baseDelayMs * Math.pow(2, attempt-1));
                console.log(`⚠️  OpenAI HTTP ${status}. Retry in ${Math.round(backoff/1000)}s (attempt ${attempt}/${maxRetries})`);
                await sleep(backoff + Math.floor(Math.random()*400));
                continue;
            }
            throw new Error(`OpenAI HTTP ${status}: ${text}`);
        }catch(err){
            clearTimeout(timeout);
            const msg = String(err && err.message || err);
            const transient = /ECONNRESET|ETIMEDOUT|socket hang up|network|aborted|timeout/i.test(msg);
            if (transient && attempt <= maxRetries){
                const backoff = Math.min(30000, baseDelayMs * Math.pow(2, attempt-1));
                console.log(`⚠️  OpenAI transient error: ${msg}. Retry in ${Math.round(backoff/1000)}s (attempt ${attempt}/${maxRetries})`);
                await sleep(backoff + Math.floor(Math.random()*400));
                continue;
            }
            throw err;
        }
    }
}

// Video Configuration (60s total)
const SEGMENT_DURATION = 6; // seconds per segment
const NUM_SEGMENTS = 10; // 10 x 6s = 60s
const BATCH_SIZE = 10; // xử lý 1 batch

// Cache cookie để tránh lấy liên tục
let cachedCookie = null;
let cookieCacheTime = 0;
const COOKIE_CACHE_DURATION = 30 * 60 * 1000; // 30 phút

function readCookieFromFile() {
    try {
        const cookieFilePath = path.join(__dirname, 'labs-cookies.txt');
        if (!fs.existsSync(cookieFilePath)) {
            console.log('❌ File labs-cookies.txt không tồn tại');
            return null;
        }
        const content = fs.readFileSync(cookieFilePath, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() && !line.startsWith('#')) {
                console.log(`✅ Đọc cookie từ file labs-cookies.txt`);
                return line.trim();
            }
        }
        console.log('❌ Không tìm thấy cookies trong file');
        return null;
    } catch (error) {
        console.error('❌ Lỗi đọc cookie từ file:', error.message);
        return null;
    }
}

async function getCachedOrFreshCookie(serverUrl) {
    const now = Date.now();
    if (RUN_MODE === 'vps') {
        if (LABS_COOKIES) {
            cachedCookie = LABS_COOKIES;
            cookieCacheTime = now;
            console.log('🍪 [VPS] Dùng Labs cookies từ ENV (LABS_COOKIES)');
            return cachedCookie;
        }
        console.log('❌ [VPS] Thiếu LABS_COOKIES trong env. Không được phép đọc file hay gọi server.');
        return null;
    }
    if (cachedCookie && (now - cookieCacheTime) < COOKIE_CACHE_DURATION) {
        console.log(`🍪 Sử dụng cached cookie`);
        return cachedCookie;
    }
    console.log(`🔄 Lấy cookie mới từ server...`);
    try {
        const response = await fetch(`${serverUrl}/api/labs/get-cookies`, { method: 'GET' });
        const result = await response.json();
        if (result.success && result.cookies) {
            cachedCookie = result.cookies;
            cookieCacheTime = now;
            console.log(`✅ Đã cache cookie mới từ server`);
            return cachedCookie;
        } else {
            throw new Error('Không lấy được cookie từ server');
        }
    } catch (error) {
        console.error(`❌ Lỗi lấy cookie từ server:`, error.message);
        console.log(`🔄 Thử lấy cookie từ file labs-cookies.txt...`);
        if (RUN_MODE !== 'vps') {
            const cookieFromFile = readCookieFromFile();
            if (cookieFromFile) {
                cachedCookie = cookieFromFile;
                cookieCacheTime = now;
                console.log(`✅ Sử dụng cookie từ file labs-cookies.txt`);
                return cachedCookie;
            }
        }
        console.error(`❌ Không thể lấy cookie (server/file bị cấm trong VPS hoặc không có)`);
        return null;
    }
}

async function createCatFamilyVideo60s(){
    try {
        const serverUrl = 'http://localhost:8888';
        const outputDir = `./temp/cat-family-60s-video`;
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Step 0: Sinh kịch bản ngẫu nhiên về gia đình mèo (đồng bộ nhân vật)
        console.log('📖 [Step 0] Sinh kịch bản gia đình mèo (ngẫu nhiên, đồng bộ nhân vật)...');
        const storyResult = await fetchOpenAIWithRetry({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Bạn là biên kịch dựng cảnh cho video 60 giây về gia đình mèo.

YÊU CẦU BẮT BUỘC:
- Nhân vật xuyên suốt: mèo bố, mèo mẹ, mèo con (đặt tên, tính cách nhất quán)
- Không có chữ/text overlay, không voice-over, chỉ visual và âm thanh nền tự nhiên/nhạc nền.
- Phong cách, bảng màu, không khí nhất quán toàn video.

Trả về JSON duy nhất:
{
  "overallTheme": string,
  "colorScheme": string,
  "visualStyle": string,
  "characters": {
    "father": { "name": string, "traits": string },
    "mother": { "name": string, "traits": string },
    "kitten": { "name": string, "traits": string }
  },
  "setting": string,
  "segments": [
    { "index": 1, "timeRange": "0-6s",   "focus": string, "prompt": string },
    { "index": 2, "timeRange": "6-12s",  "focus": string, "prompt": string },
    { "index": 3, "timeRange": "12-18s", "focus": string, "prompt": string },
    { "index": 4, "timeRange": "18-24s", "focus": string, "prompt": string },
    { "index": 5, "timeRange": "24-30s", "focus": string, "prompt": string },
    { "index": 6, "timeRange": "30-36s", "focus": string, "prompt": string },
    { "index": 7, "timeRange": "36-42s", "focus": string, "prompt": string },
    { "index": 8, "timeRange": "42-48s", "focus": string, "prompt": string },
    { "index": 9, "timeRange": "48-54s", "focus": string, "prompt": string },
    { "index": 10, "timeRange": "54-60s", "focus": string, "prompt": string }
  ]
}

QUY TẮC PROMPT TỪNG SEGMENT:
- Giữ đúng nhân vật (tên), bối cảnh, màu sắc, phong cách.
- Cấm mọi chữ/tiêu đề/subtitle/watermark. Không thoại/voice.
- Chỉ mô tả hình ảnh, hành động, cảm xúc bằng visual.
`
                },
                {
                    role: 'user',
                    content: 'Tạo một câu chuyện gia đình mèo ấm áp, dễ thương, nhịp điệu nhẹ nhàng trong 60 giây.'
                }
            ],
            max_tokens: 4000,
            temperature: 0.9
        });
        if (!storyResult.choices) throw new Error('Không sinh được kịch bản');
        const storyText = storyResult.choices[0].message.content;
        const storyJsonMatch = storyText.match(/\{[\s\S]*\}/);
        if (!storyJsonMatch) throw new Error('Kịch bản trả về không phải JSON');
        const story = JSON.parse(storyJsonMatch[0]);

        const analysis = {
            overallTheme: story.overallTheme,
            colorScheme: story.colorScheme,
            visualStyle: story.visualStyle,
            segments: story.segments
        };

        console.log(`✅ [Step 0] Chủ đề: ${analysis.overallTheme}`);
        console.log(`✅ [Step 0] Màu sắc: ${analysis.colorScheme}`);
        console.log(`✅ [Step 0] Phong cách: ${analysis.visualStyle}`);

        // Chuẩn bị cookie sớm
        console.log('🍪 [Step 1] Lấy/cache cookie trước khi tạo videos...');
        await getCachedOrFreshCookie(serverUrl);

        // Step 2: Tối ưu prompt từng segment (JSON chi tiết 0-2,2-4,4-6)
        console.log('🤖 [Step 2] Tối ưu prompts cho Veo3...');
        const veo3Results = [];
        const earlyMonitorPromises = [];
        const CONCURRENCY = 5;

        async function monitorAndDownload(veo3Result, opts = {}){
            const { startDelayMs = 0, pollEveryMs = 5000, maxAttempts = 60 } = opts;
            let operationId = veo3Result.operationId;
            let recreateAttempts = 0;
            const maxRecreate = 2;
            const promptForRecreate = veo3Result.optimizedPrompt || veo3Result.originalPrompt || '';
            if (startDelayMs > 0) { await sleep(startDelayMs); }
            console.log(`🔄 [Monitor] Start op=${operationId} seg=${veo3Result.segmentIndex + 1}`);
            let attempts = 0;
            while (attempts < maxAttempts) {
                try {
                    const statusResponse = await fetch(`${serverUrl}/api/check-status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            operationName: operationId,
                            noRemove: true,
                            ...(LABS_COOKIES ? { labsCookies: LABS_COOKIES } : {})
                        })
                    });
                    const statusResult = await statusResponse.json();
                    if (statusResult.success && statusResult.videoStatus === 'COMPLETED' && statusResult.videoUrl) {
                        const downloadResponse = await fetch(`${serverUrl}/api/tts/download`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ audioUrl: statusResult.videoUrl, filename: `cat_segment_${veo3Result.segmentIndex}_${Date.now()}.mp4` })
                        });
                        const downloadResult = await downloadResponse.json();
                        if (downloadResult.success) {
                            const videoPath = downloadResult.savedTo || downloadResult.outPath || downloadResult.path;
                            return { success: true, segmentIndex: veo3Result.segmentIndex, path: videoPath, publicPath: downloadResult.publicPath, filename: downloadResult.filename, operationId };
                        }
                        return { success: false, segmentIndex: veo3Result.segmentIndex, error: 'Download failed' };
                    } else if (statusResult.success && statusResult.videoStatus === 'PENDING') {
                        attempts++;
                        await sleep(pollEveryMs);
                    } else {
                        if (recreateAttempts < maxRecreate && promptForRecreate) {
                            recreateAttempts++;
                            try {
                                const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ input: promptForRecreate, prompt: promptForRecreate, ...(LABS_COOKIES ? { labsCookies: LABS_COOKIES } : {}) })
                                });
                                const veo3Json = await veo3Response.json();
                                if (veo3Json && veo3Json.success && veo3Json.operationName) {
                                    operationId = veo3Json.operationName; attempts = 0; continue;
                                }
                            } catch (_) {}
                        }
                        return { success: false, segmentIndex: veo3Result.segmentIndex, error: 'Operation failed' };
                    }
                } catch (e) {
                    attempts++;
                    await sleep(pollEveryMs);
                }
            }
            return { success: false, segmentIndex: veo3Result.segmentIndex, error: 'Timeout' };
        }

        async function processOneSegment(index) {
            const segment = analysis.segments[index];
            console.log(`🎬 [Step 2] Segment ${index + 1}: ${segment.timeRange} | ${segment.focus}`);
            try {
                const prevSegment = index > 0 ? analysis.segments[index - 1] : null;
                const nextSegment = index < analysis.segments.length - 1 ? analysis.segments[index + 1] : null;

                const optimizeResult = await fetchOpenAIWithRetry({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `Bạn tối ưu prompt Veo 3.1 cho video 6 giây.

Trả về MỘT JSON ARRAY 3 phần tử (0-2s,2-4s,4-6s). Không thêm giải thích:
[
  {
    "timeStart": 0,
    "timeEnd": 2,
    "action": "Mô tả hành động visual (KHÔNG CHỮ, KHÔNG VOICE)",
    "cameraStyle": "zoom/pan/tilt/steady...",
    "transition": "fade/dissolve/cut/...",
    "soundFocus": "ambient sounds/background music (NO voice-over/speech/dialogue)",
    "visualDetails": "màu sắc, ánh sáng, texture, style"
  },
  ...
]
YÊU CẦU: không text overlay, không narration/voice, giữ nguyên nội dung prompt gốc, nhấn mạnh chủ đề toàn cục.`
                        },
                        {
                            role: 'user',
                            content: `Chủ đề: ${analysis.overallTheme}\nMàu sắc: ${analysis.colorScheme}\nPhong cách: ${analysis.visualStyle}\nSegment ${index + 1}/${analysis.segments.length}: ${segment.timeRange}\nFocus: ${segment.focus}\nOriginal prompt: ${segment.prompt}\n${prevSegment ? `Segment trước: ${prevSegment.timeRange} - ${prevSegment.focus}` : 'Đầu video: dùng fade in'}\n${nextSegment ? `Segment sau: ${nextSegment.timeRange} - ${nextSegment.focus}` : 'Cuối video: dùng fade out'}`
                        }
                    ],
                    max_tokens: 1200,
                    temperature: 0.35
                });
                if (!optimizeResult.choices) throw new Error('ChatGPT optimization failed');
                const optimizedContent = optimizeResult.choices[0].message.content.trim();
                let detailedTimeline = null;
                try {
                    const jsonMatch = optimizedContent.match(/\[[\s\S]*\]/);
                    if (jsonMatch) detailedTimeline = JSON.parse(jsonMatch[0]);
                } catch (_) {}

                let optimizedPrompt;
                if (detailedTimeline && Array.isArray(detailedTimeline)) {
                    const themeContext = `[CONTEXT: ${analysis.overallTheme}. Style: ${analysis.visualStyle}. Colors: ${analysis.colorScheme}] `;
                    const scenesDescription = detailedTimeline.map(scene => {
                        const transitionText = scene.transition ? `Transition: ${scene.transition}.` : '';
                        const soundText = scene.soundFocus ? scene.soundFocus.replace(/voice-over|voice over|narration|dialogue|speech|talking|speaking|narrator|human voice/gi, 'ambient sound') : 'ambient sound';
                        return `[${scene.timeStart}-${scene.timeEnd}s] ${transitionText} ${scene.action}. Camera: ${scene.cameraStyle}. Visual: ${scene.visualDetails}. Sound: ${soundText} (NO voice-over, NO speech, NO dialogue).`;
                    }).join(' ');
                    optimizedPrompt = themeContext + scenesDescription + ' [IMPORTANT: NO voice-over, NO narration, NO dialogue, NO speech, NO human voice in the entire video. Only visual content with ambient sounds/background music.]';
                } else {
                    optimizedPrompt = `${segment.prompt} [IMPORTANT: NO voice-over, NO narration, NO dialogue, NO speech, NO human voice. Only visual content with ambient sounds/background music.]`;
                }

                // Gọi tạo video
                let veo3Result = null;
                let retryCount = 0;
                const maxRetries = 8;
                while (retryCount < maxRetries) {
                    try {
                        const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                input: optimizedPrompt,
                                prompt: optimizedPrompt,
                                ...(LABS_COOKIES ? { labsCookies: LABS_COOKIES } : {}),
                                ...(VEO_PROJECT_ID ? { projectId: VEO_PROJECT_ID } : {})
                            })
                        });
                        veo3Result = await veo3Response.json();
                        if (veo3Result.success) break;
                        throw new Error(veo3Result.message || 'Create video failed');
                    } catch (error) {
                        retryCount++;
                        console.log(`⚠️  Segment ${index + 1} retry ${retryCount}/${maxRetries}: ${error.message}`);
                        if (retryCount < maxRetries) {
                            const waitTime = Math.pow(2, retryCount) * 1500;
                            await sleep(waitTime);
                            if (String(error.message).includes('cookie')) {
                                cachedCookie = null;
                                await getCachedOrFreshCookie(serverUrl);
                            }
                        }
                    }
                }

                if (veo3Result && veo3Result.success) {
                    const resultObj = {
                        segmentIndex: index,
                        timeRange: segment.timeRange,
                        focus: segment.focus,
                        originalPrompt: segment.prompt,
                        detailedTimeline: detailedTimeline,
                        optimizedPrompt: optimizedPrompt,
                        operationId: veo3Result.operationName,
                        success: true
                    };
                    earlyMonitorPromises.push(monitorAndDownload(resultObj, { startDelayMs: 45000, pollEveryMs: 8000, maxAttempts: 40 }));
                    return resultObj;
                }

                return { segmentIndex: index, timeRange: segment.timeRange, error: 'Failed after retries', success: false };
            } catch (error) {
                return { segmentIndex: index, timeRange: segment.timeRange, error: error.message, success: false };
            }
        }

        for (let start = 0; start < analysis.segments.length; start += CONCURRENCY) {
            const end = Math.min(start + CONCURRENCY, analysis.segments.length);
            const indexes = Array.from({ length: end - start }, (_, i) => start + i);
            const tasks = indexes.map((idx, offset) => (async () => {
                if (offset > 0) await sleep(200 * offset);
                return await processOneSegment(idx);
            })());
            const batchResults = await Promise.all(tasks);
            veo3Results.push(...batchResults);
            if (end < analysis.segments.length) await sleep(800);
        }

        const promptsSavePath = path.join(outputDir, 'veo-optimized-prompts.json');
        fs.writeFileSync(promptsSavePath, JSON.stringify(veo3Results.map(r => ({
            segmentIndex: r.segmentIndex,
            timeRange: r.timeRange,
            originalPrompt: r.originalPrompt,
            optimizedPrompt: r.optimizedPrompt,
            detailedTimeline: r.detailedTimeline ?? null,
            success: r.success,
            error: r.error ?? null
        })), null, 2), 'utf8');
        console.log(`✅ [Step 2] Đã lưu optimized prompts: ${promptsSavePath}`);

        const successfulOperations = veo3Results.filter(r => r.success);
        console.log(`🚀 Đã gửi ${successfulOperations.length}/${analysis.segments.length} yêu cầu Veo3`);

        // Step 3: Monitor và tải video
        console.log('🔄 [Step 3] Theo dõi và tải video...');
        let videoFiles = [];
        if (earlyMonitorPromises.length > 0) {
            videoFiles = await Promise.all(earlyMonitorPromises);
        }
        const successfulVideos = videoFiles.filter(v => v.success);
        console.log(`✅ [Step 3] Đã tải ${successfulVideos.length}/${successfulOperations.length} video`);

        // Step 4: Ghép video
        if (successfulVideos.length === 0) throw new Error('Không có video nào được tải về để ghép');
        successfulVideos.sort((a, b) => a.segmentIndex - b.segmentIndex);
        const validVideoFiles = successfulVideos.filter(v => v.path && fs.existsSync(v.path));
        if (validVideoFiles.length === 0) throw new Error('Không có file video hợp lệ');

        const listPath = path.join(outputDir, 'video_list.txt');
        const listContent = validVideoFiles.map(video => {
            const absolutePath = path.resolve(video.path);
            const normalizedPath = absolutePath.replace(/\\/g, '/');
            return `file '${normalizedPath}'`;
        }).join('\n');
        fs.writeFileSync(listPath, listContent, 'utf8');

        const finalVideoPath = path.join(outputDir, `cat_family_60s_final_${Date.now()}.mp4`);
        const mergeCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${finalVideoPath}"`;
        await execAsync(mergeCmd);
        console.log(`🎉 Đã ghép video: ${finalVideoPath}`);

        const resultPath = path.join(outputDir, `cat-family-60s-result.json`);
        const finalResult = {
            timestamp: new Date().toISOString(),
            overallTheme: analysis.overallTheme,
            colorScheme: analysis.colorScheme,
            visualStyle: analysis.visualStyle,
            segmentsCreated: analysis.segments.length,
            veo3OperationsSent: successfulOperations.length,
            videosDownloaded: successfulVideos.length,
            finalVideo: finalVideoPath,
            segments: analysis.segments,
            veo3Results: veo3Results,
            videoFiles: successfulVideos,
            outputDir: outputDir
        };
        fs.writeFileSync(resultPath, JSON.stringify(finalResult, null, 2));
        console.log(`📊 Lưu kết quả: ${resultPath}`);

        return { success: true, result: finalResult };
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        return { success: false, error: error.message };
    }
}

console.log('🚀 [START] Tạo video 60s: Gia đình mèo (visual-only, không thoại/không chữ)...');
createCatFamilyVideo60s().then(result => {
    if (result.success) {
        console.log('🎉 Hoàn thành thành công!');
        console.log(`🎉 Video: ${result.result.finalVideo}`);
    } else {
        console.log(`❌ Thất bại: ${result.error}`);
    }
});


