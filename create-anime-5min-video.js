const fetch = require('node-fetch');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

// Nạp biến môi trường từ .env nếu có
try {
    const dotenvPath = path.join(__dirname, '.env');
    if (fs.existsSync(dotenvPath)) {
        require('dotenv').config({ path: dotenvPath, override: true });
        console.log('🧩 Đã nạp biến môi trường từ .env');
    }
} catch (_) {}

const execAsync = promisify(exec);

// ENV
const OPENAI_API_KEY = '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'
const LABS_COOKIES = (process.env.LABS_COOKIES || '').trim();
const RUN_MODE = (process.env.RUN_MODE || 'default').toLowerCase();
const VEO_PROJECT_ID = (process.env.VEO_PROJECT_ID || '').trim();

// Network helpers
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// FFmpeg helpers
async function hasAudioStream(filePath) {
    try {
        const cmd = `ffprobe -v error -select_streams a:0 -show_entries stream=index -of csv=p=0 "${filePath}"`;
        const { stdout } = await execAsync(cmd);
        return Boolean(String(stdout || '').trim());
    } catch (_) {
        return false;
    }
}

// OpenAI helper với retry
async function fetchOpenAIWithRetry(payload, { maxRetries = 7, baseDelayMs = 1500 } = {}) {
    if (!OPENAI_API_KEY) throw new Error('Thiếu OPENAI_API_KEY trong môi trường');
    let attempt = 0;
    while (true) {
        attempt++;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);
        try {
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
            if (resp.ok) return await resp.json();
            const status = resp.status;
            const text = await resp.text().catch(() => '');
            if ((status === 429 || status >= 500) && attempt <= maxRetries) {
                const retryAfter = Number(resp.headers.get('retry-after') || 0) * 1000;
                const backoff = retryAfter || Math.min(30000, baseDelayMs * Math.pow(2, attempt - 1));
                console.log(`⚠️  OpenAI HTTP ${status}. Retry in ${Math.round(backoff / 1000)}s (attempt ${attempt}/${maxRetries})`);
                await sleep(backoff + Math.floor(Math.random() * 400));
                continue;
            }
            throw new Error(`OpenAI HTTP ${status}: ${text}`);
        } catch (err) {
            clearTimeout(timeout);
            const msg = String(err && err.message || err);
            const transient = /ECONNRESET|ETIMEDOUT|socket hang up|network|aborted|timeout/i.test(msg);
            if (transient && attempt <= maxRetries) {
                const backoff = Math.min(30000, baseDelayMs * Math.pow(2, attempt - 1));
                console.log(`⚠️  OpenAI transient error: ${msg}. Retry in ${Math.round(backoff / 1000)}s (attempt ${attempt}/${maxRetries})`);
                await sleep(backoff + Math.floor(Math.random() * 400));
                continue;
            }
            throw err;
        }
    }
}

// Cấu hình video 5 phút (300s)
const SEGMENT_DURATION = 8; // mỗi segment 8s
const TOTAL_DURATION_SECONDS = 5 * 60; // 300s
const NUM_SEGMENTS = Math.floor(TOTAL_DURATION_SECONDS / SEGMENT_DURATION);
const CONCURRENCY = 5;

// Cookie cache (dùng nếu cần gọi server lấy cookie)
let cachedCookie = null;
let cookieCacheTime = 0;
const COOKIE_CACHE_DURATION = 30 * 60 * 1000;

// Helpers cho ngẫu nhiên
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]); }
function pickN(arr, n) { return shuffle(arr).slice(0, Math.min(n, arr.length)); }
function makeNonce() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

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
                console.log('✅ Đọc cookie từ file labs-cookies.txt');
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
            cachedCookie = LABS_COOKIES; cookieCacheTime = now;
            console.log('🍪 [VPS] Dùng Labs cookies từ ENV (LABS_COOKIES)');
            return cachedCookie;
        }
        console.log('❌ [VPS] Thiếu LABS_COOKIES trong env.');
        return null;
    }
    if (cachedCookie && (now - cookieCacheTime) < COOKIE_CACHE_DURATION) {
        console.log('🍪 Sử dụng cached cookie');
        return cachedCookie;
    }
    console.log('🔄 Lấy cookie mới từ server...');
    try {
        const response = await fetch(`${serverUrl}/api/labs/get-cookies`, { method: 'GET' });
        const result = await response.json();
        if (result.success && result.cookies) {
            cachedCookie = result.cookies; cookieCacheTime = now;
            console.log('✅ Đã cache cookie mới từ server');
            return cachedCookie;
        }
        throw new Error('Không lấy được cookie từ server');
    } catch (error) {
        console.error('❌ Lỗi lấy cookie từ server:', error.message);
        console.log('🔄 Thử lấy cookie từ file labs-cookies.txt...');
        if (RUN_MODE !== 'vps') {
            const cookieFromFile = readCookieFromFile();
            if (cookieFromFile) {
                cachedCookie = cookieFromFile; cookieCacheTime = now;
                console.log('✅ Sử dụng cookie từ file labs-cookies.txt');
                return cachedCookie;
            }
        }
        console.error('❌ Không thể lấy cookie');
        return null;
    }
}

