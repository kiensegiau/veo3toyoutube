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

// Bước 1: Tạo nhân vật người thật châu Âu cực kỳ chi tiết + story 5 phút
async function createAnimeCharacterAndStory() {
    const serverUrl = 'http://localhost:8888';
    const outputDir = './temp/anime-5min-video';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Tạo bối cảnh ngẫu nhiên để đảm bảo khác nhau mỗi lần chạy
    const randomContext = {
        season: randomChoice(['xuân', 'hạ', 'thu', 'đông']),
        timeOfDay: randomChoice(['bình minh', 'sáng', 'trưa', 'chiều', 'hoàng hôn', 'đêm']),
        mainSetting: randomChoice([
            'rừng sâu', 'thành phố', 'ven sông', 'bờ biển', 'núi rừng', 'cánh đồng',
            'ngọn núi', 'thung lũng', 'bờ sông', 'bãi biển', 'đồng lúa',
            'phố cổ châu Âu', 'khu phố hiện đại', 'công viên', 'vườn hoa', 'đường mòn rừng',
            'thị trấn ven biển', 'làng quê', 'đồng cỏ', 'rừng thông', 'hồ nước yên tĩnh',
            'bờ hồ', 'đồi cỏ', 'thung lũng sông', 'bờ đá', 'cánh đồng hoa'
        ]),
        subSettings: pickN([
            'cầu đá cổ', 'hẻm phố cổ', 'quảng trường', 'nhà thờ cổ', 
            'thư viện bỏ hoang', 'đường ray tàu', 'bờ biển sương mù', 'vách đá gió rít', 
            'ruộng lúa', 'cối xay gió', 'dòng suối nhỏ', 'thác nước',
            'hang động nhỏ', 'cây cầu đá', 'bến cảng', 'chợ cá', 'quán cà phê góc phố',
            'công viên ven sông', 'bờ đê', 'đường mòn núi', 'đỉnh đồi', 'bãi cỏ',
            'khu vườn nhỏ', 'hẻm núi', 'bờ kè', 'cầu thang đá', 'lối đi rừng',
            'phố đi bộ', 'quảng trường nhỏ', 'bến tàu', 'cầu treo', 'tháp cổ'
        ], 4),
        genreTone: randomChoice(['ấm áp', 'phiêu lưu nhẹ', 'kỳ ảo', 'hài hước', 'truyền cảm hứng']),
        conflictType: randomChoice(['trả lại vật đánh mất', 'giúp đỡ người xa lạ', 'kết nối gia đình', 'khám phá ký ức', 'ghi lại vẻ đẹp đời thường']),
        antagonist: 'không có phản diện',
        colorPalette: randomChoice(['pastel ấm', 'vibrant tương phản', 'nocturne tím xanh', 'sunset cam hồng', 'aqua mát']),
        animationFlavor: randomChoice(['natural cinematography', 'documentary style', 'cinematic depth', 'film grain subtle', 'bokeh soft']),
        cameraStyles: pickN(['pan chậm', 'tilt lên', 'zoom nhấn', 'handheld nhẹ', 'track theo'], 2),
        musicVibe: randomChoice(['lofi ấm', 'orchestral nhẹ', 'guitar mộc', 'piano kể chuyện', 'synth mơ']),
        allowCrystals: Math.random() < 0.1, // chỉ 10% cho phép motif pha lê/đá quý
        allowSnowIce: Math.random() < 0.1 && randomChoice(['xuân','hạ','thu','đông']) === 'đông',
        nonce: makeNonce() 
    };
    try { fs.writeFileSync(path.join(outputDir, 'random-context.json'), JSON.stringify(randomContext, null, 2), 'utf8'); } catch (_) {}

    console.log('📖 [Step 1] Tạo NHÂN VẬT người thật châu Âu cực kỳ chi tiết...');
    const characterRes = await fetchOpenAIWithRetry({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'Bạn là casting director cho phim live-action châu Âu. Tạo MỘT NHÂN VẬT CON NGƯỜI THẬT XINH ĐẸP (người châu Âu, không phải anime/hoạt hình) dùng cho video 5 phút. Nhân vật phải có vẻ đẹp tự nhiên, quyến rũ, hấp dẫn. Chỉ tạo ngoại hình chi tiết (khuôn mặt, tóc, mắt, da, trang phục). Việc cầm vật gì trong tay sẽ được quyết định dựa trên hành động và bối cảnh của từng cảnh ở bước sau. Trả về JSON hợp lệ duy nhất.'
            },
            {
                role: 'user',
                content: `Tạo MỘT NHÂN VẬT CON NGƯỜI THẬT CHÂU ÂU XINH ĐẸP cực kỳ chi tiết, đi hai chân, dáng người thật, dùng xuyên suốt, giữ 100% nhất quán (không thay đổi khuôn mặt/tóc/màu da/trang phục/tỉ lệ cơ thể/đặc điểm). NHÂN VẬT PHẢI LÀ NGƯỜI THẬT XINH ĐẸP, QUYẾN RŨ, KHÔNG PHẢI ANIME/HOẠT HÌNH. Mô tả chi tiết vẻ đẹp tự nhiên: khuôn mặt hài hòa, làn da mịn màng, đôi mắt sáng, nụ cười tươi, dáng người cân đối, phong cách thời trang thanh lịch. CHỈ tạo ngoại hình chi tiết (khuôn mặt, tóc, mắt, da, trang phục). Việc cầm vật gì trong tay sẽ được quyết định dựa trên hành động và bối cảnh của từng cảnh ở bước sau.

YẾU TỐ NGẪU NHIÊN (để đảm bảo KHÁC BIỆT mỗi lần chạy, bắt buộc đưa vào mô tả):
- Mùa: ${randomContext.season}
- Thời điểm: ${randomContext.timeOfDay}
- Bối cảnh chính: ${randomContext.mainSetting}
- Phụ bối cảnh: ${randomContext.subSettings.join(', ')}
- Tông thể loại: ${randomContext.genreTone}
- Kiểu xung đột: ${randomContext.conflictType}
- Đối tượng đối kháng: ${randomContext.antagonist}
- Bảng màu: ${randomContext.colorPalette}
- Phong cách quay phim: ${randomContext.animationFlavor}
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
    "body": string,        // tỉ lệ cơ thể cân đối, dáng người đẹp, chiều cao, vóc dáng quyến rũ
    "hair": string,        // kiểu tóc đẹp, màu tóc tự nhiên, độ dài, texture mượt mà
    "eyes": string,        // màu mắt đẹp, hình dáng hấp dẫn, độ long lanh, biểu cảm
    "skin": string,        // tông da mịn màng, sáng, đẹp tự nhiên, đặc điểm nổi bật
    "uniqueMarks": string  // vết/điểm nhận dạng đặc biệt (có thể là nốt ruồi duyên, đường nét đẹp), vị trí cụ thể
  },
  "outfit": {
    "top": string,
    "bottom": string,
    "footwear": string,
    "accessories": string,
    "jewelry": string
  },
  "colorPalette": string,  // bảng màu chủ đạo
  "animationStyle": "photorealistic live-action, European cinema style, natural lighting"
}

LƯU Ý:
- Mô tả phải cực kỳ cụ thể, rõ từng chi tiết, dùng xuyên suốt tất cả cảnh.
- Phải lồng ghép các YẾU TỐ NGẪU NHIÊN ở trên vào thiết kế nhân vật để đảm bảo tính độc nhất.
- Việc cầm vật gì trong tay (nếu có) sẽ được ChatGPT quyết định dựa trên hành động và bối cảnh của từng cảnh ở bước enrich.`
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
                content: 'Bạn là biên kịch phim live-action châu Âu (cinematic, natural, slice-of-life). Tạo câu chuyện 5 phút XUYÊN SUỐT (một cốt truyện duy nhất, có mục tiêu nhỏ, NHIỀU SỰ KIỆN, tiến trình, cao trào cảm xúc, kết thúc). Chia thành các cảnh 8 giây, mỗi cảnh phải có SỰ KIỆN/HÀNH ĐỘNG CỤ THỂ và là hệ quả logic của cảnh trước (nguyên nhân → hành động → kết quả → dẫn tới cảnh sau). CẢNH PHẢI ĐA DẠNG VỀ ĐỊA ĐIỂM - không được lặp lại cùng một địa điểm trong nhiều cảnh liên tiếp. CHỈ TRẢ VỀ MỘT JSON HỢP LỆ, KHÔNG kèm giải thích.'
            },
            {
                role: 'user',
                content: `Dùng nhân vật sau cho toàn bộ video, giữ NHẤT QUÁN 100% ngoại hình/trang phục/tỉ lệ/đặc điểm:
${JSON.stringify(character)}

YÊU CẦU CÂU CHUYỆN 5 PHÚT:
- Chủ đề tích cực, slice-of-life ấm áp, chill, không bạo lực; tập trung khoảnh khắc đời thường/thiên nhiên/thành phố và sự kết nối.
- Cấu trúc: Mở đầu (thiết lập không khí) → Phát triển (một mục tiêu nhỏ/việc cần làm, NHIỀU SỰ KIỆN XẢY RA) → Cao trào cảm xúc (khám phá/nhận ra điều ý nghĩa, CÓ TÌNH HUỐNG ĐẶC BIỆT) → Kết thúc (dịu nhẹ, ấm áp, CÓ KẾT QUẢ)
- QUAN TRỌNG: Câu chuyện phải có NHIỀU SỰ KIỆN, NHIỀU HÀNH ĐỘNG KHÁC NHAU. Mỗi cảnh phải có sự kiện/hành động cụ thể (không phải chỉ đi bộ/ngắm cảnh). Ví dụ: nhặt vật, gặp ai đó, phát hiện điều gì, giải quyết vấn đề, khám phá nơi mới, v.v. CẢNH PHẢI ĐA DẠNG VỀ ĐỊA ĐIỂM - không được lặp lại cùng một địa điểm trong nhiều cảnh liên tiếp (ví dụ: không được có 5-10 cảnh liên tiếp trong cùng một vườn hoa).
- KHÔNG có chữ overlay, KHÔNG thoại/voice-over
- Phong cách: phim live-action châu Âu, photorealistic, ánh sáng tự nhiên, bầu trời/ánh nắng/đêm đô thị; nhịp nhẹ, cinematic.

YẾU TỐ NGẪU NHIÊN (đảm bảo câu chuyện KHÁC BIỆT mỗi lần chạy; phải được dệt vào bối cảnh/cảnh/nhịp):
- Mùa: ${randomContext.season}; Thời điểm: ${randomContext.timeOfDay}
- Bối cảnh chính: ${randomContext.mainSetting}; Phụ bối cảnh: ${randomContext.subSettings.join(', ')}
- Tông thể loại: ${randomContext.genreTone}; Xung đột: ${randomContext.conflictType}; Đối kháng: ${randomContext.antagonist}
- Bảng màu: ${randomContext.colorPalette}; Phong cách quay phim: ${randomContext.animationFlavor}
- Camera: ${randomContext.cameraStyles.join(', ')}; Nhạc: ${randomContext.musicVibe}
- NONCE: ${randomContext.nonce}

QUY TẮC ĐA DẠNG & LOGIC:
- Mỗi cảnh 8s phải có SỰ KIỆN/HÀNH ĐỘNG CỤ THỂ và góp phần vào tiến trình câu chuyện; bối cảnh và hành động thay đổi hợp lý. KHÔNG được để cảnh chỉ là "đi bộ", "ngắm cảnh" - phải có hành động cụ thể (nhặt vật, mở cửa, gặp ai, phát hiện gì, v.v.).
- BỐI CẢNH PHẢI ĐA DẠNG VÀ THAY ĐỔI LIÊN TỤC: Nhân vật phải di chuyển giữa NHIỀU địa điểm khác nhau (rừng sâu, thành phố, sông, biển, núi, đồng, v.v.) - KHÔNG được lặp lại cùng một địa điểm trong nhiều cảnh liên tiếp (ví dụ: không được có 3+ cảnh liên tiếp trong cùng một vườn hoa). Mỗi nhóm 5-7 cảnh phải có ít nhất 3-4 địa điểm khác nhau. Sự chuyển đổi phải có LOGIC (ví dụ: từ rừng sâu → ven sông → bờ biển là hợp lý; từ rừng sâu → thành phố → biển là hợp lý nếu có phương tiện hoặc đường đi).
- Sự chuyển đổi giữa các bối cảnh phải TỰ NHIÊN và PHỤC VỤ câu chuyện (ví dụ: nhân vật đi tìm kiếm → di chuyển từ nơi này sang nơi khác; nhân vật khám phá → ghé qua nhiều địa điểm).
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
        if (!scenes[i]) scenes[i] = { index: i + 1, timeStart: i * SEGMENT_DURATION, timeEnd: (i + 1) * SEGMENT_DURATION, focus: `Scene ${i + 1}`, prompt: `Live-action scene ${i + 1}` };
        scenes[i].index = i + 1;
        scenes[i].timeStart = i * SEGMENT_DURATION;
        scenes[i].timeEnd = (i + 1) * SEGMENT_DURATION;
        scenes[i].timeRange = `${scenes[i].timeStart}-${scenes[i].timeEnd}s`;
    }

    const analysis = {
        overallTheme: story.overallTheme || 'European Cinematic Adventure',
        colorScheme: story.colorScheme || `Natural, cinematic tones (${randomContext.colorPalette})`,
        visualStyle: story.visualStyle || `photorealistic live-action, European cinema style, natural lighting (${randomContext.animationFlavor})`,
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
                    content: 'Bạn là đạo diễn phim live-action châu Âu (cinematic, natural, slice-of-life). ENRICH các cảnh chi tiết, vẫn giữ logic, giữ nguyên index/time. CHỈ TRẢ VỀ JSON hợp lệ (array). Mỗi phần tử phải có: index, timeStart, timeEnd, action, camera_style, lighting, environment_details, audio, mood, detailedPrompt, character_snapshot { hair_state, outfit_state, jewelry_glint, posture, expression, hands_item }, continuity { carriesProps: [string], objectiveProgress: string, locationLink: string }, microLocation. Hành động phải là micro-actions đa dạng, KHÔNG LẶP trong cửa sổ 7 cảnh. QUAN TRỌNG: Địa điểm/bối cảnh vi mô (microLocation) PHẢI ĐA DẠNG - KHÔNG được lặp lại cùng một địa điểm trong nhiều cảnh liên tiếp (ví dụ: không được có 3+ cảnh liên tiếp trong cùng một vườn hoa). Mỗi nhóm 5-7 cảnh phải có ít nhất 3-4 địa điểm khác nhau. Địa điểm phải đa dạng theo mainSetting/subSettings. Không chèn chữ/voice. Cấm tuyết/băng trừ khi allowSnowIce=true. Cấm kim cương/pha lê/đá quý trừ khi allowCrystals=true. Cấm hành động uống/nhấp/khuấy (uống nước/uống trà/sip/drink/stir) trừ khi xuất hiện duy nhất 1 lần toàn video. QUAN TRỌNG VỀ hands_item: BẠN PHẢI TỰ QUYẾT ĐỊNH hands_item dựa trên action và bối cảnh của từng cảnh. hands_item PHẢI THAY ĐỔI HOÀN TOÀN theo từng cảnh và PHẢI PHÙ HỢP với action và environment. KHÔNG được lặp lại cùng một hands_item trong nhiều cảnh liên tiếp. KHÔNG được để nhân vật luôn cầm cùng một vật (như giỏ hoa, cốc, v.v.) trong mọi cảnh. Nhiều cảnh nên có "empty hands" hoặc tay tự nhiên. Chỉ cầm vật khi action thực sự yêu cầu (ví dụ: action "nhặt bình" thì cầm bình, action "mở cửa" thì tay đưa ra mở cửa, action "chạy" thì tay vung tự nhiên, action "ngắm cảnh" thì empty hands hoặc tay đặt lên lan can). hands_item phải ĐA DẠNG, TỰ NHIÊN và LOGIC với action. QUAN TRỌNG VỀ continuity: continuity PHẢI đảm bảo mỗi cảnh là hệ quả logic của cảnh trước và dẫn tới cảnh sau. objectiveProgress phải thể hiện tiến trình của mục tiêu (ví dụ: "đang tìm kiếm", "phát hiện manh mối", "đạt được mục tiêu"). locationLink PHẢI THỂ HIỆN SỰ CHUYỂN ĐỔI VỊ TRÍ TỰ NHIÊN VÀ LOGIC - phải di chuyển giữa NHIỀU địa điểm khác nhau (rừng sâu, thành phố, sông, biển, núi, đồng, v.v.) - KHÔNG được lặp lại cùng một địa điểm trong nhiều cảnh liên tiếp (ví dụ: "từ rừng sâu dọc theo dòng suối đến ven sông", "từ ven sông đi dọc bờ đến bờ biển", "từ thành phố qua cánh đồng đến núi", "từ núi xuống thung lũng", "từ thung lũng đến bờ sông" - KHÔNG được "trong cùng khu vườn" nhiều lần). KHÔNG được nhảy cóc không logic. carriesProps phải phù hợp với action (chỉ thêm vào nếu action thực sự yêu cầu cầm vật, không phải cứ có propsPersistent là phải cầm). Không được thay đổi nhân vật gốc. PHONG CÁCH: photorealistic live-action, không phải anime/hoạt hình.'
                },
                {
                    role: 'user',
                    content: `Nhân vật GỐC (không được đổi):\n${JSON.stringify(analysis.character)}\n\nNgẫu nhiên & phong cách (bắt buộc dùng trong phân phối):\n${JSON.stringify(analysis.randomContext)}\n\nChủ đề: ${analysis.overallTheme}\nPhong cách: ${analysis.visualStyle}\nMàu sắc: ${analysis.colorScheme}\n\nNHỊP TRUYỆN XUYÊN SUỐT (storyBeats):\n${JSON.stringify(analysis.storyBeats)}\nĐẠO CỤ XUYÊN SUỐT (propsPersistent):\n${JSON.stringify(analysis.propsPersistent)}\n\n${b.label}: Enrich ${segs.length} cảnh thành JSON ARRAY. GIỮ NGUYÊN index, timeStart, timeEnd. BẮT BUỘC CHO MỖI CẢNH: action (micro-action cụ thể, KHÔNG LẶP trong 7 cảnh, phải có SỰ KIỆN/HÀNH ĐỘNG cụ thể - không phải chỉ "đi bộ" hay "ngắm cảnh"), camera_style, lighting, environment_details (đa dạng, gắn với bối cảnh), audio, mood, detailedPrompt (1 câu sinh động), character_snapshot { hair_state, outfit_state, jewelry_glint, posture, expression, hands_item (QUAN TRỌNG: BẠN PHẢI TỰ QUYẾT ĐỊNH hands_item dựa trên action và bối cảnh của từng cảnh. hands_item PHẢI THAY ĐỔI HOÀN TOÀN theo từng cảnh, KHÔNG được lặp lại. KHÔNG được để nhân vật luôn cầm cùng một vật (như giỏ hoa, cốc, v.v.) trong mọi cảnh. Nhiều cảnh nên có "empty hands" hoặc tay tự nhiên. Chỉ cầm vật khi action thực sự yêu cầu. Ví dụ: action "nhặt bình" → hands_item="cầm bình nhỏ", action "tìm kiếm" → hands_item="tay đưa ra tìm kiếm, tay trống", action "ngắm cảnh" → hands_item="empty hands, tay đặt lên lan can hoặc tay thả lỏng", action "chạy" → hands_item="tay vung tự nhiên khi chạy", action "mở cửa" → hands_item="tay đưa ra mở cửa", action "nhìn lên trời" → hands_item="tay đưa lên che mắt hoặc tay trống", action "ngồi" → hands_item="empty hands, tay đặt tự nhiên trên đùi", action "đi bộ" → hands_item="empty hands, tay vung tự nhiên". ĐA DẠNG, TỰ NHIÊN, KHÔNG LẶP LẠI) }, continuity { carriesProps: [string] (CHỈ thêm vào nếu action thực sự yêu cầu cầm vật, không phải cứ có propsPersistent là phải cầm. Nếu action không yêu cầu cầm vật, để rỗng []), objectiveProgress: string (BẮT BUỘC: thể hiện tiến trình của mục tiêu - ví dụ: "đang tìm kiếm", "phát hiện manh mối", "đạt được mục tiêu", "tiếp tục hành trình"), locationLink: string (BẮT BUỘC: thể hiện sự chuyển đổi vị trí TỰ NHIÊN VÀ LOGIC so với cảnh trước - PHẢI DI CHUYỂN giữa NHIỀU địa điểm khác nhau (rừng sâu, thành phố, sông, biển, núi, đồng, v.v.) - KHÔNG được lặp lại cùng một địa điểm trong nhiều cảnh liên tiếp - ví dụ: "từ rừng sâu dọc theo dòng suối đến ven sông", "từ ven sông đi dọc bờ đến bờ biển", "từ thành phố qua cánh đồng đến núi", "từ núi xuống thung lũng", "từ thung lũng đến bờ sông" - KHÔNG được "trong cùng khu vườn" nhiều lần. KHÔNG được nhảy cóc không logic) }, microLocation (tên vi mô của địa điểm; BẮT BUỘC ĐA DẠNG - tự nghĩ đa dạng từ mainSetting/subSettings, KHÔNG được lặp lại cùng một địa điểm trong nhiều cảnh liên tiếp).\n\nLƯU Ý: Batch chỉ xử lý ACTION/ĐỊA ĐIỂM/BỐI CẢNH và continuity. NHÂN VẬT sẽ GHÉP RIÊNG từ bước 1 khi render Veo 3, do đó không được thay đổi nhân vật gốc.\n\nRÀNG BUỘC: ${analysis.randomContext.allowCrystals ? 'được phép motif pha lê/đá quý nếu hợp lý' : 'cấm motif kim cương/pha lê/đá quý'}. ${analysis.randomContext.allowSnowIce ? 'được phép tuyết/băng nếu hợp lý' : 'cấm tuyết/băng/glacier/frosted surfaces'}. BẮT BUỘC photorealistic live-action, cấm anime/hoạt hình, cấm chữ/voice.\n\nCảnh đầu vào:\n${JSON.stringify(segs)}`
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
                if (item.microLocation) seg.microLocation = item.microLocation;
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
        const charBlock = `CHARACTER (MUST REMAIN IDENTICAL IN ALL SCENES): ${character.name} — species: ${character.species}. Body: ${character.appearance?.body || 'slender, beautiful proportions, attractive height'}. Hair: ${character.appearance?.hair || 'soft, natural, beautiful European hair'}. Eyes: ${character.appearance?.eyes || 'beautiful, natural European eyes'}. Skin: ${character.appearance?.skin || 'beautiful, natural European skin tone, smooth and radiant'}. Unique marks: ${character.appearance?.uniqueMarks || 'subtle distinctive mark'}. Outfit: top ${character.outfit?.top || 'elegant, fashionable top'}, bottom ${character.outfit?.bottom || 'stylish bottom'}, footwear ${character.outfit?.footwear || 'fashionable shoes'}, accessories ${character.outfit?.accessories || 'elegant accessories'}, jewelry ${character.outfit?.jewelry || 'beautiful jewelry'}. Color palette: ${character.colorPalette || 'soft, warm hues'}. Personality: ${character.personality || 'gentle and reflective'}. CHARACTER IS BEAUTIFUL, ATTRACTIVE, ELEGANT.`;
        const liveActionEnforce = `PHOTOREALISTIC LIVE-ACTION ENFORCEMENT: European live-action cinema, photorealistic, natural lighting, cinematic composition, real human skin texture and pores, realistic facial features, natural hair movement, authentic clothing fabrics, realistic environmental details. Inspired by European cinema (French New Wave, Italian neorealism, Scandinavian cinema). ABSOLUTELY REALISTIC, PHOTOREALISTIC, LIVE-ACTION, NO animation, NO anime, NO cartoon, NO cel-shading, NO hand-drawn style.`;
        const styleBlock = `STYLE: ${analysis.visualStyle}. Color Scheme: ${analysis.colorScheme}. European live-action cinema, photorealistic, natural lighting, cinematic composition, realistic textures, natural color grading.`;
        const crystalBan = analysis?.randomContext?.allowCrystals ? '' : ', no gems, no diamonds, no crystals, no jewel motifs';
        const snowIceBan = analysis?.randomContext?.allowSnowIce ? '' : ', no snow, no ice, no glacier, no frosted surfaces';
        const negatives = `NEGATIVE STYLE: no animation, no anime, no cartoon, no cel-shading, no hand-drawn, no 2D style, no stylized graphics, no text or subtitles on screen${crystalBan}${snowIceBan}.`;
        const anchor = analysis?.randomContext?.nonce ? `CHARACTER ANCHOR CODE: ${analysis.randomContext.nonce}. Always keep the same face, hair color/texture, outfit, body proportions, and unique marks tied to this anchor.` : '';

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
        // Ưu tiên microLocation từ enriched snapshot, nếu không có thì dùng mainSetting
        const envBase = segment.microLocation || segment.continuity?.locationLink?.split('đến')[1]?.trim() || rc.mainSetting || 'thành phố châu Âu yên bình';
        const envSubs = Array.isArray(rc.subSettings) && rc.subSettings.length > 0 ? rc.subSettings.join(', ') : 'hàng cây, bầu trời nhiều mây, phố nhỏ';
        const colorFlavor = rc.colorPalette ? `color grade theo bảng màu ${rc.colorPalette}` : 'màu pastel ấm, trời gradient';
        const animFlavor = rc.animationFlavor ? `cinematic style: ${rc.animationFlavor}` : 'photorealistic, natural cinematography';

        // Continuity từ segment trước/sau và story arc
        const prev = analysis.segments[segment.index - 2];
        const next = analysis.segments[segment.index];
        const carriesProps = Array.isArray(analysis.propsPersistent) && analysis.propsPersistent.length ? `CARRIED PROPS: ${analysis.propsPersistent.join(', ')}` : '';
        const continuityMeta = segment.continuity ? `Objective=${segment.continuity.objectiveProgress || 'progressing'}, Link=${segment.continuity.locationLink || 'smooth link'}, Carries=${Array.isArray(segment.continuity.carriesProps) ? segment.continuity.carriesProps.join(', ') : ''}.` : '';
        
        // Xác định story beat hiện tại dựa vào index (phân chia theo 4 beats)
        const totalSegments = analysis.segments.length;
        const beatIndex = Math.floor((segment.index - 1) / (totalSegments / 4));
        const storyBeats = Array.isArray(analysis.storyBeats) ? analysis.storyBeats : [];
        const currentBeat = storyBeats[beatIndex] || { beat: 'phát triển', goal: 'tiếp tục hành trình' };
        const storyArc = storyBeats.length > 0 ? `STORY ARC: ${currentBeat.beat} - ${currentBeat.goal || currentBeat.turningPoint || currentBeat.realization || currentBeat.resolution || 'tiếp tục câu chuyện'}.` : '';
        const overallTheme = analysis.overallTheme ? `THEME: ${analysis.overallTheme}.` : '';
        
        const continuity = `${storyArc} ${overallTheme} ${prev ? `CONTINUITY PREV: ${prev.timeRange} - ${prev.focus || 'previous scene'}.` : 'OPENING: gentle fade-in.'} ${next ? `CONTINUITY NEXT: ${next.timeRange} - ${next.focus || 'next scene'}.` : 'ENDING: gentle fade-out.'} ${carriesProps} ${continuityMeta}`;

        const sceneBlueprint = `SCENE BLUEPRINT: shot=${shotType}, lens=${lens}, cameraMove=${move}, composition=rule-of-thirds with strong leading lines and layered depth, lighting=soft ambient with rim light and sky glow, ${colorFlavor}, environment=${envBase} (details: ${envSubs}), timeOfDay=${timeLabel}, weather=${weather}, backgroundAction=subtle everyday motion (leaves, signage flicker, distant traffic), transition=smooth dissolve.`;

        // Template guide theo yêu cầu người dùng
        const templateGuide = `SCENE STRUCTURE TEMPLATE: title='${envBase} – tranquil moment', character={ name: ${character.name}, ethnicity: 'European (Caucasian)', age: ${character.age || 'young adult'}, appearance: 'hair detail consistent with character, outfit as described, posture relaxed, real human features', expression: 'peaceful, soft contentment' }, setting={ location: '${envBase}', time_of_day: '${timeLabel}', environment_details: '${envSubs}' , weather: '${weather}' }, action='varied, non-repetitive gentle everyday action (use provided action; avoid drinking/sipping/stirring)', camera_style='${shotType} transitioning to wide panorama', lighting='natural golden hour or soft ambient lighting', audio='ambient: wind, distant birds, soft city hum', mood='serene, restful conclusion — serenity in simplicity'`;

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

        const hardRules = `RULES: Character appearance MUST be EXACTLY THE SAME in every scene (face, hair color/texture, outfit, body proportions, unique marks). ${anchor} NO text overlay, NO subtitles, NO voice-over, NO human speech; only visuals with ambient sounds/music. ${negatives}`;
        const baseLine = segment.enrichedPrompt ? segment.enrichedPrompt : (segment.prompt || 'slice-of-life live-action moment');
        // Ảnh chụp nhân vật theo cảnh (ép hiển thị chi tiết trong từng cảnh)
        const expr = segment.mood || 'soft contentment';
        // Ưu tiên hands_item từ enriched snapshot (ChatGPT đã quyết định dựa trên action và bối cảnh)
        // Nếu không có, mới suy luận đơn giản từ action
        let handsItem = segment.character_snapshot?.hands_item;
        if (!handsItem) {
            // Suy luận đơn giản từ action (fallback - ưu tiên empty hands)
            const action = segment.action || segment.focus || '';
            const carriesProps = Array.isArray(segment.continuity?.carriesProps) ? segment.continuity.carriesProps : [];
            
            // Chỉ cầm vật nếu action thực sự yêu cầu hoặc có carriesProps rõ ràng
            if (carriesProps.length > 0 && action.match(/nhặt|cầm|giữ|đưa|nâng|mang|bế/i)) {
                const itemMatch = action.match(/(?:nhặt|cầm|giữ|đưa|nâng|mang|bế)\s+(?:chiếc\s+)?([^\s,]+(?:\s+[^\s,]+)?)/i);
                if (itemMatch && itemMatch[1]) {
                    handsItem = `cầm ${itemMatch[1]}`;
                } else {
                    handsItem = `cầm ${carriesProps[0]}`;
                }
            } else if (action.match(/tìm|kiếm|lục|sờ/i)) {
                handsItem = 'tay đưa ra tìm kiếm, tay trống';
            } else if (action.match(/chạy|nhảy|di chuyển/i)) {
                handsItem = 'tay vung tự nhiên khi di chuyển';
            } else if (action.match(/mở|đóng|kéo|đẩy/i)) {
                handsItem = 'tay đưa ra thực hiện hành động';
            } else {
                // Mặc định: empty hands (tự nhiên, đa dạng)
                const handsVariants = [
                    'empty hands, natural resting pose',
                    'empty hands, tay đặt tự nhiên',
                    'tay trống, tư thế tự nhiên',
                    'empty hands, tay thả lỏng',
                    'empty hands, tay vung nhẹ tự nhiên',
                    'empty hands, tay đặt trên đùi hoặc bên cạnh'
                ];
                handsItem = handsVariants[segment.index % handsVariants.length];
            }
        }
        const charSnapshot = `CHARACTER PER-SCENE SNAPSHOT: hair=${segment.character_snapshot?.hair_state || character.appearance?.hair || 'natural European hair, slightly wind-ruffled'}, outfit=${segment.character_snapshot?.outfit_state || `${character.outfit?.top},${character.outfit?.bottom}`}, jewelry=${segment.character_snapshot?.jewelry_glint || character.outfit?.jewelry || 'subtle glint'}, posture=${segment.character_snapshot?.posture || 'relaxed natural posture'}, hands_item=${handsItem}, expression=${segment.character_snapshot?.expression || expr}.`;

        const sceneText = `SCENE ${segment.index} [${segment.timeRange}]: ${segment.focus || 'Live-action scene'} — ${baseLine}. MOOD: chill, serene, heartwarming, everyday wonder.`;
        return `${liveActionEnforce} ${charBlock} ${charSnapshot} ${styleBlock} ${animFlavor}. ${sceneBlueprint} ${templateGuide}. ${continuity} ${sceneText} ${enriched} ${enrichedMeta} ${hardRules}`;
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
    const successes = veo3Results.filter(x => x && x.success);
    const failures = veo3Results.filter(x => !x || !x.success);
    const summary = {
        total: veo3Results.length,
        success: successes.length,
        failure: failures.length,
        firstFailures: failures.slice(0, 5)
    };
    const summaryPath = path.join(outputDir, 'veo-direct-prompts-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    if (failures.length > 0) {
        const failPath = path.join(outputDir, 'veo-direct-prompts-failures.json');
        fs.writeFileSync(failPath, JSON.stringify(failures, null, 2), 'utf8');
        console.log(`⚠️  [Step 2] Prompts: ${summary.success}/${summary.total} thành công. Lỗi mẫu đã lưu: ${failPath}`);
    }
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
        console.log(`🚀 [START] Tạo video live-action 5 phút (${NUM_SEGMENTS} cảnh x ${SEGMENT_DURATION}s)...`);
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


