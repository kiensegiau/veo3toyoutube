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
const OPENAI_API_KEY = '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'
const LABS_COOKIES = (process.env.LABS_COOKIES || '').trim();
const RUN_MODE = (process.env.RUN_MODE || 'default').toLowerCase();
const VEO_PROJECT_ID = (process.env.VEO_PROJECT_ID || '').trim();

// Networking helpers for resilient OpenAI calls
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

// Kiểm tra file video có audio stream hay không (dùng ffprobe)
async function hasAudioStream(filePath){
    try{
        const cmd = `ffprobe -v error -select_streams a:0 -show_entries stream=index -of csv=p=0 "${filePath}"`;
        const { stdout } = await execAsync(cmd);
        return Boolean(String(stdout || '').trim());
    }catch(_){
        return false;
    }
}

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

// Video Configuration (5 phút = 300 giây) - TEST MODE
const SEGMENT_DURATION = 8; // seconds per segment (Veo3 tạo video 8 giây)
const TOTAL_DURATION_SECONDS = 5 * 60; // 300 giây (5 phút để test)
const NUM_SEGMENTS = Math.floor(TOTAL_DURATION_SECONDS / SEGMENT_DURATION); // 37 segments (300/8)
const CONCURRENCY = 5; // Xử lý 5 segments đồng thời để ổn định và tránh timeout

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

// Helper: Parse JSON từ story response (tái sử dụng logic từ file gốc)
function parseStoryJSON(storyText, outputDir) {
    let jsonString = null;
    
    // Thử tìm trong markdown code block trước
    const markdownMatch = storyText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
        jsonString = markdownMatch[1].trim();
    } else {
        // Tìm JSON object bằng cách đếm balanced braces
        const startIdx = storyText.indexOf('{');
        if (startIdx !== -1) {
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;
            
            for (let i = startIdx; i < storyText.length; i++) {
                const char = storyText[i];
                
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                
                if (char === '\\') {
                    escapeNext = true;
                    continue;
                }
                
                if (char === '"') {
                    inString = !inString;
                    continue;
                }
                
                if (!inString) {
                    if (char === '{') braceCount++;
                    if (char === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            jsonString = storyText.substring(startIdx, i + 1);
                            break;
                        }
                    }
                }
            }
        }
    }
    
    if (!jsonString) {
        console.error('❌ Không tìm thấy JSON trong response:', storyText.substring(0, 500));
        throw new Error('Kịch bản trả về không phải JSON');
    }
    
    // Clean up JSON string
    jsonString = jsonString
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/:\s*'([^']*)'/g, ': "$1"')
        .replace(/{\s*'([^']*)'/g, '{ "$1"')
        .replace(/,\s*'([^']*)'/g, ', "$1"')
        .trim();
    
    let story;
    try {
        story = JSON.parse(jsonString);
    } catch (parseError) {
        // Fix unescaped newlines và quotes trong strings
        try {
            let fixedJson = '';
            let inString = false;
            let escapeNext = false;
            
            for (let i = 0; i < jsonString.length; i++) {
                const char = jsonString[i];
                const nextChar = jsonString[i + 1];
                
                if (escapeNext) {
                    fixedJson += char;
                    escapeNext = false;
                    continue;
                }
                
                if (char === '\\') {
                    fixedJson += char;
                    escapeNext = true;
                    continue;
                }
                
                if (char === '"') {
                    inString = !inString;
                    fixedJson += char;
                    continue;
                }
                
                if (inString) {
                    if (char === '\n') {
                        fixedJson += '\\n';
                    } else if (char === '\r') {
                        fixedJson += '\\n';
                        if (nextChar === '\n') i++;
                    } else if (char === '\t') {
                        fixedJson += '\\t';
                    } else {
                        fixedJson += char;
                    }
                } else {
                    fixedJson += char;
                }
            }
            
            story = JSON.parse(fixedJson);
        } catch (secondError) {
            // Lưu JSON lỗi ra file để debug
            const errorLogPath = path.join(outputDir, `json-error-${Date.now()}.txt`);
            try {
                fs.writeFileSync(errorLogPath, jsonString, 'utf8');
                console.error(`📄 Đã lưu JSON lỗi vào: ${errorLogPath}`);
            } catch (_) {}
            throw new Error(`Lỗi parse JSON: ${parseError.message}`);
        }
    }
    
    return story;
}

