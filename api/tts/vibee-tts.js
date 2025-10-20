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
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${VIBEE_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            return res.status(resp.status).json({ success: false, message: 'Vibee create failed', error: data });
        }

        // Normalize response: requestId + status
        const result = data.result || data;
        const requestId = result.request_id || result.job_id || result.id || data.job_id || data.id;
        const status = result.status || data.status || data.message || 'queued';
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

        // Normalize response
        const result = data.result || data;
        const status = result.status || data.status;
        const audioUrl = extractAudioUrlLike(result) || extractAudioUrlLike(data);
        return res.json({ success: true, requestId: jobId, status, audioUrl, raw: data });
    } catch (err) {
        console.error('❌ Vibee checkTTSStatus error:', err);
        return res.status(500).json({ success: false, message: 'Failed to check TTS status', error: err.message });
    }
}

async function getAudioUrl(req, res) {
    try {
        const body = req.body || {};
        const jobId = body.jobId || body.requestId || body.request_id;
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
        if (!audioUrl) {
            return res.status(400).json({ success: false, message: 'audioUrl is required' });
        }

        const audioResp = await fetch(audioUrl);
        if (!audioResp.ok) {
            return res.status(audioResp.status).json({ success: false, message: 'Failed to fetch audio from url' });
        }

        const arrayBuffer = await audioResp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const audioDir = ensureAudioDir();
        const safeName = filename && filename.trim().length > 0 ? filename.trim() : `tts_${Date.now()}.mp3`;
        const outPath = path.join(audioDir, safeName);
        fs.writeFileSync(outPath, buffer);

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

        return res.json({ success: true, requestId: jobId, status: lastStatus || 'IN_PROGRESS', audioUrl: null, timedOut: true, waitedMs: Date.now() - start });
    } catch (err) {
        console.error('❌ Vibee waitUntilReady error:', err);
        return res.status(500).json({ success: false, message: 'Failed while waiting for audio', error: err.message });
    }
}

// Unified TTS workflow endpoint
async function unifiedTTS(req, res) {
    try {
        const body = req.body || {};
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
            sample_rate: String(normalizedSampleRate)
        };

        const createResp = await fetch(`${VIBEE_BASE_URL}/v1/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${VIBEE_API_KEY}`
            },
            body: JSON.stringify(createPayload)
        });

        const createData = await createResp.json().catch(() => ({}));
        if (!createResp.ok) {
            return res.status(createResp.status).json({ 
                success: false, 
                message: 'Failed to create TTS job', 
                error: createData 
            });
        }

        const result = createData.result || createData;
        const requestId = result.request_id || createData.job_id || createData.id;
        const initialStatus = result.status || createData.status || 'IN_PROGRESS';

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
                        break;
                    }
                }
                
                await new Promise(r => setTimeout(r, pollIntervalMs));
            }

            if (!audioUrl) {
                response.timedOut = true;
                response.waitedMs = Date.now() - startTime;
            }
        }

        // Step 3: Download if requested and audioUrl available
        if (download && response.audioUrl) {
            try {
                const audioResp = await fetch(response.audioUrl);
                if (audioResp.ok) {
                    const arrayBuffer = await audioResp.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    const audioDir = ensureAudioDir();
                    const safeName = filename || `tts_${requestId}_${Date.now()}.mp3`;
                    const outPath = path.join(audioDir, safeName);
                    fs.writeFileSync(outPath, buffer);
                    
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

module.exports = {
    createTTS,
    checkTTSStatus,
    downloadTTS,
    listAudio,
    waitUntilReady,
    getAudioUrl,
    unifiedTTS
};