// Parse JSON utility (nhận text, trích JSON từ code block hoặc balanced braces)
function parseJsonFromText(text, outputDir, errorPrefix = 'json') {
    let jsonString = null;
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
        jsonString = markdownMatch[1].trim();
    } else {
        const startIdx = text.indexOf('{');
        if (startIdx !== -1) {
            let braceCount = 0; let inString = false; let escapeNext = false;
            for (let i = startIdx; i < text.length; i++) {
                const char = text[i];
                if (escapeNext) { escapeNext = false; continue; }
                if (char === '\\') { escapeNext = true; continue; }
                if (char === '"') { inString = !inString; continue; }
                if (!inString) {
                    if (char === '{') braceCount++;
                    if (char === '}') {
                        braceCount--;
                        if (braceCount === 0) { jsonString = text.substring(startIdx, i + 1); break; }
                    }
                }
            }
        }
    }
    if (!jsonString) throw new Error('Không tìm thấy nội dung JSON hợp lệ');
    jsonString = jsonString
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/:\s*'([^']*)'/g, ': "$1"')
        .replace(/\{\s*'([^']*)'/g, '{ "$1"')
        .replace(/,\s*'([^']*)'/g, ', "$1"')
        .trim();
    try {
        return JSON.parse(jsonString);
    } catch (parseError) {
        try {
            let fixedJson = ''; let inString = false; let escapeNext = false;
            for (let i = 0; i < jsonString.length; i++) {
                const c = jsonString[i]; const n = jsonString[i + 1];
                if (escapeNext) { fixedJson += c; escapeNext = false; continue; }
                if (c === '\\') { fixedJson += c; escapeNext = true; continue; }
                if (c === '"') { inString = !inString; fixedJson += c; continue; }
                if (inString) {
                    if (c === '\n') fixedJson += '\\n';
                    else if (c === '\r') { fixedJson += '\\n'; if (n === '\n') i++; }
                    else if (c === '\t') fixedJson += '\\t';
                    else fixedJson += c;
                } else { fixedJson += c; }
            }
            return JSON.parse(fixedJson);
        } catch (secondError) {
            try {
                const errorLogPath = path.join(outputDir, `${errorPrefix}-parse-error-${Date.now()}.txt`);
                fs.writeFileSync(errorLogPath, jsonString, 'utf8');
                console.error(`📄 Đã lưu JSON lỗi vào: ${errorLogPath}`);
            } catch (_) {}
            throw new Error(`Lỗi parse JSON: ${parseError.message}`);
        }
    }
}

