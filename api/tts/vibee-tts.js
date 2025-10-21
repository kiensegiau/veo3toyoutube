const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Vibee TTS API base (from Postman doc)
const VIBEE_BASE_URL = process.env.VIBEE_BASE_URL || 'https://vbee.vn/api';
const VIBEE_API_KEY = process.env.VIBEE_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjA4NjgwOTV9.hYH_gbcJWbT2RCnk1omaLI5dzCZ46DOnZnnO62wirao';
const VIBEE_APP_ID = process.env.VIBEE_APP_ID || '3907419d-0d78-46d8-857c-5a6fe6b17b89';

function ensureAudioDir() {
    const audioDir = path.join(__dirname, '../../public/audio');
    if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
    }
    return audioDir;
}

function extractAudioUrlLike(resultObj) {
    if (!resultObj || typeof resultObj !== 'object') return null;
    const candidates = [
        resultObj.audio_url,
        resultObj.audio_link,
        resultObj.url,
        resultObj.download_url,
        resultObj.audioUrl,
        resultObj.downloadUrl,
        resultObj.file,
        resultObj.link
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c.startsWith('http')) return c;
    }
    // Nested common containers
    if (resultObj.urls && typeof resultObj.urls === 'object') {
        const nested = extractAudioUrlLike(resultObj.urls);
        if (nested) return nested;
    }
    if (Array.isArray(resultObj.files)) {
        const f = resultObj.files.find(x => typeof x === 'string' && x.startsWith('http'));
        if (f) return f;
    }
    if (Array.isArray(resultObj.audio_paths)) {
        const f = resultObj.audio_paths.find(x => typeof x === 'string' && x.startsWith('http'));
        if (f) return f;
    }
    return null;
}

