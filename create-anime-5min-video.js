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
        const timeout = setTimeout(() => controller.abort(), 180000);
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
        mainSetting: randomChoice(['đồi trà', 'sân thượng quán trà', 'thị trấn biển đêm', 'rừng tre cổ', 'khu chợ đèn lồng', 'ga tàu hơi nước', 'ven sông yên tĩnh', 'ruộng bậc thang', 'con dốc phố cổ', 'bến tàu nhỏ']),
        subSettings: pickN(['cầu treo gió lớn', 'hẻm đèn neon', 'vườn anh đào', 'quán trà trên đồi', 'thư viện bỏ hoang', 'đường ray bỏ dở', 'bờ biển sương mù', 'vách đá gió rít', 'ruộng bậc thang', 'giàn tre và gió chuông'], 3),
        genreTone: randomChoice(['ấm áp', 'phiêu lưu nhẹ', 'kỳ ảo', 'hài hước', 'truyền cảm hứng']),
        conflictType: randomChoice(['trả lại vật đánh mất', 'giúp đỡ người xa lạ', 'kết nối gia đình', 'khám phá ký ức', 'ghi lại vẻ đẹp đời thường']),
        antagonist: 'không có phản diện',
        colorPalette: randomChoice(['pastel ấm', 'vibrant tương phản', 'nocturne tím xanh', 'sunset cam hồng', 'aqua mát']),
        animationFlavor: randomChoice(['brush stroke nhẹ', 'cel-shade đậm', 'glow viền', 'hạt film nhẹ', 'bokeh mềm']),
        cameraStyles: pickN(['pan chậm', 'tilt lên', 'zoom nhấn', 'handheld nhẹ', 'track theo'], 2),
        musicVibe: randomChoice(['lofi ấm', 'orchestral nhẹ', 'guitar mộc', 'piano kể chuyện', 'synth mơ']),
        allowCrystals: Math.random() < 0.1, // chỉ 10% cho phép motif pha lê/đá quý
        allowSnowIce: Math.random() < 0.1 && randomChoice(['xuân','hạ','thu','đông']) === 'đông',
        nonce: makeNonce(),
        microActions: [
            'khuấy trà', 'thổi nguội tách trà', 'vuốt tóc', 'buộc lại dây tóc', 'điều chỉnh cổ áo', 'nhẹ nhàng đặt tay lên lan can tre', 'lật trang sổ tay', 'vẽ vài nét bút', 'nhặt chiếc lá rơi', 'chạm tay vào gió chuông', 'sửa quai túi', 'đặt balo xuống', 'đứng kiễng gót nhìn xa', 'hứng giọt mưa đầu mùa', 'lắc nhẹ cổ tay ngắm vòng tay'
        ],
        tactileDetails: [
            'ơi ấm của tách trà', 'mát nhám của gỗ cũ', 'lạnh nhẹ của gió núi', 'láng mịn của trang giấy', 'xốp mềm của bông hoa', 'khô ráp của dây thừng', 'mịn mát của viên sỏi', 'mềm rủ của vạt áo'
        ],
        environmentMotifs: [
            'đèn lồng giấy đung đưa', 'hơi nước mỏng từ ấm trà', 'mây chậm trôi', 'ánh nắng loang qua kẽ lá', 'tiếng chim xa', 'tiếng côn trùng nhẹ', 'bước chân xa trên đường ray bỏ dở', 'tiếng gió chuông ting tang'
        ],
        transitionStyles: ['match cut', 'whip pan nhẹ', 'dissolve chậm', 'rack focus', 'iris subtle', 'tilt reveal']
    };
    try { fs.writeFileSync(path.join(outputDir, 'random-context.json'), JSON.stringify(randomContext, null, 2), 'utf8'); } catch (_) {}

    console.log('📖 [Step 1] Tạo NHÂN VẬT anime người (Nhật) cực kỳ chi tiết...');
    const characterRes = await fetchOpenAIWithRetry({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'Bạn là nhà thiết kế nhân vật anime 2D phong cách Nhật Bản (slice-of-life, chill). Tạo MỘT NHÂN VẬT CON NGƯỜI dùng cho video 5 phút. Trả về JSON hợp lệ duy nhất.'
            },
            {
                role: 'user',
                content: `Tạo MỘT NHÂN VẬT anime CON NGƯỜI cực kỳ chi tiết, đi hai chân, dáng người, dùng xuyên suốt, giữ 100% nhất quán (không thay đổi khuôn mặt/tóc/màu da/trang phục/tỉ lệ cơ thể/đặc điểm).

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
  "species": "human",
  "age": string,
  "gender": string,
  "backstory": string,
  "personality": string,
  "skills": string,
  "weaknesses": string,
  "appearance": {
    "body": string,        // tỉ lệ cơ thể, dáng, chiều cao, vóc dáng
    "hair": string,        // kiểu tóc, màu tóc, độ dài, texture
    "eyes": string,        // màu mắt, hình dáng, độ long lanh
    "skin": string,        // tông da, đặc điểm nổi bật
    "uniqueMarks": string  // vết/điểm nhận dạng đặc biệt, vị trí cụ thể
  },
  "outfit": {
    "top": string,
    "bottom": string,
    "footwear": string,
    "accessories": string,
    "jewelry": string
  },
  "props": string,         // đồ vật đi kèm (ốp lưng điện thoại, túi, sách, tách trà...)
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
                content: 'Bạn là biên kịch anime 2D phong cách slice-of-life Nhật Bản (chill, ấm áp). Tạo câu chuyện 5 phút XUYÊN SUỐT (một cốt truyện duy nhất, có mục tiêu nhỏ, tiến trình, cao trào cảm xúc, kết thúc). Chia thành các cảnh 8 giây, mỗi cảnh là hệ quả logic của cảnh trước (nguyên nhân → hành động → kết quả → dẫn tới cảnh sau). CHỈ TRẢ VỀ MỘT JSON HỢP LỆ, KHÔNG kèm giải thích.'
            },
            {
                role: 'user',
                content: `Dùng nhân vật sau cho toàn bộ video, giữ NHẤT QUÁN 100% ngoại hình/trang phục/tỉ lệ/đặc điểm:
${JSON.stringify(character)}

YÊU CẦU CÂU CHUYỆN 5 PHÚT:
- Chủ đề tích cực, slice-of-life ấm áp, chill, không bạo lực; tập trung khoảnh khắc đời thường/thiên nhiên/thành phố và sự kết nối.
- Cấu trúc: Mở đầu (thiết lập không khí) → Phát triển (một mục tiêu nhỏ/việc cần làm) → Cao trào cảm xúc (khám phá/nhận ra điều ý nghĩa) → Kết thúc (dịu nhẹ, ấm áp)
- KHÔNG có chữ overlay, KHÔNG thoại/voice-over
- Phong cách: anime 2D cinematic Nhật Bản, ánh sáng mềm, bầu trời/ánh nắng/đêm đô thị; nhịp nhẹ.

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
 - Tránh chiến đấu/đối đầu nặng; ưu tiên cảm xúc, quan sát, khám phá nhỏ, chuyển cảnh đẹp (bầu trời, gió, ánh sáng, nước, thành phố).

TRẢ VỀ JSON:
{
  "overallTheme": string,
  "colorScheme": string,
  "visualStyle": string,
  "outline": string,
  "storyBeats": [ // nhịp truyện xuyên suốt
    { "beat": "thiết lập", "goal": string, "location": string },
    { "beat": "phát triển", "turningPoint": string },
    { "beat": "cao trào cảm xúc", "realization": string },
    { "beat": "kết thúc", "resolution": string }
  ],
  "propsPersistent": [string], // đồ vật/chi tiết sẽ xuất hiện nhiều cảnh (ví dụ: tách trà, sổ tay, vòng tay)
  "scenes": [
    { "index": 1, "timeStart": 0, "timeEnd": 8, "focus": string, "prompt": string },
    ... đủ ${NUM_SEGMENTS} cảnh, mỗi cảnh 8 giây liên tục, logic nối tiếp ...
  ]
}
`
            }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        temperature: 1.0
    });
    if (!outlineRes.choices) throw new Error('Không sinh được story');
    let outlineText = outlineRes.choices[0].message.content;
    let story;
    try {
        story = parseJsonFromText(outlineText, outputDir, 'story');
    } catch (e) {
        console.warn('⚠️ Parse story lần 1 thất bại. Thử lại với chế độ nghiêm ngặt...');
        const strictRes = await fetchOpenAIWithRetry({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Bạn trả về JSON hợp lệ duy nhất. Không thêm bất kỳ ký tự hoặc giải thích nào ngoài JSON.' },
                { role: 'user', content: `Sinh lại story 5 phút theo đúng yêu cầu dưới dạng MỘT JSON HỢP LỆ duy nhất (dùng dấu ":", "," chuẩn, KHÔNG dấu thừa, KHÔNG bình luận, KHÔNG markdown). Thuộc tính bắt buộc: overallTheme, colorScheme, visualStyle, outline, scenes (array ${NUM_SEGMENTS} phần tử với index, timeStart, timeEnd, focus, prompt).\n\nNhân vật:\n${JSON.stringify(character)}\n\nNgữ cảnh ngẫu nhiên:\n${JSON.stringify(randomContext)}\n` }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 3500,
            temperature: 0.3
        });
        if (!strictRes.choices) throw e;
        outlineText = strictRes.choices[0].message.content;
        story = parseJsonFromText(outlineText, outputDir, 'story');
    }

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
        storyBeats: Array.isArray(story.storyBeats) ? story.storyBeats : [],
        propsPersistent: Array.isArray(story.propsPersistent) ? story.propsPersistent : [],
        randomContext
    };
    fs.writeFileSync(path.join(outputDir, 'anime-story.json'), JSON.stringify(analysis, null, 2), 'utf8');
    console.log(`✅ [Step 1] Đã tạo ${analysis.segments.length} cảnh`);

    return { analysis, outputDir, serverUrl };
}

// Enrich scenes theo 2 batch để tăng chi tiết, giảm trùng lặp
async function enrichScenesInTwoBatches(analysis, outputDir) {
    console.log('🧪 [Step 1.5] Enrich chi tiết cảnh theo 2 batch...');
    const total = analysis.segments.length;
    const mid = Math.floor(total / 2);
    const batches = [
        { label: 'PHẦN 1', start: 0, end: mid },
        { label: 'PHẦN 2', start: mid, end: total }
    ];

    for (const b of batches) {
        const segs = analysis.segments.slice(b.start, b.end).map(s => ({ index: s.index, timeStart: s.timeStart, timeEnd: s.timeEnd, focus: s.focus, prompt: s.prompt }));
        const enrichRes = await fetchOpenAIWithRetry({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Bạn là đạo diễn anime 2D Nhật Bản (slice-of-life). ENRICH các cảnh chi tiết, vẫn giữ logic, giữ nguyên index/time. CHỈ TRẢ VỀ JSON hợp lệ (array). Mỗi phần tử phải có: index, timeStart, timeEnd, action, camera_style, lighting, environment_details, audio, mood, detailedPrompt, character_snapshot { hair_state, outfit_state, jewelry_glint, posture, expression, hands_item }. Hành động phải là MICRO-ACTIONS phong phú, đa dạng, không lặp từ/cụm từ trong vòng 5 cảnh liền kề. Phải kết hợp cảm giác xúc giác (tactile), motif môi trường, và kiểu transition. Không chèn chữ/voice. Cấm tuyết/băng/trụ băng trừ khi explicit allowSnowIce=true. Cấm kim cương/pha lê/đá quý trừ khi explicit allowCrystals=true.'
                },
                {
                    role: 'user',
                    content: `Ngữ cảnh nhân vật (NHẤT QUÁN 100%):\n${JSON.stringify(analysis.character)}\n\nBối cảnh ngẫu nhiên và phong cách:\n${JSON.stringify(analysis.randomContext)}\n\nChủ đề: ${analysis.overallTheme}\nPhong cách: ${analysis.visualStyle}\nMàu sắc: ${analysis.colorScheme}\n\nNHỊP TRUYỆN XUYÊN SUỐT (storyBeats):\n${JSON.stringify(analysis.storyBeats)}\nĐẠO CỤ XUYÊN SUỐT (propsPersistent):\n${JSON.stringify(analysis.propsPersistent)}\n\nMICRO-ACTIONS (tham khảo, chọn khác nhau giữa các cảnh):\n${JSON.stringify(analysis.randomContext.microActions)}\n\nTACTILE DETAILS (tham khảo):\n${JSON.stringify(analysis.randomContext.tactileDetails)}\n\nENVIRONMENT MOTIFS (tham khảo):\n${JSON.stringify(analysis.randomContext.environmentMotifs)}\n\nTRANSITION STYLES (tham khảo):\n${JSON.stringify(analysis.randomContext.transitionStyles)}\n\n${b.label}: Enrich ${segs.length} cảnh thành JSON ARRAY. GIỮ NGUYÊN index, timeStart, timeEnd. BẮT BUỘC TRẢ VỀ cho mỗi cảnh: action (micro-action giàu chi tiết, không lặp), camera_style, lighting, environment_details (kết hợp motif), audio, mood, detailedPrompt (1 câu sinh động, anime Nhật chill), character_snapshot { hair_state, outfit_state, jewelry_glint, posture, expression, hands_item }, continuity { carriesProps: [string], objectiveProgress: string, locationLink: string }. Mỗi cảnh PHẢI là hệ quả logic của cảnh trước và dẫn tới cảnh sau.\n\nRÀNG BUỘC: ${analysis.randomContext.allowCrystals ? 'được phép motif pha lê/đá quý nếu hợp lý' : 'cấm motif kim cương/pha lê/đá quý'}. ${analysis.randomContext.allowSnowIce ? 'được phép tuyết/băng nếu hợp lý' : 'cấm tuyết/băng/glacier/frosted surfaces'}. Cấm realistic/live-action, cấm chữ/voice.\n\nCảnh đầu vào:\n${JSON.stringify(segs)}`
                }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 3500,
            temperature: 0.7
        });
        if (!enrichRes.choices) continue;
        const content = enrichRes.choices[0].message.content;
        let enriched;
        try {
            enriched = parseJsonFromText(content, outputDir, `enrich-${b.label.replace(/\s+/g,'-')}`);
        } catch (_) {
            // fallback: giữ nguyên nếu parse lỗi
            continue;
        }
        let arr = Array.isArray(enriched) ? enriched : (Array.isArray(enriched.scenes) ? enriched.scenes : null);
        if (!arr) continue;
        // Gán lại vào segments
        for (const item of arr) {
            const idx = (item.index | 0) - 1;
            if (idx >= 0 && idx < analysis.segments.length) {
                const seg = analysis.segments[idx];
                seg.action = item.action || seg.action;
                seg.camera_style = item.camera_style || seg.camera_style;
                seg.lighting = item.lighting || seg.lighting;
                seg.environment_details = item.environment_details || seg.environment_details;
                seg.audio = item.audio || seg.audio;
                seg.mood = item.mood || seg.mood;
                if (item.detailedPrompt) seg.enrichedPrompt = item.detailedPrompt;
                if (item.character_snapshot) seg.character_snapshot = item.character_snapshot;
                if (item.continuity) seg.continuity = item.continuity;
            }
        }
    }

    // Lưu lại bản enrich để kiểm tra
    try { fs.writeFileSync(path.join(outputDir, 'anime-story-enriched.json'), JSON.stringify(analysis, null, 2), 'utf8'); } catch (_) {}
    console.log('✅ [Step 1.5] Enrich xong (2 batch).');
    return analysis;
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
        const charBlock = `CHARACTER (MUST REMAIN IDENTICAL IN ALL SCENES): ${character.name} — species: ${character.species}. Body: ${character.appearance?.body || 'slender human proportions, average height'}. Hair: ${character.appearance?.hair || 'soft, natural, anime style'}. Eyes: ${character.appearance?.eyes || 'bright anime eyes'}. Skin: ${character.appearance?.skin || 'natural tone'}. Unique marks: ${character.appearance?.uniqueMarks || 'subtle distinctive mark'}. Outfit: top ${character.outfit?.top || 'casual top'}, bottom ${character.outfit?.bottom || 'comfortable bottom'}, footwear ${character.outfit?.footwear || 'casual shoes'}, accessories ${character.outfit?.accessories || 'minimal accessories'}, jewelry ${character.outfit?.jewelry || 'simple jewelry'}. Props: ${character.props || 'small daily-life item'}. Color palette: ${character.colorPalette || 'soft, warm hues'}. Personality: ${character.personality || 'gentle and reflective'}.`;
        const animeEnforce = `ANIME STYLE ENFORCEMENT: Japanese 2D anime, hand-drawn/cel-shaded, slice-of-life, chill and gentle pacing, soft ambient lighting, sky gradients, subtle light bloom and lens haze, clean line art, atmospheric depth. Inspired by modern Japanese anime films (cityscapes, skies, tender color grading). Absolutely NOT realistic, NOT photorealistic, NOT live-action, NOT CGI-realistic.`;
        const styleBlock = `STYLE: ${analysis.visualStyle}. Color Scheme: ${analysis.colorScheme}. Japanese slice-of-life anime, calm and cinematic composition, soft gradients, pastel-to-vibrant skies, gentle camera moves, smooth limited animation.`;
        const crystalBan = analysis?.randomContext?.allowCrystals ? '' : ', no gems, no diamonds, no crystals, no jewel motifs';
        const snowIceBan = analysis?.randomContext?.allowSnowIce ? '' : ', no snow, no ice, no glacier, no frosted surfaces';
        const negatives = `NEGATIVE STYLE: no realism, no photorealism, no live-action look, no DSLR bokeh realism, no ray-traced CGI, no real human skin or pores, no text or subtitles on screen${crystalBan}${snowIceBan}.`;
        const anchor = analysis?.randomContext?.nonce ? `CHARACTER ANCHOR CODE: ${analysis.randomContext.nonce}. Always keep the same face, fur pattern/colors, outfit, body proportions, and unique marks tied to this anchor.` : '';

        // Chi tiết cảnh theo index để đa dạng and consistent với randomContext
        const rc = analysis.randomContext || {};
        const shotTypes = ['wide establishing', 'medium tracking', 'close-up emotional', 'over-the-shoulder', 'low-angle wide', 'high-angle contemplative', 'profile medium', 'POV gentle', 'two-shot balanced'];
        const lenses = ['24mm', '28mm', '35mm', '50mm', '85mm'];
        const movements = rc.cameraStyles || ['pan chậm', 'tilt lên', 'zoom nhấn', 'handheld nhẹ', 'track theo'];
        const shotType = shotTypes[segment.index % shotTypes.length];
        const lens = lenses[segment.index % lenses.length];
        const move = movements[segment.index % movements.length];
        const weather = rc.season === 'đông' ? 'lạnh, gió nhẹ' : rc.season === 'hạ' ? 'ấm, gió mát' : rc.season === 'thu' ? 'dịu, gió hiu hiu' : 'mát, không khí trong';
        const timeLabel = rc.timeOfDay || 'chiều muộn';
        const envBase = rc.mainSetting || 'thành phố Nhật yên bình';
        const envSubs = Array.isArray(rc.subSettings) && rc.subSettings.length > 0 ? rc.subSettings.join(', ') : 'hàng cây, bầu trời nhiều mây, phố nhỏ';
        const colorFlavor = rc.colorPalette ? `color grade theo bảng màu ${rc.colorPalette}` : 'màu pastel ấm, trời gradient';
        const animFlavor = rc.animationFlavor ? `animation flavor: ${rc.animationFlavor}` : 'cel-shade đậm, viền sạch';

        // Continuity từ segment trước/sau
        const prev = analysis.segments[segment.index - 2];
        const next = analysis.segments[segment.index];
        const carriesProps = Array.isArray(analysis.propsPersistent) && analysis.propsPersistent.length ? `CARRIED PROPS: ${analysis.propsPersistent.join(', ')}` : '';
        const continuityMeta = segment.continuity ? `Objective=${segment.continuity.objectiveProgress || 'progressing'}, Link=${segment.continuity.locationLink || 'smooth link'}, Carries=${Array.isArray(segment.continuity.carriesProps) ? segment.continuity.carriesProps.join(', ') : ''}.` : '';
        const continuity = `${prev ? `CONTINUITY PREV: ${prev.timeRange} - ${prev.focus}.` : 'OPENING: gentle fade-in.'} ${next ? `CONTINUITY NEXT: ${next.timeRange} - ${next.focus}.` : 'ENDING: gentle fade-out.'} ${carriesProps} ${continuityMeta}`;

        const sceneBlueprint = `SCENE BLUEPRINT: shot=${shotType}, lens=${lens}, cameraMove=${move}, composition=rule-of-thirds with strong leading lines and layered depth, lighting=soft ambient with rim light and sky glow, ${colorFlavor}, environment=${envBase} (details: ${envSubs}), timeOfDay=${timeLabel}, weather=${weather}, backgroundAction=subtle everyday motion (leaves, signage flicker, distant traffic), transition=smooth dissolve.`;

        // Template guide theo yêu cầu người dùng
        const templateGuide = `SCENE STRUCTURE TEMPLATE: title='${envBase} – tranquil moment', character={ name: ${character.name}, ethnicity: 'Japanese (anime style)', age: ${character.age || 'young adult'}, appearance: 'hair detail consistent with character, outfit as described, posture relaxed', expression: 'peaceful, soft contentment' }, setting={ location: '${envBase}', time_of_day: '${timeLabel}', environment_details: '${envSubs}' , weather: '${weather}' }, action='gentle everyday action (e.g., sip tea, gaze at view, adjust hair)', camera_style='${shotType} transitioning to wide panorama', lighting='soft golden tones with subtle glints and steam when applicable', audio='ambient: wind chime, distant birds, soft city hum', mood='serene, restful conclusion — serenity in simplicity'`;

        // Ưu tiên enrichedPrompt nếu có
        const enriched = segment.enrichedPrompt ? `ENRICHED: ${segment.enrichedPrompt}` : '';
        const enrichedMetaParts = [];
        if (segment.action) enrichedMetaParts.push(`action=${segment.action}`);
        if (segment.camera_style) enrichedMetaParts.push(`camera_style=${segment.camera_style}`);
        if (segment.lighting) enrichedMetaParts.push(`lighting=${segment.lighting}`);
        if (segment.environment_details) enrichedMetaParts.push(`environment=${segment.environment_details}`);
        if (segment.audio) enrichedMetaParts.push(`audio=${segment.audio}`);
        if (segment.mood) enrichedMetaParts.push(`mood=${segment.mood}`);
        const enrichedMeta = enrichedMetaParts.length ? `ENRICH META: ${enrichedMetaParts.join(', ')}.` : '';

        const hardRules = `RULES: Character appearance MUST be EXACTLY THE SAME in every scene (face, fur colors/patterns, outfit, body proportions, unique marks). ${anchor} NO text overlay, NO subtitles, NO voice-over, NO human speech; only visuals with ambient sounds/music. ${negatives}`;
        const baseLine = segment.enrichedPrompt ? segment.enrichedPrompt : (segment.prompt || 'slice-of-life anime moment');
        // Ảnh chụp nhân vật theo cảnh (ép hiển thị chi tiết trong từng cảnh)
        const expr = segment.mood || 'soft contentment';
        const charSnapshot = `CHARACTER PER-SCENE SNAPSHOT: hair=${character.appearance?.hair || 'anime hair, slightly wind-ruffled'}, outfit=${character.outfit?.top},${character.outfit?.bottom}, jewelry=${character.outfit?.jewelry || 'subtle glint'}, posture=relaxed natural posture, hands_item=${character.props || 'teacup / notebook'}, expression=${expr}.`;

        const sceneText = `SCENE ${segment.index} [${segment.timeRange}]: ${segment.focus || 'Anime scene'} — ${baseLine}. MOOD: chill, serene, heartwarming, everyday wonder.`;
        return `${animeEnforce} ${charBlock} ${charSnapshot} ${styleBlock} ${animFlavor}. ${sceneBlueprint} ${templateGuide}. ${continuity} ${sceneText} ${enriched} ${enrichedMeta} ${hardRules}`;
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

    // Không chèn/mix nhạc nền (yêu cầu: giữ nguyên âm thanh gốc hoặc im lặng)
    return { finalVideoPath, successfulVideos: okFiles };
}

// Main
async function main() {
    try {
        console.log(`🚀 [START] Tạo video anime 5 phút (${NUM_SEGMENTS} cảnh x ${SEGMENT_DURATION}s)...`);
        const { analysis, outputDir, serverUrl } = await createAnimeCharacterAndStory();
        await enrichScenesInTwoBatches(analysis, outputDir);
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


