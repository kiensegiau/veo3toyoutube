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
        
        // Tạo các yếu tố ngẫu nhiên để đảm bảo kịch bản khác nhau mỗi lần
        const randomElements = {
            seasons: ['xuân', 'hè', 'thu', 'đông'][Math.floor(Math.random() * 4)],
            timeOfDay: ['sáng sớm', 'buổi sáng', 'trưa', 'chiều', 'chiều tối', 'hoàng hôn'][Math.floor(Math.random() * 6)],
            weather: ['nắng đẹp', 'mưa nhẹ', 'có gió', 'trời quang', 'mây bay', 'nắng vàng'][Math.floor(Math.random() * 6)],
            location: ['thành phố hiện đại', 'vùng ngoại ô yên tĩnh', 'gần biển', 'vùng núi nhỏ', 'quê hương', 'khu vườn nhà'][Math.floor(Math.random() * 6)],
            activityPool: ['chơi nhạc cụ', 'câu cá', 'xem phim', 'chơi board game', 'làm bánh', 'đi dạo phố', 'tham quan bảo tàng', 'học vẽ', 'chụp ảnh', 'tắm nắng', 'đọc truyện', 'chơi thể thao', 'dã ngoại', 'cắm trại', 'ngắm sao', 'thả diều', 'vẽ tranh tường', 'trồng cây', 'nướng BBQ', 'chơi xếp hình']
        };
        
        // Chọn 10 hoạt động ngẫu nhiên không trùng lặp
        const selectedActivities = [];
        const shuffled = [...randomElements.activityPool].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(10, shuffled.length); i++) {
            selectedActivities.push(shuffled[i]);
        }
        
        // Log các yếu tố ngẫu nhiên để đảm bảo mỗi lần chạy khác nhau
        console.log(`🎲 [Step 0] Yếu tố ngẫu nhiên: Mùa=${randomElements.seasons}, Thời gian=${randomElements.timeOfDay}, Thời tiết=${randomElements.weather}, Địa điểm=${randomElements.location}`);
        console.log(`🎲 [Step 0] Hoạt động gợi ý: ${selectedActivities.slice(0, 5).join(', ')}... (${selectedActivities.length} hoạt động)`);
        
        const storyResult = await fetchOpenAIWithRetry({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Bạn là biên kịch dựng cảnh cho video 60 giây về gia đình mèo.

YÊU CẦU BẮT BUỘC:
- Nhân vật xuyên suốt: mèo bố, mèo mẹ, mèo con (đặt tên, tính cách nhất quán)
- NHÂN HÓA (anthropomorphic): hình thể dáng người, đi hai chân, tỉ lệ cơ thể người, cử chỉ tay chân như người; khuôn mặt và tai mèo, có lông mèo; có thể mặc trang phục gọn gàng hiện đại phù hợp ngữ cảnh.
- Nội dung PHÙ HỢP TRẺ EM: tích cực, ấm áp, không bạo lực/kinh dị/nguy hiểm, không hành vi xấu.
- Không có chữ/text overlay, không voice-over, chỉ visual và âm thanh nền tự nhiên/nhạc nền.
- Phong cách, bảng màu, không khí nhất quán toàn video.

QUAN TRỌNG - ĐA DẠNG TỐI ĐA & TRÁNH TRÙNG LẶP:
- MỖI LẦN TẠO KỊCH BẢN PHẢI HOÀN TOÀN KHÁC BIỆT về: chủ đề tổng thể, bối cảnh chính, hoạt động, không khí, màu sắc, phong cách visual.
- 10 segment PHẢI có hành động và bối cảnh HOÀN TOÀN KHÁC NHAU, không lặp lại bất kỳ yếu tố nào.
- Nếu segment trước ở trong nhà → segment sau phải ở ngoài trời hoặc địa điểm khác.
- Nếu segment trước là hoạt động tĩnh → segment sau phải là hoạt động động.
- Đảm bảo mỗi segment có góc máy, ánh sáng, không khí riêng biệt.
- Sử dụng các địa điểm đa dạng: nhà, công viên, bãi biển, rừng, thành phố, quán cà phê, thư viện, phòng tập, studio, vườn hoa, sân sau, ban công, mái nhà, v.v.
- Sử dụng các hoạt động đa dạng và SÁNG TẠO, không lặp lại giữa các lần tạo.

NHẤN MẠNH ĐỒNG NHẤT NHÂN VẬT (Character Consistency):
- Trả về thêm characterSheet mô tả CHI TIẾT ngoại hình từng nhân vật để dùng xuyên suốt: giống loài, chiều cao, tỉ lệ cơ thể, màu lông/chấm/hoa văn, dáng mặt, tai, mắt, phụ kiện đặc trưng, trang phục CỐ ĐỊNH (màu/chất liệu/kiểu), đạo cụ yêu thích.
- QUY TẮC: Giữ NGUYÊN khuôn mặt, màu lông, trang phục và phụ kiện của mỗi nhân vật ở tất cả segments; KHÔNG đổi giới tính, tuổi, giống, màu sắc hay trang phục (trừ khi có nêu rõ trong sheet).

Trả về JSON duy nhất:
{
  "overallTheme": string,
  "colorScheme": string,
  "visualStyle": string,
  "characterSheet": {
    "father": { "name": string, "traits": string, "appearance": string, "outfit": string, "uniqueMarks": string },
    "mother": { "name": string, "traits": string, "appearance": string, "outfit": string, "uniqueMarks": string },
    "kitten": { "name": string, "traits": string, "appearance": string, "outfit": string, "uniqueMarks": string }
  },
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
- Mỗi prompt phải CHI TIẾT về bối cảnh, ánh sáng, góc máy để đảm bảo đa dạng tối đa.
`
                },
                {
                    role: 'user',
                    content: `Tạo một câu chuyện gia đình mèo ấm áp, dễ thương, nhịp điệu nhẹ nhàng trong 60 giây, kiểu NHÂN HÓA (anthropomorphic) — mèo dáng người đi hai chân, cử chỉ như người, trang phục hiện đại. 

YÊU CẦU ĐẶC BIỆT:
- Bối cảnh: ${randomElements.location}, ${randomElements.weather}, ${randomElements.timeOfDay}
- Mùa: ${randomElements.seasons}
- Hãy SÁNG TẠO và TẠO RA một câu chuyện HOÀN TOÀN MỚI, chưa từng thấy. Đừng lặp lại các kịch bản thông thường.
- 10 segment phải có bối cảnh và hoạt động HOÀN TOÀN KHÁC NHAU, đa dạng tối đa.
- Gợi ý hoạt động đa dạng (không bắt buộc dùng hết): ${selectedActivities.join(', ')}
- Mỗi segment phải có địa điểm/hoạt động/màu sắc/không khí riêng biệt để tạo sự đa dạng tối đa.

Nội dung thân thiện trẻ em, đa bối cảnh/tiểu chủ đề không trùng lặp giữa các segment.`
                }
            ],
            max_tokens: 4000,
            temperature: 1.2 // Tăng temperature để tăng tính ngẫu nhiên và sáng tạo
        });
        if (!storyResult.choices) throw new Error('Không sinh được kịch bản');
        const storyText = storyResult.choices[0].message.content;
        
        // Tìm JSON trong response (có thể có markdown code block)
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
        
        // Clean up JSON string - fix common issues
        jsonString = jsonString
            // Remove trailing commas before closing braces/brackets
            .replace(/,(\s*[}\]])/g, '$1')
            // Fix single quotes used as string delimiters (replace with double quotes at boundaries)
            .replace(/:\s*'([^']*)'/g, ': "$1"')  // Property values with single quotes
            .replace(/{\s*'([^']*)'/g, '{ "$1"')  // First property key with single quotes
            .replace(/,\s*'([^']*)'/g, ', "$1"')  // Property keys with single quotes
            .trim();
        
        let story;
        try {
            story = JSON.parse(jsonString);
        } catch (parseError) {
            // Thử fix unescaped newlines TRONG strings (không escape newlines ngoài strings)
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
                        // Trong string: escape control characters và unescaped quotes
                        if (char === '\n') {
                            fixedJson += '\\n';
                        } else if (char === '\r') {
                            if (nextChar === '\n') {
                                fixedJson += '\\n';
                                i++; // Skip next \n
                            } else {
                                fixedJson += '\\n';
                            }
                        } else if (char === '\t') {
                            fixedJson += '\\t';
                        } else if (char === '"') {
                            // Unescaped quote trong string - escape nó
                            fixedJson += '\\"';
                        } else {
                            fixedJson += char;
                        }
                    } else {
                        // Ngoài string: giữ nguyên (newlines hợp lệ)
                        fixedJson += char;
                    }
                }
                
                story = JSON.parse(fixedJson);
            } catch (secondError) {
                // Thử cách cuối cùng: fix unescaped quotes trong strings bằng cách rebuild JSON
                try {
                    let finalFixedJson = '';
                    let inString = false;
                    let escapeNext = false;
                    
                    for (let i = 0; i < jsonString.length; i++) {
                        const char = jsonString[i];
                        const nextChar = jsonString[i + 1] || '';
                        
                        if (escapeNext) {
                            finalFixedJson += char;
                            escapeNext = false;
                            continue;
                        }
                        
                        if (char === '\\') {
                            finalFixedJson += char;
                            escapeNext = true;
                            continue;
                        }
                        
                        if (char === '"') {
                            // Check if this is start/end of string or unescaped quote inside string
                            if (inString) {
                                // Đang trong string - check xem có phải kết thúc string không
                                // Nếu ký tự tiếp theo là : hoặc , hoặc } hoặc ] hoặc whitespace thì là kết thúc
                                const afterQuote = jsonString.substring(i + 1).trim();
                                if (afterQuote.match(/^[,:}\]\s]/)) {
                                    // Kết thúc string hợp lệ
                                    inString = false;
                                    finalFixedJson += char;
                                } else {
                                    // Unescaped quote trong string - escape nó
                                    finalFixedJson += '\\"';
                                }
                            } else {
                                // Bắt đầu string
                                inString = true;
                                finalFixedJson += char;
                            }
                            continue;
                        }
                        
                        if (inString) {
                            // Trong string: escape control characters
                            if (char === '\n') {
                                finalFixedJson += '\\n';
                            } else if (char === '\r') {
                                finalFixedJson += '\\n';
                                if (nextChar === '\n') i++; // Skip next \n
                            } else if (char === '\t') {
                                finalFixedJson += '\\t';
                            } else {
                                finalFixedJson += char;
                            }
                        } else {
                            finalFixedJson += char;
                        }
                    }
                    
                    story = JSON.parse(finalFixedJson);
                } catch (thirdError) {
                    console.error('❌ Lỗi parse JSON (lần 1):', parseError.message);
                    console.error('❌ Lỗi parse JSON (sau fix newlines):', secondError.message);
                    console.error('❌ Lỗi parse JSON (sau fix quotes):', thirdError.message);
                    console.error('❌ JSON string (first 500 chars):', jsonString.substring(0, 500));
                    
                    // Log phần quanh lỗi
                    const errorPos = parseInt(thirdError.message.match(/position (\d+)/)?.[1] || secondError.message.match(/position (\d+)/)?.[1] || parseError.message.match(/position (\d+)/)?.[1] || '0');
                    if (errorPos > 0 && errorPos < jsonString.length) {
                        const start = Math.max(0, errorPos - 300);
                        const end = Math.min(jsonString.length, errorPos + 300);
                        console.error('❌ JSON string (around error position):', jsonString.substring(start, end));
                        console.error('❌ Error position:', errorPos, 'Character at position:', JSON.stringify(jsonString[errorPos]));
                    }
                    
                    // Lưu JSON lỗi ra file để debug
                    const errorLogPath = path.join(outputDir, `json-error-${Date.now()}.txt`);
                    try {
                        fs.writeFileSync(errorLogPath, jsonString, 'utf8');
                        console.error(`📄 Đã lưu JSON lỗi vào: ${errorLogPath}`);
                    } catch (_) {}
                    
                    throw new Error(`Lỗi parse JSON: ${parseError.message}. Đã thử 3 cách fix nhưng vẫn lỗi. Vui lòng kiểm tra prompt hoặc thử lại.`);
                }
            }
        }

        const analysis = {
            overallTheme: story.overallTheme,
            colorScheme: story.colorScheme,
            visualStyle: story.visualStyle,
            characterSheet: story.characterSheet || story.characters || {},
            segments: story.segments
        };

        console.log(`✅ [Step 0] Chủ đề: ${analysis.overallTheme}`);
        console.log(`✅ [Step 0] Màu sắc: ${analysis.colorScheme}`);
        console.log(`✅ [Step 0] Phong cách: ${analysis.visualStyle}`);

        

        // Step 2: Tối ưu prompt từng segment (JSON chi tiết 0-2,2-4,4-6)
        console.log('🤖 [Step 2] Tối ưu prompts cho Veo3...');
        const veo3Results = [];
        const earlyMonitorPromises = [];
        const CONCURRENCY = 8; // Tăng từ 5 lên 8 để xử lý nhanh hơn

        async function monitorAndDownload(veo3Result, opts = {}){
            const { startDelayMs = 0, maxAttempts = 100 } = opts; // Tăng maxAttempts để đủ thời gian
            let operationId = veo3Result.operationId;
            let recreateAttempts = 0;
            const maxRecreate = 2;
            const promptForRecreate = veo3Result.optimizedPrompt || veo3Result.originalPrompt || '';
            console.log(`🔄 [Monitor] Start op=${operationId} seg=${veo3Result.segmentIndex + 1}`);
            
            // Đợi 1 phút trước khi bắt đầu kiểm tra lần đầu
            const INITIAL_DELAY_MS = 60000; // 1 phút = 60 giây
            console.log(`⏸️  [Monitor] Đợi ${INITIAL_DELAY_MS/1000}s trước khi bắt đầu kiểm tra...`);
            await sleep(INITIAL_DELAY_MS);
            console.log(`🔍 [Monitor] Bắt đầu kiểm tra op=${operationId} seg=${veo3Result.segmentIndex + 1}`);
            
            let attempts = 0;
            const startTs = Date.now();
            
            // Polling cố định: kiểm tra mỗi 5 giây sau lần kiểm tra đầu
            const POLL_INTERVAL_MS = 5000; // Poll cố định mỗi 5 giây
            
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
                                        aspectRatio: 'PORTRAIT', // Yêu cầu khổ dọc
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
            console.log(`🎬 [Step 2] Segment ${index + 1}: ${segment.timeRange} | ${segment.focus}`);
            try {
                const prevSegment = index > 0 ? analysis.segments[index - 1] : null;
                const nextSegment = index < analysis.segments.length - 1 ? analysis.segments[index + 1] : null;

                // Xây dựng character description chi tiết
                const characterSheet = analysis?.characterSheet || {};
                const fatherInfo = characterSheet.father || {};
                const motherInfo = characterSheet.mother || {};
                const kittenInfo = characterSheet.kitten || {};
                
                const characterDescription = `NHÂN VẬT (NHẤT QUÁN 100%):
- Mèo bố (${fatherInfo.name || 'Father'}): ${fatherInfo.appearance || ''}. Trang phục: ${fatherInfo.outfit || ''}. Đặc điểm: ${fatherInfo.uniqueMarks || ''}. Tính cách: ${fatherInfo.traits || ''}.
- Mèo mẹ (${motherInfo.name || 'Mother'}): ${motherInfo.appearance || ''}. Trang phục: ${motherInfo.outfit || ''}. Đặc điểm: ${motherInfo.uniqueMarks || ''}. Tính cách: ${motherInfo.traits || ''}.
- Mèo con (${kittenInfo.name || 'Kitten'}): ${kittenInfo.appearance || ''}. Trang phục: ${kittenInfo.outfit || ''}. Đặc điểm: ${kittenInfo.uniqueMarks || ''}. Tính cách: ${kittenInfo.traits || ''}.

QUY TẮC NGHIÊM NGẶT: Nhân vật PHẢI GIỐNG HỆT NHAU ở mọi segment: cùng khuôn mặt, cùng màu lông/hoa văn, cùng trang phục, cùng tỉ lệ cơ thể. KHÔNG BAO GIỜ thay đổi ngoại hình.`;

                const optimizeResult = await fetchOpenAIWithRetry({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                    content: `Bạn tối ưu prompt Veo 3.1 cho video 6 giây về gia đình mèo.

QUAN TRỌNG NHẤT - NHẤT QUÁN NHÂN VẬT (100% MANDATORY):
- BẮT BUỘC: Mỗi scene có nhân vật xuất hiện PHẢI mô tả đầy đủ: TÊN + NGOẠI HÌNH + TRANG PHỤC + ĐẶC ĐIỂM
- Ví dụ: "${fatherInfo.name || 'Father'} (${fatherInfo.appearance || 'mô tả ngoại hình'}, ${fatherInfo.outfit || 'trang phục'}, ${fatherInfo.uniqueMarks || 'đặc điểm'}) đang [hành động]"
- KHÔNG BAO GIỜ thay đổi bất kỳ chi tiết nào của nhân vật: khuôn mặt, màu lông, hoa văn, trang phục, tỉ lệ cơ thể, đặc điểm riêng
- Mỗi nhân vật PHẢI giống hệt nhau trong TẤT CẢ scenes - KHÔNG có ngoại lệ

Trả về MỘT JSON ARRAY 3 phần tử (0-2s,2-4s,4-6s). Không thêm giải thích:
[
  {
    "timeStart": 0,
    "timeEnd": 2,
    "action": "BẮT BUỘC: Mô tả hành động + TÊN nhân vật + NGOẠI HÌNH đầy đủ + TRANG PHỤC + ĐẶC ĐIỂM (ví dụ: 'Tommy (mèo nâu sọc đen, áo xanh, vết trắng chân trái) đang...')",
    "cameraStyle": "zoom/pan/tilt/steady...",
    "transition": "fade/dissolve/cut/...",
    "soundFocus": "ambient sounds/background music (NO voice-over/speech/dialogue)",
    "visualDetails": "màu sắc, ánh sáng, texture, style, và mô tả chi tiết ngoại hình nhân vật"
  },
  ...
]
YÊU CẦU:
- Phù hợp trẻ em: tích cực, an toàn, không bạo lực/giật mình.
- Không text overlay, không narration/voice.
- Giữ nguyên chủ đề toàn cục và NHÂN HÓA.
- TRÁNH TRÙNG LẶP: nếu segment trước đã có hành động X/bối cảnh Y, hãy chọn hành động/góc máy/đạo cụ khác cho segment hiện tại.
- MANDATORY: Mỗi action có nhân vật PHẢI bắt đầu bằng mô tả đầy đủ ngoại hình theo format: "Tên (ngoại hình, trang phục, đặc điểm) đang..."`
                        },
                        {
                            role: 'user',
                            content: `${characterDescription}

Chủ đề: ${analysis.overallTheme}
Màu sắc: ${analysis.colorScheme}
Phong cách: ${analysis.visualStyle}
Segment ${index + 1}/${analysis.segments.length}: ${segment.timeRange}
Focus: ${segment.focus}
Original prompt: ${segment.prompt}
${prevSegment ? `Segment trước: ${prevSegment.timeRange} - ${prevSegment.focus}` : 'Đầu video: dùng fade in'}
${nextSegment ? `Segment sau: ${nextSegment.timeRange} - ${nextSegment.focus}` : 'Cuối video: dùng fade out'}

LƯU Ý: Khi mô tả action, NHẤT ĐỊNH phải mô tả chi tiết ngoại hình nhân vật nếu họ xuất hiện trong scene. Ví dụ: "Mèo bố (tên) với [mô tả ngoại hình], mặc [trang phục], [đặc điểm] đang [hành động]".`
                        }
                    ],
                    max_tokens: 1500,
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
                    // Build character context CHI TIẾT và RÕ RÀNG
                    const fatherDesc = `${fatherInfo.name || 'Father cat'}: ${fatherInfo.appearance || 'anthropomorphic cat with human-like body'}, wearing ${fatherInfo.outfit || 'clothing'}, distinctive marks: ${fatherInfo.uniqueMarks || 'none'}`;
                    const motherDesc = `${motherInfo.name || 'Mother cat'}: ${motherInfo.appearance || 'anthropomorphic cat with human-like body'}, wearing ${motherInfo.outfit || 'clothing'}, distinctive marks: ${motherInfo.uniqueMarks || 'none'}`;
                    const kittenDesc = `${kittenInfo.name || 'Kitten'}: ${kittenInfo.appearance || 'anthropomorphic cat with human-like body'}, wearing ${kittenInfo.outfit || 'clothing'}, distinctive marks: ${kittenInfo.uniqueMarks || 'none'}`;
                    
                    const characterContext = `CHARACTER SHEET (MUST APPEAR IDENTICAL IN EVERY SCENE): ${fatherDesc}. ${motherDesc}. ${kittenDesc}. CRITICAL RULE: These characters MUST look EXACTLY THE SAME in every scene - same face, same fur color/patterns, same outfit, same body proportions, same unique marks. NEVER change their appearance.`;
                    
                    const themeContext = `[STORY CONTEXT: ${analysis.overallTheme}. Visual Style: ${analysis.visualStyle}. Color Scheme: ${analysis.colorScheme}. ${characterContext}] `;
                    
                    // Build character reference để dùng trong mỗi scene
                    const fatherRef = `${fatherInfo.name || 'Father'} (${fatherInfo.appearance || ''}, ${fatherInfo.outfit || ''}, ${fatherInfo.uniqueMarks || ''})`;
                    const motherRef = `${motherInfo.name || 'Mother'} (${motherInfo.appearance || ''}, ${motherInfo.outfit || ''}, ${motherInfo.uniqueMarks || ''})`;
                    const kittenRef = `${kittenInfo.name || 'Kitten'} (${kittenInfo.appearance || ''}, ${kittenInfo.outfit || ''}, ${kittenInfo.uniqueMarks || ''})`;
                    
                    const scenesDescription = detailedTimeline.map((scene) => {
                        const transitionText = scene.transition ? `Transition: ${scene.transition}.` : '';
                        const soundText = scene.soundFocus ? scene.soundFocus.replace(/voice-over|voice over|narration|dialogue|speech|talking|speaking|narrator|human voice/gi, 'ambient sound') : 'ambient sound';
                        
                        // Build action text với character description đầy đủ
                        let actionText = scene.action;
                        
                        // Kiểm tra xem nhân vật nào xuất hiện trong scene và đảm bảo có mô tả đầy đủ
                        const actionLower = actionText.toLowerCase();
                        const mentionsFather = actionLower.includes(fatherInfo.name?.toLowerCase() || 'father') || actionLower.includes('mèo bố') || actionLower.includes('bố');
                        const mentionsMother = actionLower.includes(motherInfo.name?.toLowerCase() || 'mother') || actionLower.includes('mèo mẹ') || actionLower.includes('mẹ');
                        const mentionsKitten = actionLower.includes(kittenInfo.name?.toLowerCase() || 'kitten') || actionLower.includes('mèo con') || actionLower.includes('con');
                        
                        // Nếu nhân vật xuất hiện nhưng không có mô tả đầy đủ, thêm vào
                        let characterDesc = '';
                        if (mentionsFather && !actionText.includes(fatherInfo.appearance || '')) {
                            characterDesc += ` ${fatherRef}`;
                        }
                        if (mentionsMother && !actionText.includes(motherInfo.appearance || '')) {
                            characterDesc += ` ${motherRef}`;
                        }
                        if (mentionsKitten && !actionText.includes(kittenInfo.appearance || '')) {
                            characterDesc += ` ${kittenRef}`;
                        }
                        
                        // Nếu có nhân vật xuất hiện, thêm reminder về tính nhất quán
                        if (mentionsFather || mentionsMother || mentionsKitten) {
                            characterDesc += ' [CHARACTERS MUST LOOK IDENTICAL - same face, fur, outfit, body proportions]';
                        }
                        
                        return `[${scene.timeStart}-${scene.timeEnd}s] ${transitionText} ${actionText}${characterDesc}. Camera: ${scene.cameraStyle}. Visual details: ${scene.visualDetails}. Sound: ${soundText} (NO voice-over, NO speech, NO dialogue).`;
                    }).join(' ');
                    
                    optimizedPrompt = themeContext + scenesDescription + ' [CRITICAL RULE: CHARACTERS MUST APPEAR IDENTICAL IN EVERY SINGLE FRAME OF THIS VIDEO - exact same faces, exact same fur colors/patterns, exact same outfits, exact same body proportions, exact same unique marks. DO NOT change any aspect of character appearance. CONSISTENCY IS MANDATORY. NO voice-over, NO narration, NO dialogue, NO speech, NO human voice. Only visual content with ambient sounds/background music.]';
                } else {
                    // Fallback với character description đầy đủ
                    const characterFallback = `CHARACTER CONSISTENCY: Father (${fatherInfo.name || 'Father'}) - ${fatherInfo.appearance || ''}, wearing ${fatherInfo.outfit || ''}. Mother (${motherInfo.name || 'Mother'}) - ${motherInfo.appearance || ''}, wearing ${motherInfo.outfit || ''}. Kitten (${kittenInfo.name || 'Kitten'}) - ${kittenInfo.appearance || ''}, wearing ${kittenInfo.outfit || ''}. These characters MUST look identical in every scene - same face, fur color/patterns, outfits, body proportions.`;
                    optimizedPrompt = `${segment.prompt}. ${characterFallback}. [IMPORTANT: NO voice-over, NO narration, NO dialogue, NO speech, NO human voice. Only visual content with ambient sounds/background music.]`;
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
                                aspectRatio: 'PORTRAIT', // Yêu cầu khổ dọc
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
                    console.log(`🧭 [Step 3] ĐÃ GỬI prompt cho segment ${index + 1}.`);
                    console.log(`🕒 [Step 3] LỊCH THEO DÕI: đợi 60s rồi mới kiểm tra lần đầu, sau đó poll cố định mỗi 5s, tối đa 100 lần.`);
                    // Chạy ngầm theo dõi: đợi 1 phút rồi mới bắt đầu kiểm tra, sau đó mỗi 5s một lần
                    earlyMonitorPromises.push(monitorAndDownload(resultObj, { startDelayMs: 0, maxAttempts: 100 }));
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
                if (offset > 0) await sleep(100 * offset); // Giảm từ 200ms xuống 100ms
                return await processOneSegment(idx);
            })());
            const batchResults = await Promise.all(tasks);
            veo3Results.push(...batchResults);
            if (end < analysis.segments.length) await sleep(400); // Giảm từ 800ms xuống 400ms
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

        // Thêm âm thanh nền Diamonds.mp3 nếu có trong thư mục gốc
        try {
            const musicPath = path.resolve(path.join(__dirname, 'Diamonds.mp3'));
            if (fs.existsSync(musicPath)) {
                const finalWithAudioPath = finalVideoPath.replace(/\.mp4$/i, '_with_audio.mp4');
                const videoHasAudio = await hasAudioStream(finalVideoPath);
                if (videoHasAudio) {
                    // Giữ nguyên âm thanh gốc + trộn thêm nhạc nền (giảm volume nhạc)
                    const mixCmd = `ffmpeg -i "${finalVideoPath}" -stream_loop -1 -i "${musicPath}" -filter_complex "[0:a]volume=1.0[a0];[1:a]volume=1.0[a1];[a0][a1]amix=inputs=2:duration=shortest:dropout_transition=2[aout]" -map 0:v:0 -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest "${finalWithAudioPath}"`;
                    await execAsync(mixCmd);
                    console.log(`🎵 Đã trộn nhạc nền, GIỮ âm thanh gốc: ${finalWithAudioPath}`);
                } else {
                    // Nếu video không có audio gốc: chỉ ghép nhạc nền
                    const muxCmd = `ffmpeg -i "${finalVideoPath}" -stream_loop -1 -i "${musicPath}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest "${finalWithAudioPath}"`;
                    await execAsync(muxCmd);
                    console.log(`🎵 Video không có audio gốc, đã thêm nhạc nền: ${finalWithAudioPath}`);
                }
                // Ghi đè đường dẫn kết quả chính sang file có nhạc
                resultFinalVideoPath = finalWithAudioPath;
            } else {
                console.log('🎵 Bỏ qua chèn nhạc: không tìm thấy Diamonds.mp3 ở thư mục gốc');
            }
        } catch (e) {
            console.log(`⚠️ Lỗi khi chèn nhạc nền: ${e.message}`);
        }

        const resultPath = path.join(outputDir, `cat-family-60s-result.json`);
        const finalResult = {
            timestamp: new Date().toISOString(),
            overallTheme: analysis.overallTheme,
            colorScheme: analysis.colorScheme,
            visualStyle: analysis.visualStyle,
            segmentsCreated: analysis.segments.length,
            veo3OperationsSent: successfulOperations.length,
            videosDownloaded: successfulVideos.length,
            finalVideo: typeof resultFinalVideoPath !== 'undefined' ? resultFinalVideoPath : finalVideoPath,
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