async function createTTS(req, res) {
    try {
        const body = req.body || {};
        console.log('🔊 [createTTS] incoming body:', {
            keys: Object.keys(body || {}),
            textPreview: typeof body.text === 'string' ? body.text.slice(0, 80) : undefined,
            voice: body.voice || body.voice_code,
            format: body.format || body.audio_type,
            responseType: body.responseType || body.response_type
        });
        // Normalize inputs: accept both camelCase (preferred) and snake_case (backward compat)
        const text = body.text ?? body.input_text;
        const voice = body.voice ?? body.voice_code ?? 'hn_female_miu_mini';
        const speed = body.speed ?? body.speed_rate ?? 1.0;
        const format = body.format ?? body.audio_type ?? 'mp3';
        const sampleRate = body.sampleRate ?? body.sample_rate ?? 44100;
        const appId = body.appId ?? body.app_id ?? VIBEE_APP_ID;
        const responseType = body.responseType ?? body.response_type; // e.g. 'indirect'
        const callbackUrl = body.callbackUrl ?? body.callback_url;
        const bitrate = typeof body.bitrate === 'number' ? body.bitrate : undefined;

        if (!VIBEE_API_KEY) {
            return res.status(400).json({ success: false, message: 'Missing VIBEE_API_KEY env' });
        }

        // Require callback_url if response_type is indirect per Vibee API
        if (responseType === 'indirect' && !callbackUrl) {
            return res.status(400).json({ success: false, message: 'callback_url is required when response_type is indirect' });
        }

        const payload = {
            app_id: appId || undefined,
            response_type: responseType || undefined,
            callback_url: callbackUrl || undefined,
            input_text: text,
            voice_code: voice,
            audio_type: format,
            bitrate: bitrate,
            speed_rate: typeof speed === 'number' ? String(speed) : speed,
            sample_rate: sampleRate
        };

        if (!payload.input_text || typeof payload.input_text !== 'string' || payload.input_text.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'input_text/text is required' });
        }

        // Create TTS job per Vibee TTS API
        const resp = await fetch(`${VIBEE_BASE_URL}/v1/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Bearer ${VIBEE_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const data = await resp.json().catch(() => ({}));
        console.log('🔊 [createTTS] Vibee response status:', resp.status, 'keys:', Object.keys(data || {}));
        
        if (!resp.ok) {
            return res.status(resp.status).json({ 
                success: false, 
                message: 'Vibee create failed', 
                error: data,
                status: resp.status,
                raw: data
            });
        }

        // Normalize response: requestId + status
        const result = data.result || data;
        const requestId = result.request_id || result.job_id || result.id || data.job_id || data.id;
        const status = result.status || data.status || data.message || 'queued';
        console.log('🔊 [createTTS] normalized =>', { requestId, status });
        return res.json({ success: true, requestId, status, raw: data });
    } catch (err) {
        console.error('❌ Vibee createTTS error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create TTS', error: err.message });
    }
}

async function checkTTSStatus(req, res) {
    try {
        const body = req.body || {};
        const jobId = body.jobId || body.requestId || body.request_id;
        console.log('🔎 [checkTTSStatus] jobId=', jobId);
        if (!VIBEE_API_KEY) {
            return res.status(400).json({ success: false, message: 'Missing VIBEE_API_KEY env' });
        }
        if (!jobId) {
            return res.status(400).json({ success: false, message: 'jobId is required' });
        }

        const resp = await fetch(`${VIBEE_BASE_URL}/v1/tts/${jobId}`, {
            headers: {
                'Authorization': `Bearer ${VIBEE_API_KEY}`
            }
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            return res.status(resp.status).json({ success: false, message: 'Vibee status failed', error: data });
        }

        // Normalize response theo tài liệu Postman: https://documenter.getpostman.com/view/12951168/Uz5FHbSd#3916b3db-4357-4d56-b6f2-35b3888edeb9
        const result = data.result || data;
        const audioUrl = extractAudioUrlLike(result) || extractAudioUrlLike(data);

        const rawStatus = (result && (result.status ?? result.state)) ?? data.status;
        const progress = (result && (result.progress ?? result.percent)) ?? undefined;

        // Ánh xạ trạng thái phổ biến về 3 nhóm
        let normalizedStatus = 'IN_PROGRESS';
        const rawStatusStr = typeof rawStatus === 'string' ? rawStatus.toUpperCase() : rawStatus;

        if (audioUrl) {
            normalizedStatus = 'COMPLETED';
        } else if (typeof progress === 'number' && progress >= 100) {
            normalizedStatus = 'COMPLETED';
        } else if (rawStatusStr === 'COMPLETED' || rawStatusStr === 'DONE' || rawStatusStr === 'SUCCESS') {
            normalizedStatus = 'COMPLETED';
        } else if (rawStatusStr === 'FAILED' || rawStatusStr === 'ERROR') {
            normalizedStatus = 'FAILED';
        } else if (typeof rawStatusStr === 'number') {
            // Một số API trả số: 0/1/2 hoặc 1/2/...; ưu tiên coi 1 hay 2 là hoàn thành nếu có audio
            if (rawStatusStr >= 1 && audioUrl) normalizedStatus = 'COMPLETED';
        }

        console.log('🔎 [checkTTSStatus] normalized =>', { status: normalizedStatus, hasAudioUrl: !!audioUrl, progress });
        return res.json({
            success: true,
            requestId: jobId,
            status: normalizedStatus,
            audioUrl,
            progress,
            raw: data
        });
    } catch (err) {
        console.error('❌ Vibee checkTTSStatus error:', err);
        return res.status(500).json({ success: false, message: 'Failed to check TTS status', error: err.message });
    }
}

async function getAudioUrl(req, res) {
    try {
        const body = req.body || {};
        const jobId = body.jobId || body.requestId || body.request_id;
        console.log('🔗 [getAudioUrl] jobId=', jobId);
        if (!jobId) {
            return res.status(400).json({ success: false, message: 'jobId is required' });
        }
        const resp = await fetch(`${VIBEE_BASE_URL}/v1/tts/${jobId}`, {
            headers: { 'Authorization': `Bearer ${VIBEE_API_KEY}` }
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            return res.status(resp.status).json({ success: false, message: 'Vibee get audio url failed', error: data });
        }
        const result = data.result || data;
        const status = result.status || data.status;
        const audioUrl = extractAudioUrlLike(result) || extractAudioUrlLike(data);
        console.log('🔗 [getAudioUrl] hasAudioUrl=', !!audioUrl);
        return res.json({ success: true, requestId: jobId, status, audioUrl, raw: data });
    } catch (err) {
        console.error('❌ Vibee getAudioUrl error:', err);
        return res.status(500).json({ success: false, message: 'Failed to get audio url', error: err.message });
    }
}

async function downloadTTS(req, res) {
    try {
        const body = req.body || {};
        const audioUrl = body.audioUrl || body.url;
        const filename = body.filename;
        console.log('📥 [downloadTTS] start', { hasAudioUrl: !!audioUrl, filename });
        if (!audioUrl) {
            return res.status(400).json({ success: false, message: 'audioUrl is required' });
        }

        const audioResp = await fetch(audioUrl, {
            headers: {
                'Authorization': `Bearer ${VIBEE_API_KEY}`
            }
        });
        if (!audioResp.ok) {
            return res.status(audioResp.status).json({ 
                success: false, 
                message: 'Failed to fetch audio from url',
                status: audioResp.status,
                statusText: audioResp.statusText
            });
        }

        const arrayBuffer = await audioResp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const audioDir = ensureAudioDir();
        const safeName = filename && filename.trim().length > 0 ? filename.trim() : `tts_${Date.now()}.mp3`;
        const outPath = path.join(audioDir, safeName);
        fs.writeFileSync(outPath, buffer);
        console.log('📥 [downloadTTS] saved', { outPath, bytes: buffer.length });

        return res.json({ success: true, savedTo: outPath, filename: safeName, publicPath: `/audio/${safeName}` });
    } catch (err) {
        console.error('❌ Vibee downloadTTS error:', err);
        return res.status(500).json({ success: false, message: 'Failed to download TTS audio', error: err.message });
    }
}

async function listAudio(req, res) {
    try {
        const audioDir = ensureAudioDir();
        const files = fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3'));
        return res.json({ success: true, files, count: files.length });
    } catch (err) {
        console.error('❌ Vibee listAudio error:', err);
        return res.status(500).json({ success: false, message: 'Failed to list audio', error: err.message });
    }
}

async function waitUntilReady(req, res) {
    try {
        const body = req.body || {};
        const jobId = body.jobId || body.requestId || body.request_id;
        console.log('⏳ [waitUntilReady] jobId=', jobId, 'intervalMs=', body.intervalMs, 'timeoutMs=', body.timeoutMs);
        // Default poll every 10s; if timeoutMs <= 0 or not provided, wait until available
        const intervalMs = Math.max(1000, Number(body.intervalMs ?? 10000));
        const rawTimeout = body.timeoutMs;
        const timeoutMs = (rawTimeout === undefined || Number(rawTimeout) <= 0)
            ? Number.POSITIVE_INFINITY
            : Math.max(intervalMs, Number(rawTimeout));

        if (!jobId) {
            return res.status(400).json({ success: false, message: 'jobId is required' });
        }

        const start = Date.now();
        let lastStatus = null;
        while (Date.now() - start < timeoutMs) {
            const resp = await fetch(`${VIBEE_BASE_URL}/v1/tts/${jobId}`, {
                headers: { 'Authorization': `Bearer ${VIBEE_API_KEY}` }
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) {
                return res.status(resp.status).json({ success: false, message: 'Vibee status failed', error: data });
            }
            const result = data.result || data;
            lastStatus = result.status || data.status;
            const audioUrl = result.audio_url || result.url || data.audio_url || data.url || null;
            if (audioUrl) {
                return res.json({ success: true, requestId: jobId, status: lastStatus, audioUrl });
            }
            await new Promise(r => setTimeout(r, intervalMs));
        }

        const waited = Date.now() - start;
        console.log('⏱️ [waitUntilReady] timeout after ms=', waited);
        return res.json({ success: true, requestId: jobId, status: lastStatus || 'IN_PROGRESS', audioUrl: null, timedOut: true, waitedMs: waited });
    } catch (err) {
        console.error('❌ Vibee waitUntilReady error:', err);
        return res.status(500).json({ success: false, message: 'Failed while waiting for audio', error: err.message });
    }
}

// Unified TTS workflow endpoint
async function unifiedTTS(req, res) {
    try {
        const body = req.body || {};
        console.log('🎼 [unifiedTTS] incoming', {
            textPreview: (body.text || body.input_text || '').slice(0, 80),
            voice: body.voice || body.voice_code,
            waitForCompletion: body.waitForCompletion,
            download: body.download,
            filename: body.filename
        });
        const { 
            // Input text and voice settings
            text, input_text, voice, voice_code, 
            // Audio settings
            format, audio_type, bitrate, speed, speed_rate, sampleRate, sample_rate,
            // Workflow options
            waitForCompletion = true, maxWaitMs = 300000, pollIntervalMs = 10000,
            // Download options
            download = true, filename,
            // Response options
            responseType = 'indirect', callbackUrl, callback_url
        } = body;

        // Normalize inputs
        const normalizedText = text || input_text;
        const normalizedVoice = voice || voice_code || 'hn_female_ngochuyen_full_48k-fhg';
        const normalizedFormat = format || audio_type || 'mp3';
        const normalizedSpeed = speed || speed_rate || 1.0;
        const normalizedSampleRate = sampleRate || sample_rate || 44100;
        const normalizedCallbackUrl = callbackUrl || callback_url || 'https://example.com/callback';

        if (!normalizedText) {
            return res.status(400).json({ 
                success: false, 
                message: 'Text input is required',
                error: 'Missing text or input_text parameter'
            });
        }

        // Step 1: Create TTS job
        const createPayload = {
            app_id: VIBEE_APP_ID,
            response_type: responseType,
            callback_url: normalizedCallbackUrl,
            input_text: normalizedText,
            voice_code: normalizedVoice,
            audio_type: normalizedFormat,
            bitrate: typeof bitrate === 'number' ? bitrate : 128,
            speed_rate: String(normalizedSpeed),
            sample_rate: Number(normalizedSampleRate) // Convert to number, not string
        };

        const createResp = await fetch(`${VIBEE_BASE_URL}/v1/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Bearer ${VIBEE_API_KEY}`
            },
            body: JSON.stringify(createPayload)
        });

        const createData = await createResp.json().catch(() => ({}));
        console.log('🎼 [unifiedTTS] create status=', createResp.status, 'keys=', Object.keys(createData || {}));
        if (!createResp.ok) {
            return res.status(createResp.status).json({ 
                success: false, 
                message: 'Failed to create TTS job', 
                error: createData 
            });
        }

        // Check for error in response even if status is 200
        if (createData.error_code || createData.error_message) {
            return res.status(400).json({
                success: false,
                message: 'Vibee API error: ' + (createData.error_message || 'Unknown error'),
                error: createData
            });
        }

        const result = createData.result || createData;
        const requestId = result.request_id || createData.job_id || createData.id;
        const initialStatus = result.status || createData.status || 'IN_PROGRESS';

        // Check if we got a valid requestId
        if (!requestId) {
            console.log('❌ [unifiedTTS] No requestId found in response:', createData);
            return res.status(400).json({
                success: false,
                message: 'No requestId returned from Vibee API',
                error: createData
            });
        }

        console.log('✅ [unifiedTTS] Got requestId:', requestId);
        const response = {
            success: true,
            requestId,
            status: initialStatus,
            text: normalizedText,
            voice: normalizedVoice,
            format: normalizedFormat,
            createdAt: new Date().toISOString(),
            steps: {
                created: true,
                completed: false,
                downloaded: false
            }
        };

        // Step 2: Wait for completion if requested
        if (waitForCompletion && initialStatus !== 'SUCCESS') {
            const startTime = Date.now();
            let currentStatus = initialStatus;
            let audioUrl = null;

            while (Date.now() - startTime < maxWaitMs) {
                const statusResp = await fetch(`${VIBEE_BASE_URL}/v1/tts/${requestId}`, {
                    headers: { 'Authorization': `Bearer ${VIBEE_API_KEY}` }
                });
                const statusData = await statusResp.json().catch(() => ({}));
                
                if (statusResp.ok) {
                    const statusResult = statusData.result || statusData;
                    currentStatus = statusResult.status || statusData.status;
                    audioUrl = extractAudioUrlLike(statusResult) || extractAudioUrlLike(statusData);
                    
                    if (audioUrl) {
                        response.status = currentStatus;
                        response.audioUrl = audioUrl;
                        response.steps.completed = true;
                        console.log('🎼 [unifiedTTS] completed with audioUrl');
                        break;
                    }
                }
                
                await new Promise(r => setTimeout(r, pollIntervalMs));
            }

            if (!audioUrl) {
                response.timedOut = true;
                response.waitedMs = Date.now() - startTime;
                console.log('⏱️ [unifiedTTS] wait timeout after ms=', response.waitedMs);
            }
        }

        // Step 3: Download if requested and audioUrl available
        if (download && response.audioUrl) {
            try {
                const audioResp = await fetch(response.audioUrl, {
                    headers: {
                        'Authorization': `Bearer ${VIBEE_API_KEY}`
                    }
                });
                if (audioResp.ok) {
                    const arrayBuffer = await audioResp.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    const audioDir = ensureAudioDir();
                    const safeName = filename || `tts_${requestId}_${Date.now()}.mp3`;
                    const outPath = path.join(audioDir, safeName);
                    fs.writeFileSync(outPath, buffer);
                    console.log('📥 [unifiedTTS] downloaded', { outPath, bytes: buffer.length });
                    
                    response.downloaded = {
                        filename: safeName,
                        path: outPath,
                        publicPath: `/audio/${safeName}`,
                        size: buffer.length
                    };
                    response.steps.downloaded = true;
                }
            } catch (downloadErr) {
                response.downloadError = downloadErr.message;
                console.error('❌ [unifiedTTS] download error:', downloadErr);
            }
        }

        return res.json(response);
    } catch (err) {
        console.error('❌ Unified TTS error:', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Unified TTS workflow failed', 
            error: err.message 
        });
    }
}

/**
 * TTS standalone không cần Express response object
 */
async function standaloneTTS(text, voice = 'hn_female_xuanthu_new', filename = null) {
    try {
        console.log(`🎵 [standaloneTTS] Processing: ${text.length} characters`);
        
        const VIBEE_BASE_URL = process.env.VIBEE_BASE_URL || 'https://api.vibee.ai';
        const VIBEE_API_KEY = process.env.VIBEE_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjA4NjgwOTV9.hYH_gbcJWbT2RCnk1omaLI5dzCZ46DOnZnnO62wirao';
        const VIBEE_APP_ID = process.env.VIBEE_APP_ID || 'vibee-app-id';
        
        // Step 1: Create TTS job
        const createPayload = {
            app_id: VIBEE_APP_ID,
            response_type: 'sync',
            callback_url: 'https://example.com/callback',
            input_text: text,
            voice_code: voice,
            audio_type: 'mp3',
            bitrate: 128,
            speed_rate: '1.0',
            sample_rate: 44100
        };

        const createResp = await fetch(`${VIBEE_BASE_URL}/v1/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Bearer ${VIBEE_API_KEY}`
            },
            body: JSON.stringify(createPayload)
        });

        const createData = await createResp.json();
        console.log(`🎵 [standaloneTTS] Create response:`, createData);

        if (!createResp.ok || createData.error_code || createData.error_message) {
            throw new Error(`TTS creation failed: ${createData.error_message || 'Unknown error'}`);
        }

        const requestId = createData.request_id || createData.requestId;
        if (!requestId) {
            throw new Error('No request ID returned from TTS creation');
        }

        // Step 2: Wait for completion
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
            
            const statusResp = await fetch(`${VIBEE_BASE_URL}/v1/tts/${requestId}`, {
                headers: { 'Authorization': `Bearer ${VIBEE_API_KEY}` }
            });
            const statusData = await statusResp.json();
            
            console.log(`🎵 [standaloneTTS] Status check ${attempts}:`, statusData.status);
            
            if (statusData.status === 'completed' || statusData.status === 'success') {
                // Step 3: Get audio URL
                const audioResp = await fetch(`${VIBEE_BASE_URL}/v1/tts/${requestId}/audio`, {
                    headers: { 'Authorization': `Bearer ${VIBEE_API_KEY}` }
                });
                const audioData = await audioResp.json();
                
                if (!audioResp.ok) {
                    throw new Error('Failed to get audio URL');
                }
                
                const audioUrl = audioData.result?.audio_url || audioData.audio_url;
                if (!audioUrl) {
                    throw new Error('No audio URL returned');
                }
                
                // Step 4: Download audio
                const downloadResp = await fetch(audioUrl, {
                    headers: { 'Authorization': `Bearer ${VIBEE_API_KEY}` }
                });
                
                if (!downloadResp.ok) {
                    throw new Error('Failed to download audio');
                }
                
                const arrayBuffer = await downloadResp.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                
                const audioDir = ensureAudioDir();
                const safeName = filename || `standalone_tts_${Date.now()}.mp3`;
                const outPath = path.join(audioDir, safeName);
                fs.writeFileSync(outPath, buffer);
                
                console.log(`✅ [standaloneTTS] Audio saved: ${outPath}`);
                
                return {
                    success: true,
                    savedTo: outPath,
                    filename: safeName,
                    publicPath: `/audio/${safeName}`,
                    requestId: requestId
                };
            } else if (statusData.status === 'failed' || statusData.status === 'error') {
                throw new Error(`TTS failed: ${statusData.error_message || 'Unknown error'}`);
            }
        }
        
        throw new Error('TTS timeout - max attempts reached');
        
    } catch (error) {
        console.error(`❌ [standaloneTTS] Error:`, error);
        return {
            success: false,
            message: 'Standalone TTS failed',
            error: error.message
        };
    }
}

/**
 * Chia text dài thành chunks và tạo audio từng phần, sau đó ghép lại
 */
async function chunkedTTS(text, voice = 'hn_female_xuanthu_new', filename = null) {
    try {
        console.log(`🔄 [chunkedTTS] Bắt đầu xử lý text dài: ${text.length} ký tự`);
        
        // Chia text thành chunks (mỗi chunk tối đa 50000 ký tự để xử lý video dài 1-2 tiếng)
        const maxChunkSize = 50000;
        const chunks = [];
        
        if (text.length <= maxChunkSize) {
            // Text ngắn, dùng standaloneTTS bình thường
            console.log(`📝 [chunkedTTS] Text ngắn, dùng standaloneTTS`);
            return await standaloneTTS(text, voice, filename);
        }
        
        // Chia text thành chunks
        const sentences = text.split(/[.!?]+/);
        let currentChunk = '';
        
        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += sentence + '.';
            }
        }
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        console.log(`📝 [chunkedTTS] Chia thành ${chunks.length} chunks`);
        
        // Tạo audio cho từng chunk
        const audioFiles = [];
        const tempDir = ensureAudioDir();
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`🎵 [chunkedTTS] Xử lý chunk ${i + 1}/${chunks.length} (${chunk.length} ký tự)`);
            
            const chunkFilename = `chunk_${Date.now()}_${i}.mp3`;
            const chunkResult = await standaloneTTS(chunk, voice, chunkFilename);
            
            if (!chunkResult.success) {
                throw new Error(`TTS failed for chunk ${i + 1}: ${chunkResult.message}`);
            }
            
            audioFiles.push(chunkResult.savedTo);
            console.log(`✅ [chunkedTTS] Chunk ${i + 1} hoàn thành: ${chunkResult.savedTo}`);
            
            // Delay giữa các request để tránh rate limit
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Ghép các file audio lại thành 1 file
        console.log(`🔗 [chunkedTTS] Ghép ${audioFiles.length} file audio...`);
        const finalFilename = filename || `chunked_tts_${Date.now()}.mp3`;
        const finalPath = path.join(tempDir, finalFilename);
        
        // Tạo file list cho ffmpeg concat
        const listFile = path.join(tempDir, `concat_${Date.now()}.txt`);
        const listContent = audioFiles.map(file => `file '${file.replace(/\\/g, '/')}'`).join('\n');
        fs.writeFileSync(listFile, listContent, 'utf8');
        
        // Sử dụng ffmpeg để ghép audio
        const { exec } = require('child_process');
        const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${finalPath}"`;
        
        await new Promise((resolve, reject) => {
            exec(ffmpegCmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ [chunkedTTS] FFmpeg error:`, error);
                    reject(error);
                } else {
                    console.log(`✅ [chunkedTTS] Ghép audio thành công: ${finalPath}`);
                    resolve();
                }
            });
        });
        
        // Xóa các file tạm
        try {
            fs.unlinkSync(listFile);
            audioFiles.forEach(file => {
                try {
                    fs.unlinkSync(file);
                } catch (e) {
                    console.log(`⚠️ [chunkedTTS] Không thể xóa file tạm: ${file}`);
                }
            });
            console.log(`🧹 [chunkedTTS] Đã xóa ${audioFiles.length} file tạm`);
        } catch (e) {
            console.log(`⚠️ [chunkedTTS] Lỗi khi xóa file tạm: ${e.message}`);
        }
        
        return {
            success: true,
            message: 'Chunked TTS completed successfully',
            savedTo: finalPath,
            filename: finalFilename,
            publicPath: `/audio/${finalFilename}`,
            chunksProcessed: chunks.length,
            totalLength: text.length
        };
        
    } catch (error) {
        console.error(`❌ [chunkedTTS] Error:`, error);
        return {
            success: false,
            message: 'Chunked TTS failed',
            error: error.message
        };
    }
}

module.exports = {
    createTTS,
    checkTTSStatus,
    downloadTTS,
    listAudio,
    waitUntilReady,
    getAudioUrl,
    unifiedTTS,
    standaloneTTS,
    chunkedTTS
};