// Bước 1: Tạo nhân vật anime cực kỳ chi tiết + story 5 phút
async function createAnimeCharacterAndStory() {
    const serverUrl = 'http://localhost:8888';
    const outputDir = './temp/anime-5min-video';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Tạo bối cảnh ngẫu nhiên để đảm bảo khác nhau mỗi lần chạy
    const randomContext = {
        season: randomChoice(['xuân', 'hạ', 'thu', 'đông']),
        timeOfDay: randomChoice(['bình minh', 'sáng', 'trưa', 'chiều', 'hoàng hôn', 'đêm']),
        mainSetting: randomChoice(['thành phố tương lai', 'rừng tre cổ', 'đảo nổi trên mây', 'sa mạc tinh thể', 'thị trấn biển đêm', 'đền cổ trong núi tuyết', 'khu chợ đèn lồng', 'ga tàu hơi nước']),
        subSettings: pickN(['cầu treo gió lớn', 'hẻm đèn neon', 'vườn anh đào', 'hang pha lê', 'thư viện bỏ hoang', 'đường ray bỏ dở', 'bờ biển sương mù', 'vách đá gió rít'], 3),
        genreTone: randomChoice(['ấm áp', 'phiêu lưu nhẹ', 'kỳ ảo', 'hài hước', 'truyền cảm hứng']),
        conflictType: randomChoice(['giải cứu', 'trả lại vật đánh mất', 'hộ tống an toàn', 'giải đố nghi lễ', 'khắc phục sự cố thiên nhiên']),
        antagonist: randomChoice(['không có phản diện', 'bóng hình bí ẩn', 'robot lỗi nhịp', 'quái thú hiền lành bị hiểu lầm']),
        colorPalette: randomChoice(['pastel ấm', 'vibrant tương phản', 'nocturne tím xanh', 'sunset cam hồng', 'aqua mát']),
        animationFlavor: randomChoice(['brush stroke nhẹ', 'cel-shade đậm', 'glow viền', 'hạt film nhẹ', 'bokeh mềm']),
        cameraStyles: pickN(['pan chậm', 'tilt lên', 'zoom nhấn', 'handheld nhẹ', 'track theo'], 2),
        musicVibe: randomChoice(['lofi ấm', 'orchestral nhẹ', 'guitar mộc', 'piano kể chuyện', 'synth mơ']),
        nonce: makeNonce()
    };
    try { fs.writeFileSync(path.join(outputDir, 'random-context.json'), JSON.stringify(randomContext, null, 2), 'utf8'); } catch (_) {}

    console.log('📖 [Step 1] Tạo NHÂN VẬT anime cực kỳ chi tiết...');
    const characterRes = await fetchOpenAIWithRetry({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'Bạn là nhà thiết kế nhân vật anime 2D, phong cách hoạt hình điện ảnh, tạo một nhân vật NHÂN HÓA (anthropomorphic) dáng người, dùng cho video 5 phút. Trả về JSON.'
            },
            {
                role: 'user',
                content: `Tạo MỘT NHÂN VẬT anime cực kỳ chi tiết (anthropomorphic, đi hai chân, dáng người), dùng xuyên suốt, giữ 100% nhất quán (không thay đổi khuôn mặt/màu lông/trang phục/tỉ lệ cơ thể/đặc điểm).

YẾU TỐ NGẪU NHIÊN (để đảm bảo KHÁC BIỆT mỗi lần chạy, bắt buộc đưa vào mô tả):
- Mùa: ${randomContext.season}
- Thời điểm: ${randomContext.timeOfDay}
- Bối cảnh chính: ${randomContext.mainSetting}
- Phụ bối cảnh: ${randomContext.subSettings.join(', ')}
- Tông thể loại: ${randomContext.genreTone}
- Kiểu xung đột: ${randomContext.conflictType}
- Đối tượng đối kháng: ${randomContext.antagonist}
- Bảng màu: ${randomContext.colorPalette}
- Phong vị animation: ${randomContext.animationFlavor}
- Camera gợi ý: ${randomContext.cameraStyles.join(', ')}
- Âm nhạc: ${randomContext.musicVibe}
- NONCE: ${randomContext.nonce}

YÊU CẦU TRẢ VỀ JSON:
{
  "name": string,
  "species": "anthropomorphic cat",
  "age": string,
  "gender": string,
  "backstory": string,
  "personality": string,
  "skills": string,
  "weaknesses": string,
  "appearance": {
    "body": string,        // tỉ lệ cơ thể, dáng, chiều cao, vóc dáng
    "fur": string,         // màu lông, hoa văn, texture
    "face": string,        // khuôn mặt, mắt, mũi, miệng, râu, tai
    "uniqueMarks": string  // vết/điểm nhận dạng đặc biệt, vị trí cụ thể
  },
  "outfit": {
    "top": string,
    "bottom": string,
    "footwear": string,
    "accessories": string
  },
  "tools": string,         // vũ khí/công cụ mang theo
  "colorPalette": string,  // bảng màu chủ đạo
  "animationStyle": "2D anime cinematic, vibrant, dynamic lighting"
}

LƯU Ý:
- Mô tả phải cực kỳ cụ thể, rõ từng chi tiết, dùng xuyên suốt tất cả cảnh.
- Phải lồng ghép các YẾU TỐ NGẪU NHIÊN ở trên vào thiết kế nhân vật để đảm bảo tính độc nhất.`
            }
        ],
        max_tokens: 1500,
        temperature: 0.9
    });
    if (!characterRes.choices) throw new Error('Không sinh được nhân vật');
    const characterText = characterRes.choices[0].message.content;
    const character = parseJsonFromText(characterText, outputDir, 'character');
    fs.writeFileSync(path.join(outputDir, 'character.json'), JSON.stringify(character, null, 2), 'utf8');
    console.log(`✅ [Step 1] Nhân vật: ${character.name} | Phong cách: ${character.animationStyle}`);

    console.log('🧭 [Step 1] Tạo câu chuyện 5 phút (300 giây)...');
    const outlineRes = await fetchOpenAIWithRetry({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'Bạn là biên kịch anime 2D. Tạo câu chuyện 5 phút có cấu trúc rõ ràng và chia thành các cảnh 8 giây.'
            },
            {
                role: 'user',
                content: `Dùng nhân vật sau cho toàn bộ video, giữ NHẤT QUÁN 100% ngoại hình/trang phục/tỉ lệ/đặc điểm:
${JSON.stringify(character)}

YÊU CẦU CÂU CHUYỆN 5 PHÚT:
- Chủ đề tích cực, phiêu lưu nhẹ, phù hợp thiếu nhi
- Cấu trúc: Mở đầu (giới thiệu) → Phát triển (nảy sinh vấn đề) → Cao trào (giải quyết) → Kết thúc (ấm áp)
- KHÔNG có chữ overlay, KHÔNG thoại/voice-over
- Phong cách: anime 2D cinematic, màu sắc sống động, ánh sáng động

YẾU TỐ NGẪU NHIÊN (đảm bảo câu chuyện KHÁC BIỆT mỗi lần chạy; phải được dệt vào bối cảnh/cảnh/nhịp):
- Mùa: ${randomContext.season}; Thời điểm: ${randomContext.timeOfDay}
- Bối cảnh chính: ${randomContext.mainSetting}; Phụ bối cảnh: ${randomContext.subSettings.join(', ')}
- Tông thể loại: ${randomContext.genreTone}; Xung đột: ${randomContext.conflictType}; Đối kháng: ${randomContext.antagonist}
- Bảng màu: ${randomContext.colorPalette}; Phong vị animation: ${randomContext.animationFlavor}
- Camera: ${randomContext.cameraStyles.join(', ')}; Nhạc: ${randomContext.musicVibe}
- NONCE: ${randomContext.nonce}

QUY TẮC ĐA DẠNG & LOGIC:
- Mỗi cảnh 8s phải góp phần vào tiến trình câu chuyện; bối cảnh và hành động thay đổi hợp lý.
- Tránh lặp lại hành động y hệt giữa các cảnh liên tiếp (trừ khi có dụng ý).
- Nhân vật phải GIỮ NGUYÊN ngoại hình/trang phục/đặc điểm/tỉ lệ trong tất cả cảnh.

TRẢ VỀ JSON:
{
  "overallTheme": string,
  "colorScheme": string,
  "visualStyle": string,
  "outline": string,
  "scenes": [
    { "index": 1, "timeStart": 0, "timeEnd": 8, "focus": string, "prompt": string },
    ... đủ ${NUM_SEGMENTS} cảnh, mỗi cảnh 8 giây liên tục, logic nối tiếp ...
  ]
}
`
            }
        ],
        max_tokens: 4000,
        temperature: 1.0
    });
    if (!outlineRes.choices) throw new Error('Không sinh được story');
    const outlineText = outlineRes.choices[0].message.content;
    const story = parseJsonFromText(outlineText, outputDir, 'story');

    // Chuẩn hóa scenes theo mốc 8s và số lượng
    let scenes = Array.isArray(story.scenes) ? story.scenes.slice(0, NUM_SEGMENTS) : [];
    for (let i = 0; i < NUM_SEGMENTS; i++) {
        if (!scenes[i]) scenes[i] = { index: i + 1, timeStart: i * SEGMENT_DURATION, timeEnd: (i + 1) * SEGMENT_DURATION, focus: `Scene ${i + 1}`, prompt: `Anime scene ${i + 1}` };
        scenes[i].index = i + 1;
        scenes[i].timeStart = i * SEGMENT_DURATION;
        scenes[i].timeEnd = (i + 1) * SEGMENT_DURATION;
        scenes[i].timeRange = `${scenes[i].timeStart}-${scenes[i].timeEnd}s`;
    }

    const analysis = {
        overallTheme: story.overallTheme || 'Anime Adventure',
        colorScheme: story.colorScheme || `Vibrant, warm tones (${randomContext.colorPalette})`,
        visualStyle: story.visualStyle || `2D anime cinematic, dynamic lighting (${randomContext.animationFlavor})`,
        character,
        segments: scenes,
        randomContext
    };
    fs.writeFileSync(path.join(outputDir, 'anime-story.json'), JSON.stringify(analysis, null, 2), 'utf8');
    console.log(`✅ [Step 1] Đã tạo ${analysis.segments.length} cảnh`);

    return { analysis, outputDir, serverUrl };
}