async function createCatAdventureVideo30min(){
    try {
        const serverUrl = 'http://localhost:8888';
        const outputDir = `./temp/cat-adventure-30min-video`;
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Step 0: Sinh kịch bản cuộc phiêu lưu của mèo (5 phút - TEST MODE)
        console.log(`📖 [Step 0] Sinh kịch bản cuộc phiêu lưu mèo ${NUM_SEGMENTS} segments (${TOTAL_DURATION_SECONDS}s = ${TOTAL_DURATION_SECONDS/60} phút)...`);
        
        // Tạo các yếu tố ngẫu nhiên để đảm bảo kịch bản khác nhau mỗi lần (giống file mẫu)
        const adventureElements = {
            seasons: ['xuân', 'hè', 'thu', 'đông'][Math.floor(Math.random() * 4)],
            timeOfDay: ['sáng sớm', 'buổi sáng', 'trưa', 'chiều', 'chiều tối', 'hoàng hôn', 'đêm tối', 'bình minh'][Math.floor(Math.random() * 8)],
            settings: ['rừng nhiệt đới', 'sa mạc', 'đảo hoang', 'núi tuyết', 'đầm lầy', 'hang động', 'thành phố cổ', 'ven biển', 'rừng rậm', 'thảo nguyên', 'rừng ma thuật', 'thung lũng bí ẩn', 'cánh đồng hoa', 'sông ngầm', 'miệng núi lửa'][Math.floor(Math.random() * 15)],
            challenges: ['chiến đấu với khủng long', 'chiến đấu với King Kong', 'chiến đấu với quái vật khổng lồ', 'chiến đấu với động vật lớn', 'giải cứu động vật khỏi quái vật', 'tìm đường về nhà', 'vượt qua thử thách', 'giúp đỡ bạn bè', 'bảo vệ lãnh thổ', 'tìm kho báu', 'chạy trốn kẻ thù', 'khám phá bí mật', 'giải mã cổ tích', 'chữa lành thiên nhiên', 'tìm hiểu sự thật', 'giải phóng tù nhân'][Math.floor(Math.random() * 16)],
            enemies: ['khủng long T-Rex', 'khủng long Velociraptor', 'King Kong', 'quái vật khổng lồ', 'rồng', 'quái thú hung dữ', 'khủng long bay', 'quái vật đại dương', 'không có kẻ thù'][Math.floor(Math.random() * 9)],
            companions: ['mèo mẹ và mèo con', 'chỉ mèo con', 'mèo con và chó bạn', 'mèo con và khỉ bạn', 'mèo con và chim bạn', 'mèo con và thỏ bạn', 'mèo con và sóc bạn', 'mèo con một mình'][Math.floor(Math.random() * 8)],
            weather: ['nắng nóng', 'mưa lớn', 'bão tố', 'sương mù', 'nắng đẹp', 'trời quang', 'có gió', 'mây bay', 'cầu vồng sau mưa', 'trời đẹp'][Math.floor(Math.random() * 10)],
            mood: ['hào hứng', 'bí ẩn', 'anh hùng', 'tình cảm', 'hài hước', 'phiêu lưu', 'kỳ bí', 'thơ mộng', 'hấp dẫn', 'kịch tính'][Math.floor(Math.random() * 10)]
        };
        
        // Chọn ngẫu nhiên các hoạt động phiêu lưu và chiến đấu để gợi ý
        const adventureActivities = ['chiến đấu với khủng long', 'chiến đấu với King Kong', 'chiến đấu với quái vật', 'leo núi', 'vượt sông', 'đi qua cầu', 'trèo cây', 'khám phá hang động', 'giải câu đố', 'tìm chìa khóa', 'mở cổng', 'thoát khỏi bẫy', 'giúp bạn gặp khó khăn', 'tránh nguy hiểm', 'vượt chướng ngại vật', 'đi theo dấu vết', 'tìm đường bí mật', 'học kỹ năng mới', 'sử dụng công cụ', 'hợp tác với bạn', 'giải quyết xung đột', 'khám phá kho báu', 'hoàn thành nhiệm vụ', 'chạy trốn quái vật', 'che giấu khỏi kẻ thù', 'tấn công kẻ thù', 'phòng thủ khỏi nguy hiểm'];
        const shuffledActivities = [...adventureActivities].sort(() => Math.random() - 0.5);
        const selectedActivities = shuffledActivities.slice(0, Math.min(15, shuffledActivities.length));
        
        // Log các yếu tố ngẫu nhiên để đảm bảo mỗi lần chạy khác nhau
        console.log(`🎲 [Step 0] YẾU TỐ NGẪU NHIÊN (đảm bảo mỗi lần chạy khác nhau):`);
        console.log(`   - Mùa: ${adventureElements.seasons}`);
        console.log(`   - Thời gian: ${adventureElements.timeOfDay}`);
        console.log(`   - Bối cảnh: ${adventureElements.settings}`);
        console.log(`   - Thử thách: ${adventureElements.challenges}`);
        console.log(`   - Kẻ thù/Quái vật: ${adventureElements.enemies}`);
        console.log(`   - Bạn đồng hành: ${adventureElements.companions}`);
        console.log(`   - Thời tiết: ${adventureElements.weather}`);
        console.log(`   - Không khí: ${adventureElements.mood}`);
        console.log(`   - Hoạt động gợi ý: ${selectedActivities.slice(0, 5).join(', ')}... (${selectedActivities.length} hoạt động)`);
        
        // Tạo story với characterSheet (nhân hóa, đồng nhất nhân vật)
        const storyResult = await fetchOpenAIWithRetry({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Bạn là biên kịch dựng cảnh cho video 5 phút về cuộc phiêu lưu của mèo.

YÊU CẦU BẮT BUỘC:
- Nhân vật xuyên suốt: Mèo mẹ và mèo con (đặt tên, tính cách nhất quán)
- NHÂN HÓA (anthropomorphic): hình thể dáng người, đi hai chân, tỉ lệ cơ thể người, cử chỉ tay chân như người; khuôn mặt và tai mèo, có lông mèo; có thể mặc trang phục gọn gàng hiện đại phù hợp ngữ cảnh phiêu lưu.
- Nội dung: Cuộc phiêu lưu HẤP DẪN với cảnh CHIẾN ĐẤU, giải cứu, hành động, mạo hiểm nhưng PHÙ HỢP TRẺ EM (không quá nguy hiểm/thực tế, có yếu tố tích cực)
- BẮT BUỘC: Phải có cảnh CHIẾN ĐẤU với khủng long, King Kong, quái vật khổng lồ hoặc động vật lớn để video HẤP DẪN và KỊCH TÍNH
- Không được chỉ di dạo - PHẢI có hành động, chiến đấu, thử thách thực sự
- Không có chữ/text overlay, không voice-over, chỉ visual và âm thanh nền tự nhiên/nhạc nền.
- Phong cách, bảng màu, không khí nhất quán toàn video.

QUAN TRỌNG - TÍNH LOGIC & NHẤT QUÁN CỦA CÂU CHUYỆN:
- Cốt truyện phải có cấu trúc rõ ràng: MỞ ĐẦU (thiết lập) → PHÁT TRIỂN (xây dựng) → CAO TRÀO (thử thách) → KẾT THÚC (giải quyết)
- Các chương PHẢI liên kết logic với nhau, có sự tiếp nối rõ ràng (không nhảy cóc đột ngột)
- Bối cảnh và thời gian phải hợp lý: nếu chương trước ở rừng → chương sau có thể ở rừng sâu hơn hoặc địa điểm liên quan, không thể nhảy từ rừng sang sa mạc mà không có lý do
- Hành động phải có nguyên nhân và hậu quả logic: nhân vật làm gì → kết quả là gì → dẫn đến hành động tiếp theo
- Đảm bảo continuity: vật phẩm/kiến thức/hành động trong chương trước phải ảnh hưởng đến chương sau
- Nhân vật phải có động cơ rõ ràng và hành động nhất quán với tính cách

QUAN TRỌNG - ĐA DẠNG TỐI ĐA & TRÁNH TRÙNG LẶP:
- MỖI LẦN TẠO KỊCH BẢN PHẢI HOÀN TOÀN KHÁC BIỆT về: chủ đề tổng thể, bối cảnh chính, hoạt động, không khí, màu sắc, phong cách visual.
- ${NUM_SEGMENTS} segments PHẢI có hành động và bối cảnh ĐA DẠNG, nhưng VẪN GIỮ TÍNH LOGIC và LIÊN KẾT.
- Đảm bảo mỗi chương có địa điểm/hoạt động/màu sắc/không khí riêng biệt NHƯNG hợp lý với câu chuyện tổng thể.
- Sử dụng các địa điểm đa dạng: rừng, sa mạc, núi, biển, hang động, thành phố cổ, đảo, thảo nguyên, đầm lầy, v.v. (nhưng đảm bảo có sự chuyển tiếp logic giữa các địa điểm)
- Sử dụng các hoạt động đa dạng và SÁNG TẠO, không lặp lại quá nhiều giữa các chương, nhưng đảm bảo có sự tiến triển logic.

NHẤN MẠNH ĐỒNG NHẤT NHÂN VẬT (Character Consistency):
- Trả về characterSheet mô tả CHI TIẾT ngoại hình từng nhân vật để dùng xuyên suốt: giống loài, chiều cao, tỉ lệ cơ thể, màu lông/chấm/hoa văn, dáng mặt, tai, mắt, phụ kiện đặc trưng, trang phục CỐ ĐỊNH (màu/chất liệu/kiểu), đạo cụ yêu thích.
- QUY TẮC: Giữ NGUYÊN khuôn mặt, màu lông, trang phục và phụ kiện của mỗi nhân vật ở tất cả segments; KHÔNG đổi giới tính, tuổi, giống, màu sắc hay trang phục (trừ khi có nêu rõ trong sheet).

Trả về outline tổng thể (text) và characterSheet (JSON):
{
  "overallTheme": string,
  "colorScheme": string,
  "visualStyle": string,
  "characterSheet": {
    "mother": { "name": string, "traits": string, "appearance": string, "outfit": string, "uniqueMarks": string },
    "kitten": { "name": string, "traits": string, "appearance": string, "outfit": string, "uniqueMarks": string }
  },
  "outline": "text mô tả outline cho 5 phút, chia thành ${Math.ceil(NUM_SEGMENTS / 10)} chương"
}`
                },
                {
                    role: 'user',
                    content: `Tạo câu chuyện phiêu lưu 5 phút HẤP DẪN và KỊCH TÍNH về mèo mẹ và mèo con (NHÂN HÓA - anthropomorphic) HOÀN TOÀN KHÁC BIỆT và SÁNG TẠO:

YẾU TỐ NGẪU NHIÊN (dùng để tạo câu chuyện độc đáo):
- Mùa: ${adventureElements.seasons}
- Thời gian: ${adventureElements.timeOfDay}
- Bối cảnh chính: ${adventureElements.settings}
- Thử thách chính: ${adventureElements.challenges}
- Kẻ thù/Quái vật: ${adventureElements.enemies}
- Bạn đồng hành: ${adventureElements.companions}
- Thời tiết: ${adventureElements.weather}
- Không khí: ${adventureElements.mood}
- Hoạt động gợi ý (có thể dùng một phần): ${selectedActivities.join(', ')}

YÊU CẦU ĐẶC BIỆT VỀ CẤU TRÚC CÂU CHUYỆN:
- CÂU CHUYỆN PHẢI CÓ CẤU TRÚC XUYÊN SUỐT VÀ HOÀN CHỈNH:
  * PHẦN 1 - MỞ ĐẦU (khoảng 25% đầu): Giới thiệu nhân vật, bối cảnh, bắt đầu cuộc phiêu lưu, khám phá môi trường, KHÔNG có chiến đấu
  * PHẦN 2 - PHÁT TRIỂN (khoảng 25-50%): Phát hiện nguy hiểm, chuẩn bị đối phó, gặp kẻ thù lần đầu, có thể có 1-2 cảnh chiến đấu nhẹ
  * PHẦN 3 - CAO TRÀO (khoảng 50-85%): Chiến đấu chính với ${adventureElements.enemies === 'không có kẻ thù' ? 'kẻ thù khổng lồ' : adventureElements.enemies}, thử thách lớn nhất, nhiều cảnh chiến đấu kịch tính
  * PHẦN 4 - KẾT THÚC (khoảng 85-100%): Giải quyết vấn đề, chiến thắng, kết luận tích cực, KHÔNG có chiến đấu nữa (hoặc rất ít)
- QUAN TRỌNG: Không được lặp lại cảnh chiến đấu ở mỗi segment - chỉ chiến đấu ở phần cao trào
- Các segments khác phải có hành động đa dạng: khám phá, quan sát, chuẩn bị, tìm đường, giải cứu, vượt chướng ngại vật

Yêu cầu về TÍNH LOGIC & NHẤT QUÁN:
- Tạo một câu chuyện HOÀN TOÀN MỚI, SÁNG TẠO nhưng PHẢI CÓ LOGIC RÕ RÀNG
- Cốt truyện phải có: MỞ ĐẦU (giới thiệu nhân vật, bối cảnh) → PHÁT TRIỂN (xây dựng xung đột/thử thách) → CAO TRÀO (thử thách lớn nhất) → KẾT THÚC (giải quyết, kết luận)
- Các chương PHẢI liên kết logic: chương sau tiếp nối từ chương trước, không nhảy cóc đột ngột
- Bối cảnh thay đổi phải hợp lý: nếu từ rừng → hang động là logic, nhưng rừng → sa mạc cần có lý do rõ ràng
- Hành động phải có nguyên nhân → hậu quả → hành động tiếp theo (chuỗi logic)
- Đảm bảo continuity: vật phẩm/công cụ/kiến thức từ chương trước phải xuất hiện ở chương sau nếu phù hợp

Yêu cầu về NỘI DUNG:
- Mèo NHÂN HÓA: dáng người, đi hai chân, cử chỉ như người, trang phục phù hợp phiêu lưu (có thể có vũ khí, công cụ)
- Đồng nhất nhân vật: mèo mẹ và mèo con phải có ngoại hình CỐ ĐỊNH từ đầu đến cuối
- Outline ${Math.ceil(NUM_SEGMENTS / 10)} chương, mỗi chương có nhiệm vụ/thử thách riêng nhưng LIÊN KẾT THÀNH CÂU CHUYỆN HOÀN CHỈNH
- Mỗi chương phải có hành động và tiến triển logic, nhưng KHÔNG PHẢI chương nào cũng cần chiến đấu
- Chiến đấu chỉ xuất hiện ở phần CAO TRÀO của câu chuyện (khoảng giữa video), không phải từ đầu đến cuối
- Các hành động đa dạng: khám phá, quan sát, chuẩn bị, tìm đường, giải cứu, vượt chướng ngại vật, chiến đấu (chỉ ở cao trào)
- Đảm bảo đa dạng: mỗi chương có bối cảnh/hoạt động/không khí khác nhau NHƯNG hợp lý với tổng thể
- TRÁNH chỉ di dạo - video phải HẤP DẪN với cảnh chiến đấu, hành động kịch tính nhưng phù hợp trẻ em`
                }
            ],
            max_tokens: 5000, // Tăng từ 3000 lên 5000 vì cần tạo outline cho 23 chương (225/10)
            temperature: 1.0
        });
        
        if (!storyResult.choices) throw new Error('Không sinh được story');
        const storyText = storyResult.choices[0].message.content;
        
        // Parse story JSON
        let story = null;
        try {
            story = parseStoryJSON(storyText, outputDir);
        } catch (parseErr) {
            console.warn('⚠️ Không parse được story JSON, tạo characterSheet mặc định');
            story = {
                overallTheme: `Cuộc phiêu lưu của mèo trong ${adventureElements.settings}`,
                colorScheme: 'Natural, vibrant colors',
                visualStyle: 'Anthropomorphic cat, adventure style',
                characterSheet: {
                    mother: {
                        name: 'Mimi',
                        traits: 'Brave, caring, adventurous',
                        appearance: 'Anthropomorphic orange tabby cat with white chest, medium height, cat face with green eyes',
                        outfit: 'Adventure vest in khaki color, cargo pants, hiking boots',
                        uniqueMarks: 'White patch on left paw, small scar on right ear'
                    },
                    kitten: {
                        name: 'Tommy',
                        traits: 'Curious, energetic, playful',
                        appearance: 'Small anthropomorphic gray tabby kitten with white belly, cat face with bright blue eyes',
                        outfit: 'Small backpack, comfortable shorts, sneakers',
                        uniqueMarks: 'White socks on all paws, orange spot on nose'
                    }
                },
                outline: `Adventure story in ${adventureElements.settings} with ${adventureElements.challenges}`
            };
        }
        
        let outlineText = story.outline || storyText;
        // Đảm bảo outlineText là string (không phải array hoặc object)
        if (Array.isArray(outlineText)) {
            outlineText = outlineText.join('\n');
        } else if (typeof outlineText !== 'string') {
            outlineText = String(outlineText);
        }
        
        console.log(`✅ [Step 0] Đã tạo story và characterSheet`);
        console.log(`📝 [Step 0] Mèo mẹ: ${story.characterSheet?.mother?.name || 'N/A'} - ${story.characterSheet?.mother?.appearance || 'N/A'}`);
        console.log(`📝 [Step 0] Mèo con: ${story.characterSheet?.kitten?.name || 'N/A'} - ${story.characterSheet?.kitten?.appearance || 'N/A'}`);
        
        // Lưu story và outline
        fs.writeFileSync(path.join(outputDir, 'story-outline.txt'), outlineText, 'utf8');
        
        // Sinh segments theo batch nhỏ (mỗi lần 20 segments cho test)
        const segments = [];
        const BATCH_STORY_SIZE = 20; // Sinh 20 segments mỗi lần (giảm từ 50 để test nhanh hơn)
        
        for (let batchStart = 0; batchStart < NUM_SEGMENTS; batchStart += BATCH_STORY_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_STORY_SIZE, NUM_SEGMENTS);
            const batchNum = Math.floor(batchStart / BATCH_STORY_SIZE) + 1;
            const totalBatches = Math.ceil(NUM_SEGMENTS / BATCH_STORY_SIZE);
            
            console.log(`📝 [Step 0] Sinh batch ${batchNum}/${totalBatches}: segments ${batchStart + 1}-${batchEnd}...`);
            
            const batchResult = await fetchOpenAIWithRetry({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Bạn tạo segments cho video phiêu lưu mèo (NHÂN HÓA - anthropomorphic).

YÊU CẦU VỀ TÍNH LOGIC & NHẤT QUÁN:
- Các segments PHẢI liên kết logic với nhau: segment sau tiếp nối từ segment trước
- Không được nhảy cóc đột ngột về bối cảnh/hành động mà không có lý do
- Đảm bảo continuity: nếu segment trước nhân vật có vật phẩm → segment sau phải giữ nguyên (trừ khi có lý do mất đi)
- Hành động phải có chuỗi logic: nguyên nhân → hành động → kết quả → hành động tiếp theo
- Bối cảnh thay đổi phải hợp lý: nếu segment trước ở rừng → segment sau có thể ở rừng sâu hơn hoặc hang động gần đó, không thể nhảy sang sa mạc đột ngột
- Nhân vật phải hành động nhất quán với tính cách và động cơ đã thiết lập

YÊU CẦU VỀ NỘI DUNG:
- Mèo NHÂN HÓA: dáng người, đi hai chân, cử chỉ như người, trang phục phù hợp phiêu lưu (có thể có vũ khí, công cụ)
- Nhân vật: Mèo mẹ (${story.characterSheet?.mother?.name || 'Mother'}) và mèo con (${story.characterSheet?.kitten?.name || 'Kitten'})
- Cuộc phiêu lưu HẤP DẪN với cảnh CHIẾN ĐẤU, giải cứu, hành động kịch tính, phù hợp trẻ em
- PHÂN BỔ HỢP LÝ CÁC PHẦN CỦA CÂU CHUYỆN:
  * Segments 1-25% (MỞ ĐẦU): Khám phá, giới thiệu, chuẩn bị - KHÔNG có chiến đấu
  * Segments 25-50% (PHÁT TRIỂN): Phát hiện nguy hiểm, chuẩn bị - có thể có 1-2 cảnh chiến đấu nhẹ
  * Segments 50-85% (CAO TRÀO): Chiến đấu chính với ${adventureElements.enemies === 'không có kẻ thù' ? 'kẻ thù' : adventureElements.enemies} - nhiều cảnh chiến đấu kịch tính
  * Segments 85-100% (KẾT THÚC): Giải quyết, chiến thắng - KHÔNG có chiến đấu nữa
- Không được lặp lại cảnh chiến đấu ở mỗi segment - chỉ tập trung ở phần cao trào
- Không chữ, không voice-over
- Đa dạng bối cảnh và hành động NHƯNG đảm bảo tính logic
- QUAN TRỌNG: Giữ nguyên ngoại hình nhân vật từ characterSheet

Trả về JSON array với ${batchEnd - batchStart} segments, mỗi segment có:
{ "index": số, "timeStart": giây bắt đầu, "timeEnd": giây kết thúc, "focus": mô tả ngắn, "prompt": prompt chi tiết }

QUY TẮC TẠO SEGMENTS:
- Segment đầu tiên trong batch (index ${batchStart + 1}): phải tiếp nối logic từ segment trước đó (nếu có)
- Các segments giữa: mỗi segment phải là hệ quả logic của segment trước
- Segment cuối trong batch: phải kết thúc ở điểm hợp lý để segment sau tiếp nối`
                    },
                    {
                        role: 'user',
                        content: `Tạo ${batchEnd - batchStart} segments cho phần ${batchNum} của video phiêu lưu mèo (từ ${batchStart * SEGMENT_DURATION}s đến ${batchEnd * SEGMENT_DURATION}s).

CONTEXT ĐỂ ĐẢM BẢO TÍNH LOGIC & CONTINUITY:
${batchStart > 0 ? 
  `- Segment TRƯỚC batch này là segment ${batchStart}, kết thúc tại ${(batchStart - 1) * SEGMENT_DURATION}s
- Các segments đã tạo: ${segments.slice(Math.max(0, batchStart - 3), batchStart).map(s => `Segment ${s.index} (${s.timeRange}): ${s.focus || s.prompt.substring(0, 50)}`).join('; ') || 'Không có'}
- Segment đầu tiên trong batch này (segment ${batchStart + 1}) PHẢI tiếp nối logic từ segment ${batchStart} ở trên
- Nhân vật đang ở đâu/làm gì/có vật phẩm gì từ segment ${batchStart} phải được tiếp tục trong segment ${batchStart + 1}` 
  : '- Đây là phần đầu của câu chuyện (segments 1-50), cần thiết lập bối cảnh và nhân vật rõ ràng'}

CharacterSheet:
- Mèo mẹ: ${story.characterSheet?.mother?.name || 'Mother'} - ${story.characterSheet?.mother?.appearance || ''}, mặc ${story.characterSheet?.mother?.outfit || ''}, đặc điểm: ${story.characterSheet?.mother?.uniqueMarks || ''}
- Mèo con: ${story.characterSheet?.kitten?.name || 'Kitten'} - ${story.characterSheet?.kitten?.appearance || ''}, mặc ${story.characterSheet?.kitten?.outfit || ''}, đặc điểm: ${story.characterSheet?.kitten?.uniqueMarks || ''}

Outline: ${outlineText.substring(0, 800)}

Yếu tố ngẫu nhiên đã chọn:
- Mùa: ${adventureElements.seasons}, Thời gian: ${adventureElements.timeOfDay}
- Bối cảnh: ${adventureElements.settings}, Thử thách: ${adventureElements.challenges}
- Kẻ thù/Quái vật: ${adventureElements.enemies}
- Bạn đồng hành: ${adventureElements.companions}, Thời tiết: ${adventureElements.weather}
- Không khí: ${adventureElements.mood}

YÊU CẦU QUAN TRỌNG:
1. TÍNH LOGIC & NHẤT QUÁN:
   - Mỗi segment phải là hệ quả logic của segment trước
   - Bối cảnh thay đổi phải hợp lý (ví dụ: rừng → rừng sâu → hang động là logic; rừng → sa mạc cần lý do rõ ràng)
   - Hành động phải có nguyên nhân và dẫn đến kết quả, kết quả đó dẫn đến hành động tiếp theo
   - Đảm bảo continuity: vật phẩm/kiến thức/hành động từ segment trước phải ảnh hưởng đến segment sau (nếu phù hợp)

2. TIẾN TRIỂN CÂU CHUYỆN:
   - Segments phải có sự tiến triển rõ ràng trong câu chuyện
   - Mỗi segment đóng góp vào việc xây dựng/xử lý thử thách/giải quyết vấn đề
   - Không lặp lại hành động giống hệt segment trước (trừ khi có lý do rõ ràng)

3. NHẤT QUÁN:
   - Nhân vật PHẢI nhất quán về ngoại hình ở mọi segment
   - Tính cách và hành động phải nhất quán với characterSheet
   - Mỗi segment phải có góc máy/ánh sáng/không khí riêng biệt NHƯNG hợp lý với tổng thể

4. CẤU TRÚC CÂU CHUYỆN XUYÊN SUỐT:
   - PHẢI tạo một câu chuyện HOÀN CHỈNH với cấu trúc rõ ràng:
     * MỞ ĐẦU (segments 1-25%): Giới thiệu, khám phá, chuẩn bị - KHÔNG chiến đấu, chỉ khám phá và thiết lập
     * PHÁT TRIỂN (segments 25-50%): Phát hiện nguy hiểm, chuẩn bị đối phó - có thể có 1-2 cảnh chiến đấu nhẹ, tập trung xây dựng căng thẳng
     * CAO TRÀO (segments 50-85%): Chiến đấu chính với ${adventureElements.enemies === 'không có kẻ thù' ? 'kẻ thù' : adventureElements.enemies} - nhiều cảnh chiến đấu kịch tính, hành động
     * KẾT THÚC (segments 85-100%): Giải quyết vấn đề, chiến thắng, kết luận tích cực - KHÔNG có chiến đấu nữa
   - QUAN TRỌNG: Không được lặp lại cảnh chiến đấu ở mỗi segment - chiến đấu chỉ tập trung ở phần cao trào
   - Các segments khác phải có hành động đa dạng: khám phá, quan sát, chuẩn bị, tìm đường, giải cứu, vượt chướng ngại vật
   - Đảm bảo tính liên tục: mỗi segment là hệ quả logic của segment trước, tạo thành một câu chuyện xuyên suốt`
                    }
                ],
                max_tokens: 4000, // Giảm xuống 4000 vì test mode chỉ có 20 segments mỗi batch
                temperature: 1.0
            });
            
            if (!batchResult.choices) throw new Error(`Không sinh được batch ${batchNum}`);
            const batchText = batchResult.choices[0].message.content;
            
            try {
                const batchJson = JSON.parse(batchText.match(/\[[\s\S]*\]/)?.[0] || batchText);
                if (Array.isArray(batchJson)) {
                    batchJson.forEach((seg, idx) => {
                        seg.index = batchStart + idx + 1;
                        seg.timeStart = (batchStart + idx) * SEGMENT_DURATION;
                        seg.timeEnd = (batchStart + idx + 1) * SEGMENT_DURATION;
                        seg.timeRange = `${seg.timeStart}-${seg.timeEnd}s`;
                    });
                    segments.push(...batchJson);
                    console.log(`✅ [Step 0] Đã thêm ${batchJson.length} segments (tổng: ${segments.length}/${NUM_SEGMENTS})`);
                } else {
                    throw new Error('Batch không phải array');
                }
            } catch (parseErr) {
                console.error(`⚠️ Lỗi parse batch ${batchNum}:`, parseErr.message);
                // Tạo segments mặc định nếu lỗi
                for (let i = batchStart; i < batchEnd; i++) {
                    segments.push({
                        index: i + 1,
                        timeStart: i * SEGMENT_DURATION,
                        timeEnd: (i + 1) * SEGMENT_DURATION,
                        timeRange: `${i * SEGMENT_DURATION}-${(i + 1) * SEGMENT_DURATION}s`,
                        focus: `Scene ${i + 1}`,
                        prompt: `A cat adventure scene in ${adventureElements.settings}`
                    });
                }
            }
            
            // Nghỉ giữa các batch để tránh rate limit
            if (batchEnd < NUM_SEGMENTS) {
                await sleep(2000);
            }
        }
        
        if (segments.length < NUM_SEGMENTS) {
            console.warn(`⚠️ Chỉ có ${segments.length}/${NUM_SEGMENTS} segments, tạo thêm segments mặc định...`);
            while (segments.length < NUM_SEGMENTS) {
                const i = segments.length;
                segments.push({
                    index: i + 1,
                    timeStart: i * SEGMENT_DURATION,
                    timeEnd: (i + 1) * SEGMENT_DURATION,
                    timeRange: `${i * SEGMENT_DURATION}-${(i + 1) * SEGMENT_DURATION}s`,
                    focus: `Adventure scene ${i + 1}`,
                    prompt: `A cat adventure scene in ${adventureElements.settings}, natural cat behavior`
                });
            }
        }
        
        const analysis = {
            overallTheme: story.overallTheme || `Cuộc phiêu lưu của mèo trong ${adventureElements.settings}`,
            colorScheme: story.colorScheme || 'Natural, vibrant colors',
            visualStyle: story.visualStyle || 'Anthropomorphic cat, adventure style',
            enemies: adventureElements.enemies, // Lưu enemies để dùng trong optimize prompt
            challenges: adventureElements.challenges, // Lưu challenges để dùng trong optimize prompt
            characterSheet: story.characterSheet || {
                mother: {
                    name: 'Mimi',
                    traits: 'Brave, caring, adventurous',
                    appearance: 'Anthropomorphic orange tabby cat with white chest, medium height, cat face with green eyes',
                    outfit: 'Adventure vest in khaki color, cargo pants, hiking boots',
                    uniqueMarks: 'White patch on left paw, small scar on right ear'
                },
                kitten: {
                    name: 'Tommy',
                    traits: 'Curious, energetic, playful',
                    appearance: 'Small anthropomorphic gray tabby kitten with white belly, cat face with bright blue eyes',
                    outfit: 'Small backpack, comfortable shorts, sneakers',
                    uniqueMarks: 'White socks on all paws, orange spot on nose'
                }
            },
            segments: segments.slice(0, NUM_SEGMENTS)
        };
        
        console.log(`✅ [Step 0] Chủ đề: ${analysis.overallTheme}`);
        console.log(`✅ [Step 0] Màu sắc: ${analysis.colorScheme}`);
        console.log(`✅ [Step 0] Phong cách: ${analysis.visualStyle}`);
        
        console.log(`✅ [Step 0] Đã tạo ${analysis.segments.length} segments`);
        
        // Lưu story
        fs.writeFileSync(path.join(outputDir, 'story-segments.json'), JSON.stringify(analysis, null, 2), 'utf8');
        
        return { analysis, outputDir, serverUrl };
    } catch (error) {
        console.error('❌ Lỗi trong Step 0:', error.message);
        throw error;
    }
}