// Bước 2: Gửi trực tiếp từng cảnh lên Veo 3 (KHÔNG tối ưu prompt)
async function sendScenesToVeo3(analysis, outputDir, serverUrl) {
    console.log('🎬 [Step 2] Gửi từng cảnh lên Veo 3 (bỏ qua tối ưu prompt)...');
    const veo3Results = [];
    const monitorPromises = [];

    async function monitorAndDownload(veo3Result, opts = {}) {
        const { maxAttempts = 100 } = opts;
        let operationId = veo3Result.operationId;
        let attempts = 0;
        const INITIAL_DELAY_MS = 60000;
        console.log(`⏸️  [Monitor] Đợi ${Math.floor(INITIAL_DELAY_MS / 1000)}s trước khi kiểm tra op=${operationId}`);
        await sleep(INITIAL_DELAY_MS);
        const startTs = Date.now();
        const POLL_INTERVAL_MS = 5000;
        while (attempts < maxAttempts) {
            try {
                const statusResponse = await fetch(`${serverUrl}/api/check-status`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ operationName: operationId, noRemove: true, ...(LABS_COOKIES ? { labsCookies: LABS_COOKIES } : {}) })
                });
                const statusResult = await statusResponse.json();
                if (statusResult.success && statusResult.videoStatus === 'COMPLETED' && statusResult.videoUrl) {
                    const downloadResponse = await fetch(`${serverUrl}/api/tts/download`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ audioUrl: statusResult.videoUrl, filename: `anime_seg_${veo3Result.segmentIndex}_${Date.now()}.mp4` })
                    });
                    const downloadResult = await downloadResponse.json();
                    if (downloadResult.success) {
                        const waitedSec = Math.floor((Date.now() - startTs) / 1000);
                        console.log(`✅ [Monitor] seg=${veo3Result.segmentIndex + 1} hoàn thành sau ${waitedSec}s`);
                        return { success: true, segmentIndex: veo3Result.segmentIndex, path: downloadResult.savedTo || downloadResult.outPath || downloadResult.path };
                    }
                    return { success: false, segmentIndex: veo3Result.segmentIndex, error: 'Download failed' };
                } else if (statusResult.success && statusResult.videoStatus === 'PENDING') {
                    attempts++;
                    await sleep(POLL_INTERVAL_MS);
                } else {
                    return { success: false, segmentIndex: veo3Result.segmentIndex, error: 'Operation failed' };
                }
            } catch (_) {
                attempts++;
                await sleep(POLL_INTERVAL_MS);
            }
        }
        return { success: false, segmentIndex: veo3Result.segmentIndex, error: 'Timeout' };
    }

    function buildPromptForScene(segment, character) {
        const charBlock = `CHARACTER (MUST REMAIN IDENTICAL IN ALL SCENES): ${character.name} — species: ${character.species}. Body: ${character.appearance?.body}. Fur: ${character.appearance?.fur}. Face: ${character.appearance?.face}. Unique marks: ${character.appearance?.uniqueMarks}. Outfit: top ${character.outfit?.top}, bottom ${character.outfit?.bottom}, footwear ${character.outfit?.footwear}, accessories ${character.outfit?.accessories}. Tools: ${character.tools}. Color palette: ${character.colorPalette}. Personality: ${character.personality}.`;
        const animeEnforce = `ANIME STYLE ENFORCEMENT: This video MUST be ANIME 2D animation with a hand-drawn, cel-shaded look. Use stylized outlines, flat shading with soft gradients, limited frame smearing, and exaggerated expressions typical of anime. Absolutely NOT realistic, NOT photorealistic, NOT live-action, NOT CGI-realistic.`;
        const styleBlock = `STYLE: ${analysis.visualStyle}. Color Scheme: ${analysis.colorScheme}. 2D anime cinematic, vibrant colors, dynamic lighting, smooth animation, cel-shaded, hand-drawn aesthetic.`;
        const negatives = `NEGATIVE STYLE: no realism, no photorealism, no live-action look, no DSLR bokeh realism, no ray-traced CGI, no real human skin or pores, no text or subtitles on screen.`;
        const anchor = analysis?.randomContext?.nonce ? `CHARACTER ANCHOR CODE: ${analysis.randomContext.nonce}. Always keep the same face, fur pattern/colors, outfit, body proportions, and unique marks tied to this anchor.` : '';
        const hardRules = `RULES: Character appearance MUST be EXACTLY THE SAME in every scene (face, fur colors/patterns, outfit, body proportions, unique marks). ${anchor} NO text overlay, NO subtitles, NO voice-over, NO human speech; only visuals with ambient sounds/music. ${negatives}`;
        const sceneText = `SCENE ${segment.index} [${segment.timeRange}]: ${segment.focus || 'Anime scene'} — ${segment.prompt}`;
        return `${animeEnforce} ${charBlock} ${styleBlock} ${sceneText} ${hardRules}`;
    }

    async function processOne(index) {
        const seg = analysis.segments[index];
        console.log(`➡️  [Step 2] Segment ${index + 1}/${analysis.segments.length}: ${seg.timeRange} | ${seg.focus}`);
        const prompt = buildPromptForScene(seg, analysis.character);
        let retry = 0; const maxRetries = 8;
        while (retry < maxRetries) {
            try {
                const resp = await fetch(`${serverUrl}/api/create-video`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: prompt,
                        prompt,
                        aspectRatio: 'LANDSCAPE',
                        ...(LABS_COOKIES ? { labsCookies: LABS_COOKIES } : {}),
                        ...(VEO_PROJECT_ID ? { projectId: VEO_PROJECT_ID } : {})
                    })
                });
                const json = await resp.json();
                if (json && json.success && json.operationName) {
                    const resultObj = { segmentIndex: index, timeRange: seg.timeRange, focus: seg.focus, prompt, operationId: json.operationName, success: true };
                    monitorPromises.push(monitorAndDownload(resultObj, { maxAttempts: 100 }));
                    return resultObj;
                }
                throw new Error(json && json.message ? json.message : 'Create video failed');
            } catch (e) {
                retry++;
                console.log(`⚠️  Segment ${index + 1} retry ${retry}/${maxRetries}: ${e.message}`);
                if (retry < maxRetries) {
                    const waitTime = Math.pow(2, retry) * 1500; await sleep(waitTime);
                    if (String(e.message).match(/cookie|auth|unauthorized/i)) { cachedCookie = null; await getCachedOrFreshCookie(serverUrl); }
                }
            }
        }
        return { segmentIndex: index, timeRange: seg.timeRange, error: 'Failed after retries', success: false };
    }

    for (let start = 0; start < analysis.segments.length; start += CONCURRENCY) {
        const end = Math.min(start + CONCURRENCY, analysis.segments.length);
        const batchTasks = [];
        for (let i = start; i < end; i++) {
            const offset = i - start;
            batchTasks.push((async () => { if (offset > 0) await sleep(100 * offset); return await processOne(i); })());
        }
        const batchRes = await Promise.all(batchTasks);
        veo3Results.push(...batchRes);
        if (end < analysis.segments.length) await sleep(400);
    }

    const savePath = path.join(outputDir, 'veo-direct-prompts.json');
    fs.writeFileSync(savePath, JSON.stringify(veo3Results, null, 2), 'utf8');
    console.log(`✅ [Step 2] Đã lưu prompts gửi trực tiếp: ${savePath}`);

    return { veo3Results, monitorPromises };
}

// Bước 3: Theo dõi tải về và ghép video + chèn nhạc nếu có
async function mergeVideos(monitorPromises, outputDir) {
    console.log('🔄 [Step 3] Theo dõi và tải video...');
    let videoFiles = [];
    if (monitorPromises && monitorPromises.length > 0) videoFiles = await Promise.all(monitorPromises);
    const okFiles = videoFiles.filter(v => v.success && v.path && fs.existsSync(v.path));
    console.log(`✅ [Step 3] Video tải thành công: ${okFiles.length}`);
    if (okFiles.length === 0) throw new Error('Không có video nào được tải về');
    okFiles.sort((a, b) => a.segmentIndex - b.segmentIndex);

    const listPath = path.join(outputDir, 'video_list.txt');
    const listContent = okFiles.map(v => `file '${path.resolve(v.path).replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(listPath, listContent, 'utf8');

    const finalVideoPath = path.join(outputDir, `anime_5min_final_${Date.now()}.mp4`);
    const mergeCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${finalVideoPath}"`;
    await execAsync(mergeCmd);
    console.log(`🎉 Đã ghép video: ${finalVideoPath}`);

    // chèn nhạc nếu có Diamonds.mp3
    let resultFinalVideoPath = finalVideoPath;
    try {
        const musicPath = path.resolve(path.join(__dirname, 'Diamonds.mp3'));
        if (fs.existsSync(musicPath)) {
            const finalWithAudioPath = finalVideoPath.replace(/\.mp4$/i, '_with_audio.mp4');
            const videoHasAudio = await hasAudioStream(finalVideoPath);
            if (videoHasAudio) {
                const mixCmd = `ffmpeg -i "${finalVideoPath}" -stream_loop -1 -i "${musicPath}" -filter_complex "[0:a]volume=1.0[a0];[1:a]volume=0.5[a1];[a0][a1]amix=inputs=2:duration=shortest:dropout_transition=2[aout]" -map 0:v:0 -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest "${finalWithAudioPath}"`;
                await execAsync(mixCmd);
                resultFinalVideoPath = finalWithAudioPath;
                console.log(`🎵 Đã trộn nhạc nền: ${finalWithAudioPath}`);
            } else {
                const muxCmd = `ffmpeg -i "${finalVideoPath}" -stream_loop -1 -i "${musicPath}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest "${finalWithAudioPath}"`;
                await execAsync(muxCmd);
                resultFinalVideoPath = finalWithAudioPath;
                console.log(`🎵 Đã thêm nhạc nền: ${finalWithAudioPath}`);
            }
        }
    } catch (e) {
        console.log(`⚠️ Lỗi khi chèn nhạc: ${e.message}`);
    }

    return { finalVideoPath: resultFinalVideoPath, successfulVideos: okFiles };
}

// Main
async function main() {
    try {
        console.log(`🚀 [START] Tạo video anime 5 phút (${NUM_SEGMENTS} cảnh x ${SEGMENT_DURATION}s)...`);
        const { analysis, outputDir, serverUrl } = await createAnimeCharacterAndStory();
        const { veo3Results, monitorPromises } = await sendScenesToVeo3(analysis, outputDir, serverUrl);
        const { finalVideoPath, successfulVideos } = await mergeVideos(monitorPromises, outputDir);

        const result = {
            timestamp: new Date().toISOString(),
            overallTheme: analysis.overallTheme,
            colorScheme: analysis.colorScheme,
            visualStyle: analysis.visualStyle,
            character: analysis.character,
            segments: analysis.segments,
            veo3OperationsSent: veo3Results.filter(r => r.success).length,
            videosDownloaded: successfulVideos.length,
            finalVideo: finalVideoPath,
            outputDir
        };
        const resultPath = path.join(outputDir, 'anime-5min-result.json');
        fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');
        console.log(`📊 Lưu kết quả: ${resultPath}`);
        return { success: true, result };
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        return { success: false, error: error.message };
    }
}

if (require.main === module) {
    main().then(r => {
        if (r.success) {
            console.log('🎉 Hoàn thành thành công!');
            console.log(`🎉 Video: ${r.result.finalVideo}`);
        } else {
            console.log(`❌ Thất bại: ${r.error}`);
        }
    });
}

module.exports = { createAnimeCharacterAndStory, sendScenesToVeo3, mergeVideos, main };