async function processVideoSegments(analysis, outputDir, serverUrl) {
    console.log(`🤖 [Step 2] Tối ưu prompts cho Veo3...`);
    console.log(`📊 Xử lý ${analysis.segments.length} segments với concurrency ${CONCURRENCY}...`);
    const veo3Results = [];
    const earlyMonitorPromises = [];
    
    // Monitor function tương tự file gốc
    async function monitorAndDownload(veo3Result, opts = {}){
        const { maxAttempts = 100 } = opts;
        let operationId = veo3Result.operationId;
        let recreateAttempts = 0;
        const maxRecreate = 2;
        const promptForRecreate = veo3Result.optimizedPrompt || veo3Result.originalPrompt || '';
        console.log(`🔄 [Monitor] Start op=${operationId} seg=${veo3Result.segmentIndex + 1}`);
        
        const INITIAL_DELAY_MS = 60000; // 1 phút = 60 giây
        console.log(`⏸️  [Monitor] Đợi ${INITIAL_DELAY_MS/1000}s trước khi bắt đầu kiểm tra...`);
        await sleep(INITIAL_DELAY_MS);
        console.log(`🔍 [Monitor] Bắt đầu kiểm tra op=${operationId} seg=${veo3Result.segmentIndex + 1}`);
        
        let attempts = 0;
        const startTs = Date.now();
        const POLL_INTERVAL_MS = 5000;
        
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
                        body: JSON.stringify({ audioUrl: statusResult.videoUrl, filename: `cat_adventure_seg_${veo3Result.segmentIndex}_${Date.now()}.mp4` })
                    });
                    const downloadResult = await downloadResponse.json();
                    if (downloadResult.success) {
                        const videoPath = downloadResult.savedTo || downloadResult.outPath || downloadResult.path;
                        const waitedSec = Math.floor((Date.now() - startTs) / 1000);
                        console.log(`✅ [Monitor] op=${operationId} seg=${veo3Result.segmentIndex + 1} HOÀN THÀNH sau ${waitedSec}s`);
                        return { success: true, segmentIndex: veo3Result.segmentIndex, path: videoPath, publicPath: downloadResult.publicPath, filename: downloadResult.filename, operationId };
                    }
                    return { success: false, segmentIndex: veo3Result.segmentIndex, error: 'Download failed' };
                } else if (statusResult.success && statusResult.videoStatus === 'PENDING') {
                    attempts++;
                    const waitedSec = Math.floor((Date.now() - startTs) / 1000);
                    // Log ít hơn: mỗi 20 lần hoặc mỗi 60 giây
                    if (attempts % 20 === 0 || (waitedSec > 0 && waitedSec % 60 === 0)) {
                        console.log(`⏳ [Monitor] op=${operationId} seg=${veo3Result.segmentIndex + 1} PENDING (${attempts} lần, đã đợi ${waitedSec}s, poll mỗi ${POLL_INTERVAL_MS/1000}s)`);
                    }
                    await sleep(POLL_INTERVAL_MS);
                } else {
                    if (recreateAttempts < maxRecreate && promptForRecreate) {
                        recreateAttempts++;
                        try {
                            const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    input: promptForRecreate, 
                                    prompt: promptForRecreate, 
                                    aspectRatio: 'LANDSCAPE', // Khổ ngang cho video hấp dẫn hơn
                                    ...(LABS_COOKIES ? { labsCookies: LABS_COOKIES } : {}) 
                                })
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
                const waitedSec = Math.floor((Date.now() - startTs) / 1000);
                if (attempts % 10 === 0) {
                    console.log(`⚠️  [Monitor] op=${operationId} seg=${veo3Result.segmentIndex + 1} lỗi tạm thời (${attempts} lần), đã đợi ${waitedSec}s. Tiếp tục chờ...`);
                }
                await sleep(POLL_INTERVAL_MS);
            }
        }
        return { success: false, segmentIndex: veo3Result.segmentIndex, error: 'Timeout' };
    }

    async function processOneSegment(index) {
        const segment = analysis.segments[index];
        console.log(`🎬 [Step 2] Segment ${index + 1}/${analysis.segments.length}: ${segment.timeRange} | ${segment.focus || 'Adventure scene'}`);
        try {
            const prevSegment = index > 0 ? analysis.segments[index - 1] : null;
            const nextSegment = index < analysis.segments.length - 1 ? analysis.segments[index + 1] : null;

            // Xây dựng character description chi tiết từ characterSheet
            const characterSheet = analysis?.characterSheet || {};
            const motherInfo = characterSheet.mother || {};
            const kittenInfo = characterSheet.kitten || {};
            
            const characterDescription = `NHÂN VẬT (NHẤT QUÁN 100%):
- Mèo mẹ (${motherInfo.name || 'Mother'}): ${motherInfo.appearance || 'anthropomorphic cat with human-like body'}. Trang phục: ${motherInfo.outfit || 'adventure clothing'}. Đặc điểm: ${motherInfo.uniqueMarks || ''}. Tính cách: ${motherInfo.traits || ''}.
- Mèo con (${kittenInfo.name || 'Kitten'}): ${kittenInfo.appearance || 'small anthropomorphic cat with human-like body'}. Trang phục: ${kittenInfo.outfit || 'adventure clothing'}. Đặc điểm: ${kittenInfo.uniqueMarks || ''}. Tính cách: ${kittenInfo.traits || ''}.

QUY TẮC NGHIÊM NGẶT: Nhân vật PHẢI GIỐNG HỆT NHAU ở mọi segment: cùng khuôn mặt, cùng màu lông/hoa văn, cùng trang phục, cùng tỉ lệ cơ thể. KHÔNG BAO GIỜ thay đổi ngoại hình.`;

            // BƯỚC 1: Tối ưu prompt với ChatGPT để tạo detailedTimeline (giống file mẫu)
            const optimizeResult = await fetchOpenAIWithRetry({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Bạn tối ưu prompt Veo 3.1 cho video 8 giây về cuộc phiêu lưu của mèo (NHÂN HÓA - anthropomorphic).

QUAN TRỌNG NHẤT - NHẤT QUÁN NHÂN VẬT (100% MANDATORY):
- BẮT BUỘC: Mỗi scene có nhân vật xuất hiện PHẢI mô tả đầy đủ: TÊN + NGOẠI HÌNH + TRANG PHỤC + ĐẶC ĐIỂM
- Ví dụ: "${motherInfo.name || 'Mother'} (${motherInfo.appearance || 'mô tả ngoại hình'}, ${motherInfo.outfit || 'trang phục'}, ${motherInfo.uniqueMarks || 'đặc điểm'}) đang [hành động]"
- KHÔNG BAO GIỜ thay đổi bất kỳ chi tiết nào của nhân vật: khuôn mặt, màu lông, hoa văn, trang phục, tỉ lệ cơ thể, đặc điểm riêng
- Mỗi nhân vật PHẢI giống hệt nhau trong TẤT CẢ scenes - KHÔNG có ngoại lệ
- NHÂN HÓA: Mèo dáng người, đi hai chân, cử chỉ như người, trang phục phù hợp phiêu lưu (có thể có vũ khí, công cụ)
- Cuộc phiêu lưu HẤP DẪN với cảnh CHIẾN ĐẤU, giải cứu, hành động kịch tính, phù hợp trẻ em
- BẮT BUỘC: Mỗi scene phải có hành động thực sự - không chỉ di dạo mà phải có: chiến đấu, chạy trốn, tấn công, phòng thủ
- Không text overlay, không narration/voice

Trả về MỘT JSON ARRAY 4 phần tử (0-2s, 2-4s, 4-6s, 6-8s). Không thêm giải thích:
[
  {
    "timeStart": 0,
    "timeEnd": 2,
    "action": "Mô tả hành động chi tiết của mèo trong cảnh phiêu lưu",
    "cameraStyle": "zoom/pan/tilt/steady/dynamic...",
    "transition": "fade/dissolve/cut/smooth...",
    "soundFocus": "ambient sounds/background music (NO voice-over/speech/dialogue)",
    "visualDetails": "màu sắc, ánh sáng, texture, style, môi trường, động vật khác nếu có"
  },
  {
    "timeStart": 2,
    "timeEnd": 4,
    "action": "Mô tả hành động chi tiết của mèo trong cảnh phiêu lưu",
    "cameraStyle": "zoom/pan/tilt/steady/dynamic...",
    "transition": "fade/dissolve/cut/smooth...",
    "soundFocus": "ambient sounds/background music (NO voice-over/speech/dialogue)",
    "visualDetails": "màu sắc, ánh sáng, texture, style, môi trường, động vật khác nếu có"
  },
  {
    "timeStart": 4,
    "timeEnd": 6,
    "action": "Mô tả hành động chi tiết của mèo trong cảnh phiêu lưu",
    "cameraStyle": "zoom/pan/tilt/steady/dynamic...",
    "transition": "fade/dissolve/cut/smooth...",
    "soundFocus": "ambient sounds/background music (NO voice-over/speech/dialogue)",
    "visualDetails": "màu sắc, ánh sáng, texture, style, môi trường, động vật khác nếu có"
  },
  {
    "timeStart": 6,
    "timeEnd": 8,
    "action": "Mô tả hành động chi tiết của mèo trong cảnh phiêu lưu",
    "cameraStyle": "zoom/pan/tilt/steady/dynamic...",
    "transition": "fade/dissolve/cut/smooth...",
    "soundFocus": "ambient sounds/background music (NO voice-over/speech/dialogue)",
    "visualDetails": "màu sắc, ánh sáng, texture, style, môi trường, động vật khác nếu có"
  }
]
YÊU CẦU:
- Phù hợp trẻ em: tích cực, an toàn, không quá đáng sợ, có yếu tố anh hùng và tích cực.
- CẤU TRÚC CÂU CHUYỆN XUYÊN SUỐT: Scene phải phù hợp với phần của câu chuyện (xem phần user prompt để biết segment thuộc phần nào)
  * MỞ ĐẦU: khám phá, quan sát, chuẩn bị - KHÔNG chiến đấu
  * PHÁT TRIỂN: phát hiện nguy hiểm, chuẩn bị - có thể có cảnh nhẹ
  * CAO TRÀO: chiến đấu kịch tính, hành động - sử dụng vũ khí, kỹ năng, trí thông minh
  * KẾT THÚC: giải quyết, chiến thắng - KHÔNG chiến đấu nữa
- Không được lặp lại cảnh chiến đấu ở mỗi scene - chỉ chiến đấu khi ở phần cao trào
- Không text overlay, không narration/voice.
- Giữ nguyên chủ đề phiêu lưu và mèo NHÂN HÓA.
- Đa dạng: mỗi scene có góc máy/hành động/không khí khác nhau, đặc biệt là cảnh chiến đấu kịch tính.`
                    },
                    {
                        role: 'user',
                        content: `${characterDescription}

Chủ đề: ${analysis.overallTheme}
Màu sắc: ${analysis.colorScheme}
Phong cách: ${analysis.visualStyle}
Kẻ thù/Quái vật: ${analysis.enemies || 'không có kẻ thù'}
Thử thách: ${analysis.challenges || 'vượt qua thử thách'}

Segment ${index + 1}/${analysis.segments.length}: ${segment.timeRange}
Focus: ${segment.focus || 'Adventure scene'}
Original prompt: ${segment.prompt}
${prevSegment ? `Segment trước: ${prevSegment.timeRange} - ${prevSegment.focus || 'continuing adventure'}` : 'Đầu video: dùng fade in'}
${nextSegment ? `Segment sau: ${nextSegment.timeRange} - ${nextSegment.focus || 'continuing adventure'}` : 'Cuối video: dùng fade out'}

CẤU TRÚC CÂU CHUYỆN XUYÊN SUỐT:
- Segment này thuộc phần nào của câu chuyện?
  * MỞ ĐẦU (segments 1-25%): Scene khám phá, quan sát, chuẩn bị - KHÔNG chiến đấu
  * PHÁT TRIỂN (segments 25-50%): Scene phát hiện nguy hiểm, chuẩn bị - có thể có cảnh nhẹ, tập trung xây dựng căng thẳng
  * CAO TRÀO (segments 50-85%): Scene chiến đấu kịch tính với ${analysis.enemies === 'không có kẻ thù' ? 'kẻ thù' : analysis.enemies}, hành động - nhiều cảnh chiến đấu
  * KẾT THÚC (segments 85-100%): Scene giải quyết, chiến thắng, kết luận - KHÔNG chiến đấu nữa
- QUAN TRỌNG: Không được lặp lại cảnh chiến đấu nếu segment không thuộc phần cao trào
- Hành động phù hợp với phần của câu chuyện: khám phá, quan sát, chuẩn bị, tìm đường, giải cứu, vượt chướng ngại vật, hoặc chiến đấu (chỉ ở cao trào)
- Đảm bảo tính liên tục: scene này phải tiếp nối logic từ segment trước và dẫn đến segment sau
- LƯU Ý: Khi mô tả action, NHẤT ĐỊNH phải mô tả chi tiết ngoại hình nhân vật nếu họ xuất hiện trong scene. Ví dụ: "Mèo mẹ (${motherInfo.name || 'tên'}) với [mô tả ngoại hình], mặc [trang phục], [đặc điểm] đang [hành động phù hợp với phần của câu chuyện]".`
                    }
                ],
                max_tokens: 2000, // Tăng từ 1500 lên 2000 vì mỗi segment có 4 scenes (nhiều hơn 3 scenes của 60s)
                temperature: 0.35
            });

            if (!optimizeResult.choices) throw new Error('ChatGPT optimization failed');
            const optimizedContent = optimizeResult.choices[0].message.content.trim();
            let detailedTimeline = null;
            try {
                const jsonMatch = optimizedContent.match(/\[[\s\S]*\]/);
                if (jsonMatch) detailedTimeline = JSON.parse(jsonMatch[0]);
            } catch (parseErr) {
                console.warn(`⚠️ Không parse được detailedTimeline cho segment ${index + 1}, dùng fallback`);
            }

            // BƯỚC 2: Xây dựng optimizedPrompt từ detailedTimeline hoặc fallback
            let optimizedPrompt;
            if (detailedTimeline && Array.isArray(detailedTimeline) && detailedTimeline.length > 0) {
                // Build character context CHI TIẾT và RÕ RÀNG
                const motherDesc = `${motherInfo.name || 'Mother cat'}: ${motherInfo.appearance || 'anthropomorphic cat with human-like body'}, wearing ${motherInfo.outfit || 'clothing'}, distinctive marks: ${motherInfo.uniqueMarks || 'none'}`;
                const kittenDesc = `${kittenInfo.name || 'Kitten'}: ${kittenInfo.appearance || 'small anthropomorphic cat with human-like body'}, wearing ${kittenInfo.outfit || 'clothing'}, distinctive marks: ${kittenInfo.uniqueMarks || 'none'}`;
                
                const characterContext = `CHARACTER SHEET (MUST APPEAR IDENTICAL IN EVERY SCENE): ${motherDesc}. ${kittenDesc}. CRITICAL RULE: These characters MUST look EXACTLY THE SAME in every scene - same face, same fur color/patterns, same outfit, same body proportions, same unique marks. NEVER change their appearance.`;
                
                const themeContext = `[STORY CONTEXT: ${analysis.overallTheme}. Visual Style: ${analysis.visualStyle}. Color Scheme: ${analysis.colorScheme}. ${characterContext}] `;
                
                // Build character reference để dùng trong mỗi scene
                const motherRef = `${motherInfo.name || 'Mother'} (${motherInfo.appearance || ''}, ${motherInfo.outfit || ''}, ${motherInfo.uniqueMarks || ''})`;
                const kittenRef = `${kittenInfo.name || 'Kitten'} (${kittenInfo.appearance || ''}, ${kittenInfo.outfit || ''}, ${kittenInfo.uniqueMarks || ''})`;
                
                // Build scenes description từ detailedTimeline
                const scenesDescription = detailedTimeline.map((scene) => {
                    const transitionText = scene.transition ? `Transition: ${scene.transition}.` : '';
                    const soundText = scene.soundFocus ? scene.soundFocus.replace(/voice-over|voice over|narration|dialogue|speech|talking|speaking|narrator|human voice/gi, 'ambient sound') : 'ambient sound';
                    
                    // Build action text với character description đầy đủ
                    let actionText = scene.action || 'Cat adventure scene';
                    
                    // Kiểm tra xem nhân vật nào xuất hiện trong scene và đảm bảo có mô tả đầy đủ
                    const actionLower = actionText.toLowerCase();
                    const mentionsMother = actionLower.includes(motherInfo.name?.toLowerCase() || 'mother') || actionLower.includes('mèo mẹ') || actionLower.includes('mẹ');
                    const mentionsKitten = actionLower.includes(kittenInfo.name?.toLowerCase() || 'kitten') || actionLower.includes('mèo con') || actionLower.includes('con');
                    
                    // Nếu nhân vật xuất hiện nhưng không có mô tả đầy đủ, thêm vào
                    let characterDesc = '';
                    if (mentionsMother && !actionText.includes(motherInfo.appearance || '')) {
                        characterDesc += ` ${motherRef}`;
                    }
                    if (mentionsKitten && !actionText.includes(kittenInfo.appearance || '')) {
                        characterDesc += ` ${kittenRef}`;
                    }
                    
                    // Nếu có nhân vật xuất hiện, thêm reminder về tính nhất quán
                    if (mentionsMother || mentionsKitten) {
                        characterDesc += ' [CHARACTERS MUST LOOK IDENTICAL - same face, fur, outfit, body proportions]';
                    }
                    
                    return `[${scene.timeStart}-${scene.timeEnd}s] ${transitionText} ${actionText}${characterDesc}. Camera: ${scene.cameraStyle || 'dynamic'}. Visual details: ${scene.visualDetails || 'natural, vibrant colors'}. Sound: ${soundText} (NO voice-over, NO speech, NO dialogue).`;
                }).join(' ');
                
                optimizedPrompt = themeContext + scenesDescription + ' [CRITICAL RULE: CHARACTERS MUST APPEAR IDENTICAL IN EVERY SINGLE FRAME OF THIS VIDEO - exact same faces, exact same fur colors/patterns, exact same outfits, exact same body proportions, exact same unique marks. DO NOT change any aspect of character appearance. CONSISTENCY IS MANDATORY. NO voice-over, NO narration, NO dialogue, NO speech, NO human voice. Only visual content with ambient sounds/background music.]';
            } else {
                // Fallback với character description đầy đủ
                const characterFallback = `CHARACTER CONSISTENCY: Mother (${motherInfo.name || 'Mother'}) - ${motherInfo.appearance || ''}, wearing ${motherInfo.outfit || ''}. Kitten (${kittenInfo.name || 'Kitten'}) - ${kittenInfo.appearance || ''}, wearing ${kittenInfo.outfit || ''}. These characters MUST look identical in every scene - same face, fur color/patterns, outfits, body proportions.`;
                optimizedPrompt = `[ADVENTURE CONTEXT: ${analysis.overallTheme}. Visual Style: ${analysis.visualStyle}. Color Scheme: ${analysis.colorScheme}.] ${segment.prompt}. ${prevSegment ? `Previous scene: ${prevSegment.focus || 'continuing adventure'}. ` : 'Opening scene: fade in. '}${nextSegment ? `Next scene: ${nextSegment.focus || 'continuing adventure'}. ` : 'Final scene: fade out. '}${characterFallback}. [IMPORTANT: NO voice-over, NO narration, NO dialogue, NO speech, NO human voice. Only visual content with ambient sounds/background music.]`;
            }
            
            // BƯỚC 3: Gọi tạo video với retry và cookie handling
            let veo3Result = null;
            let retryCount = 0;
            const maxRetries = 8; // Tăng từ 5 lên 8 như file mẫu
            while (retryCount < maxRetries) {
                try {
                    const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            input: optimizedPrompt,
                            prompt: optimizedPrompt,
                            aspectRatio: 'PORTRAIT',
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
                        const waitTime = Math.pow(2, retryCount) * 1500; // Giống file mẫu
                        await sleep(waitTime);
                        // Refresh cookie nếu lỗi liên quan đến cookie
                        if (String(error.message).includes('cookie') || String(error.message).includes('auth') || String(error.message).includes('unauthorized')) {
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
                    detailedTimeline: detailedTimeline, // Thêm detailedTimeline vào result
                    optimizedPrompt: optimizedPrompt,
                    operationId: veo3Result.operationName,
                    success: true
                };
                console.log(`🧭 [Step 2] ĐÃ GỬI prompt cho segment ${index + 1}.`);
                console.log(`🕒 [Step 2] LỊCH THEO DÕI: đợi 60s rồi mới kiểm tra lần đầu, sau đó poll cố định mỗi 5s, tối đa 100 lần.`);
                earlyMonitorPromises.push(monitorAndDownload(resultObj, { maxAttempts: 100 }));
                return resultObj;
            }

            return { segmentIndex: index, timeRange: segment.timeRange, error: 'Failed after retries', success: false };
        } catch (error) {
            return { segmentIndex: index, timeRange: segment.timeRange, error: error.message, success: false };
        }
    }

    // Xử lý theo CONCURRENCY để tránh timeout (giống file mẫu)
    for (let start = 0; start < analysis.segments.length; start += CONCURRENCY) {
        const end = Math.min(start + CONCURRENCY, analysis.segments.length);
        const batchNum = Math.floor(start / CONCURRENCY) + 1;
        const totalBatches = Math.ceil(analysis.segments.length / CONCURRENCY);
        
        console.log(`📦 [Step 2] Xử lý batch ${batchNum}/${totalBatches}: segments ${start + 1}-${end}...`);
        
        const indexes = Array.from({ length: end - start }, (_, i) => start + i);
        const tasks = indexes.map((idx, offset) => (async () => {
            if (offset > 0) await sleep(100 * offset); // Stagger requests (giống file mẫu)
            return await processOneSegment(idx);
        })());
        
        const batchResults = await Promise.all(tasks);
        veo3Results.push(...batchResults);
        
        console.log(`✅ [Step 2] Batch ${batchNum}/${totalBatches} hoàn thành: ${batchResults.filter(r => r.success).length}/${batchResults.length} thành công`);
        
        // Nghỉ giữa các batch (giống file mẫu)
        if (end < analysis.segments.length) {
            await sleep(400); // Giảm từ 2000ms xuống 400ms như file mẫu
        }
    }

    // Lưu kết quả (giống format file mẫu)
    const promptsSavePath = path.join(outputDir, 'veo-optimized-prompts.json');
    fs.writeFileSync(promptsSavePath, JSON.stringify(veo3Results.map(r => ({
        segmentIndex: r.segmentIndex,
        timeRange: r.timeRange,
        originalPrompt: r.originalPrompt,
        optimizedPrompt: r.optimizedPrompt,
        detailedTimeline: r.detailedTimeline ?? null, // Thêm detailedTimeline vào saved data
        success: r.success,
        error: r.error ?? null
    })), null, 2), 'utf8');
    console.log(`✅ [Step 2] Đã lưu optimized prompts: ${promptsSavePath}`);

    const successfulOperations = veo3Results.filter(r => r.success);
    console.log(`🚀 Đã gửi ${successfulOperations.length}/${analysis.segments.length} yêu cầu Veo3`);
    
    return { veo3Results, earlyMonitorPromises };
}

async function mergeVideos(videoFiles, outputDir) {
    console.log('🔄 [Step 3] Theo dõi và tải video...');
    
    // Đợi tất cả monitors hoàn thành
    let videoFilesResult = [];
    if (videoFiles && videoFiles.length > 0) {
        videoFilesResult = await Promise.all(videoFiles);
    }
    const successfulVideos = videoFilesResult.filter(v => v.success);
    console.log(`✅ [Step 3] Đã tải ${successfulVideos.length} video thành công`);

    // Ghép video
    if (successfulVideos.length === 0) throw new Error('Không có video nào được tải về');
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

    const finalVideoPath = path.join(outputDir, `cat_adventure_5min_final_${Date.now()}.mp4`);
    const mergeCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${finalVideoPath}"`;
    await execAsync(mergeCmd);
    console.log(`🎉 Đã ghép video: ${finalVideoPath}`);

    // Thêm nhạc nền nếu có
    let resultFinalVideoPath = finalVideoPath;
    try {
        const musicPath = path.resolve(path.join(__dirname, 'Diamonds.mp3'));
        if (fs.existsSync(musicPath)) {
            const finalWithAudioPath = finalVideoPath.replace(/\.mp4$/i, '_with_audio.mp4');
            const videoHasAudio = await hasAudioStream(finalVideoPath);
            if (videoHasAudio) {
                const mixCmd = `ffmpeg -i "${finalVideoPath}" -stream_loop -1 -i "${musicPath}" -filter_complex "[0:a]volume=1.0[a0];[1:a]volume=0.5[a1];[a0][a1]amix=inputs=2:duration=shortest:dropout_transition=2[aout]" -map 0:v:0 -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest "${finalWithAudioPath}"`;
                await execAsync(mixCmd);
                console.log(`🎵 Đã trộn nhạc nền: ${finalWithAudioPath}`);
                resultFinalVideoPath = finalWithAudioPath;
            } else {
                const muxCmd = `ffmpeg -i "${finalVideoPath}" -stream_loop -1 -i "${musicPath}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest "${finalWithAudioPath}"`;
                await execAsync(muxCmd);
                console.log(`🎵 Đã thêm nhạc nền: ${finalWithAudioPath}`);
                resultFinalVideoPath = finalWithAudioPath;
            }
        }
    } catch (e) {
        console.log(`⚠️ Lỗi khi chèn nhạc: ${e.message}`);
    }

    return { finalVideoPath: resultFinalVideoPath, successfulVideos };
}

// Main function
async function main() {
    try {
        console.log(`🚀 [START] Tạo video 5 phút (TEST MODE): Cuộc phiêu lưu của mèo (${NUM_SEGMENTS} segments)...`);
        
        // Step 0: Tạo story
        const { analysis, outputDir, serverUrl } = await createCatAdventureVideo30min();
        
        // Step 2: Xử lý segments
        const { veo3Results, earlyMonitorPromises } = await processVideoSegments(analysis, outputDir, serverUrl);
        
        // Step 3: Merge videos
        const { finalVideoPath, successfulVideos } = await mergeVideos(earlyMonitorPromises, outputDir);
        
        // Lưu kết quả cuối
        const resultPath = path.join(outputDir, `cat-adventure-5min-result.json`);
        const finalResult = {
            timestamp: new Date().toISOString(),
            overallTheme: analysis.overallTheme,
            colorScheme: analysis.colorScheme,
            visualStyle: analysis.visualStyle,
            segmentsCreated: analysis.segments.length,
            veo3OperationsSent: veo3Results.filter(r => r.success).length,
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

// Chạy main
if (require.main === module) {
    main().then(result => {
        if (result.success) {
            console.log('🎉 Hoàn thành thành công!');
            console.log(`🎉 Video: ${result.result.finalVideo}`);
        } else {
            console.log(`❌ Thất bại: ${result.error}`);
        }
    });
}

module.exports = { createCatAdventureVideo30min, processVideoSegments, mergeVideos, main };

