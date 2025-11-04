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
const VEO_PROJECT_ID = (process.env.VEO_PROJECT_ID || '').trim();
const SERVER_URL = 'http://localhost:8888';

// Cấu hình
const SEGMENT_DURATION = 8; // mỗi segment 8s
const TOTAL_DURATION_SECONDS = 5 * 60; // 300s (5 phút)
const NUM_SEGMENTS = Math.floor(TOTAL_DURATION_SECONDS / SEGMENT_DURATION); // 37 cảnh
const CONCURRENCY = 5;

// Network helpers
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Helpers cho ngẫu nhiên
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

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

// Parse JSON utility
function parseJsonFromText(text, outputDir = null) {
    let jsonString = null;
    
    // Nếu đã là JSON object từ response_format, thử parse trực tiếp
    try {
        const directParse = JSON.parse(text);
        if (typeof directParse === 'object' && directParse !== null) {
            return directParse;
        }
    } catch (_) {}
    
    // Tìm JSON trong markdown code block
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
        jsonString = markdownMatch[1].trim();
    } else {
        // Tìm JSON bằng balanced braces
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
    
    if (!jsonString) {
        // Nếu không tìm thấy, thử lấy toàn bộ text
        jsonString = text.trim();
    }
    
    // Clean up JSON
    jsonString = jsonString
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/:\s*'([^']*)'/g, ': "$1"')
        .replace(/\n\s*\n/g, '\n')
        .trim();
    
    try {
        return JSON.parse(jsonString);
    } catch (parseError) {
        // Lưu raw text để debug nếu có outputDir
        if (outputDir) {
            try {
                const errorLogPath = path.join(outputDir, `json-parse-error-${Date.now()}.txt`);
                fs.writeFileSync(errorLogPath, `Original text:\n${text}\n\nExtracted JSON:\n${jsonString}`, 'utf8');
            } catch (_) {}
        }
        throw new Error(`Lỗi parse JSON: ${parseError.message}. JSON string length: ${jsonString.length}`);
    }
}

// Bước 1: Tạo nhân vật chi tiết (ngoại hình, trang phục, màu tóc, màu da) - chuẩn cô gái châu Âu
async function createCharacter() {
    const outputDir = './temp/simple-video';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    console.log('📖 [Bước 1] Tạo nhân vật cô gái châu Âu chi tiết...');
    
    const characterRes = await fetchOpenAIWithRetry({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'Bạn là casting director cho phim live-action châu Âu. Tạo MỘT NHÂN VẬT CÔ GÁI CHÂU ÂU XINH ĐẸP cực kỳ chi tiết. Chỉ tạo ngoại hình (khuôn mặt, tóc, mắt, da, trang phục). Trả về JSON hợp lệ duy nhất.'
            },
            {
                role: 'user',
                content: `Tạo MỘT NHÂN VẬT CÔ GÁI CHÂU ÂU XINH ĐẸP cực kỳ chi tiết:
- Khuôn mặt: mô tả chi tiết (hình dáng, đặc điểm nổi bật)
- Màu tóc: màu tóc châu Âu tự nhiên (vàng, nâu, đen, đỏ...)
- Kiểu tóc: độ dài, kiểu tóc cụ thể
- Màu mắt: màu mắt châu Âu (xanh, xanh lá, nâu, xám...)
- Màu da: tông da châu Âu (trắng, hồng, nâu nhạt...)
- Trang phục: áo, quần/váy, giày, phụ kiện

CHỈ tạo ngoại hình. Việc cầm vật gì trong tay sẽ được quyết định dựa trên hành động và bối cảnh của từng cảnh.

TRẢ VỀ JSON:
{
  "name": string,
  "age": string,
  "appearance": {
    "face": string,        // mô tả khuôn mặt chi tiết
    "hairColor": string,   // màu tóc
    "hairStyle": string,   // kiểu tóc, độ dài
    "eyeColor": string,    // màu mắt
    "skinColor": string,   // màu da
    "body": string         // dáng người, chiều cao
  },
  "outfit": {
    "top": string,
    "bottom": string,
    "footwear": string,
    "accessories": string
  }
}`
            }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
        temperature: 0.9
    });

    if (!characterRes.choices) throw new Error('Không sinh được nhân vật');
    const characterText = characterRes.choices[0].message.content;
    const character = parseJsonFromText(characterText, outputDir);
    
    fs.writeFileSync(path.join(outputDir, 'character.json'), JSON.stringify(character, null, 2), 'utf8');
    console.log(`✅ [Bước 1] Nhân vật: ${character.name} | Tóc: ${character.appearance.hairColor} | Mắt: ${character.appearance.eyeColor}`);
    
    return { character, outputDir };
}

// Bước 2: Tạo câu chuyện ngẫu nhiên gồm 37 cảnh
async function createStory(character, outputDir) {
    console.log(`🧭 [Bước 2] Tạo câu chuyện ${NUM_SEGMENTS} cảnh...`);
    
    // Tạo bối cảnh ngẫu nhiên
    const randomContext = {
        season: randomChoice(['xuân', 'hạ', 'thu', 'đông']),
        timeOfDay: randomChoice(['bình minh', 'sáng', 'trưa', 'chiều', 'hoàng hôn', 'đêm']),
        mainSetting: randomChoice([
            'rừng sâu', 'thành phố', 'ven sông', 'bờ biển', 'núi rừng', 'cánh đồng',
            'ngọn núi', 'thung lũng', 'bờ sông', 'bãi biển', 'đồng lúa',
            'phố cổ châu Âu', 'khu phố hiện đại', 'công viên', 'vườn hoa', 'đường mòn rừng',
            'thị trấn ven biển', 'làng quê', 'đồng cỏ', 'rừng thông', 'hồ nước yên tĩnh'
        ]),
        genreTone: randomChoice(['ấm áp', 'phiêu lưu nhẹ', 'kỳ ảo', 'hài hước', 'truyền cảm hứng'])
    };
    
    const storyRes = await fetchOpenAIWithRetry({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'Bạn là biên kịch phim live-action châu Âu. Tạo câu chuyện 5 phút XUYÊN SUỐT - MỘT CỐT TRUYỆN DUY NHẤT với nhiều sự kiện liên quan với nhau. Chia thành các cảnh 8 giây, mỗi cảnh là hệ quả logic của cảnh trước và dẫn tới cảnh sau (nguyên nhân → hành động → kết quả → dẫn tới cảnh tiếp theo). Mỗi cảnh có SỰ KIỆN/HÀNH ĐỘNG cụ thể. CẢNH PHẢI ĐA DẠNG VỀ ĐỊA ĐIỂM - không được lặp lại cùng một địa điểm trong nhiều cảnh liên tiếp. CHỈ TRẢ VỀ JSON hợp lệ.'
            },
            {
                role: 'user',
                content: `Dùng nhân vật sau cho toàn bộ video:
${JSON.stringify(character)}

YÊU CẦU CÂU CHUYỆN 5 PHÚT XUYÊN SUỐT:
- Phải là MỘT CỐT TRUYỆN DUY NHẤT, có mục tiêu nhỏ, tiến trình, cao trào cảm xúc, kết thúc
- Mỗi cảnh 8s phải là hệ quả logic của cảnh trước và dẫn tới cảnh sau (nguyên nhân → hành động → kết quả → dẫn tới cảnh tiếp theo)
- Cấu trúc: Mở đầu (thiết lập không khí) → Phát triển (một mục tiêu nhỏ/việc cần làm) → Cao trào cảm xúc (khám phá/nhận ra điều ý nghĩa) → Kết thúc (dịu nhẹ, ấm áp)
- Mỗi cảnh phải có SỰ KIỆN/HÀNH ĐỘNG cụ thể (không phải chỉ đi bộ/ngắm cảnh) và góp phần vào tiến trình câu chuyện
- BỐI CẢNH PHẢI ĐA DẠNG: di chuyển giữa nhiều địa điểm (rừng sâu, thành phố, sông, biển, núi, đồng...) - KHÔNG được lặp lại cùng một địa điểm trong nhiều cảnh liên tiếp
- Sự chuyển đổi giữa các bối cảnh phải TỰ NHIÊN và PHỤC VỤ câu chuyện (ví dụ: nhân vật đi tìm kiếm → di chuyển từ nơi này sang nơi khác; nhân vật khám phá → ghé qua nhiều địa điểm)
- Mỗi nhóm 5-7 cảnh phải có ít nhất 3-4 địa điểm khác nhau
- Chủ đề tích cực, slice-of-life ấm áp, không bạo lực
- KHÔNG có chữ overlay, KHÔNG thoại/voice-over
- Phong cách: phim live-action châu Âu, photorealistic

BỐI CẢNH NGẪU NHIÊN:
- Mùa: ${randomContext.season}
- Thời điểm: ${randomContext.timeOfDay}
- Địa điểm chính: ${randomContext.mainSetting}
- Tông thể loại: ${randomContext.genreTone}

TRẢ VỀ JSON:
{
  "overallTheme": string,
  "mainGoal": string,        // mục tiêu chính của câu chuyện
  "scenes": [
    {
      "index": 1,
      "timeStart": 0,
      "timeEnd": 8,
      "location": string,      // địa điểm cụ thể (phải đa dạng)
      "action": string,        // hành động/sự kiện cụ thể
      "description": string,   // mô tả cảnh chi tiết
      "continuity": string     // liên kết với cảnh trước và dẫn tới cảnh sau (ví dụ: "tiếp tục từ cảnh trước, nhân vật phát hiện...", "dẫn tới cảnh sau: nhân vật quyết định...")
    },
    ... đủ ${NUM_SEGMENTS} cảnh ...
  ]
}

QUAN TRỌNG: Mỗi cảnh phải có continuity field giải thích rõ ràng cách cảnh đó liên kết với cảnh trước và dẫn tới cảnh sau, đảm bảo câu chuyện xuyên suốt và logic.`
            }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        temperature: 1.0
    });

    if (!storyRes.choices) throw new Error('Không sinh được story');
    let storyText = storyRes.choices[0].message.content;
    let story;
    
    try {
        story = parseJsonFromText(storyText);
    } catch (parseError) {
        // Lưu raw response để debug
        const errorLogPath = path.join(outputDir, `story-parse-error-${Date.now()}.txt`);
        fs.writeFileSync(errorLogPath, storyText, 'utf8');
        console.warn(`⚠️ Parse story lần 1 thất bại. Đã lưu raw response: ${errorLogPath}`);
        console.warn(`⚠️ Thử lại với chế độ nghiêm ngặt...`);
        
        // Retry với prompt nghiêm ngặt hơn
        const strictRes = await fetchOpenAIWithRetry({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Bạn trả về JSON hợp lệ duy nhất. Không thêm bất kỳ ký tự hoặc giải thích nào ngoài JSON.'
                },
                {
                    role: 'user',
                    content: `Sinh lại story 5 phút theo đúng yêu cầu dưới dạng MỘT JSON HỢP LỆ duy nhất (dùng dấu ":", "," chuẩn, KHÔNG dấu thừa, KHÔNG bình luận, KHÔNG markdown). Thuộc tính bắt buộc: overallTheme, mainGoal, scenes (array ${NUM_SEGMENTS} phần tử với index, timeStart, timeEnd, location, action, description, continuity).\n\nNhân vật:\n${JSON.stringify(character)}\n\nNgữ cảnh ngẫu nhiên:\n${JSON.stringify(randomContext)}\n\nYêu cầu: MỘT CỐT TRUYỆN DUY NHẤT xuyên suốt, mỗi cảnh liên kết logic với cảnh trước và sau.`
                }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 4000,
            temperature: 0.3
        });
        
        if (!strictRes.choices) throw parseError;
        storyText = strictRes.choices[0].message.content;
        story = parseJsonFromText(storyText);
    }

    // Chuẩn hóa scenes
    let scenes = Array.isArray(story.scenes) ? story.scenes.slice(0, NUM_SEGMENTS) : [];
    for (let i = 0; i < NUM_SEGMENTS; i++) {
        if (!scenes[i]) {
            scenes[i] = {
                index: i + 1,
                timeStart: i * SEGMENT_DURATION,
                timeEnd: (i + 1) * SEGMENT_DURATION,
                location: randomContext.mainSetting,
                action: `Scene ${i + 1}`,
                description: `Live-action scene ${i + 1}`
            };
        }
        scenes[i].index = i + 1;
        scenes[i].timeStart = i * SEGMENT_DURATION;
        scenes[i].timeEnd = (i + 1) * SEGMENT_DURATION;
    }

    story.scenes = scenes;
    story.randomContext = randomContext;
    
    fs.writeFileSync(path.join(outputDir, 'story.json'), JSON.stringify(story, null, 2), 'utf8');
    console.log(`✅ [Bước 2] Đã tạo ${scenes.length} cảnh`);
    
    return { story, outputDir };
}

// Bước 3: Ghép nhân vật + cảnh, gửi lên Veo 3
async function sendToVeo3(character, story, outputDir) {
    console.log(`🎬 [Bước 3] Gửi ${story.scenes.length} cảnh lên Veo 3...`);
    
    const veo3Results = [];
    const monitorPromises = [];

    // Monitor và download video
    async function monitorAndDownload(veo3Result) {
        const operationId = veo3Result.operationId;
        console.log(`⏸️  [Monitor] Đợi 60s trước khi kiểm tra op=${operationId}`);
        await sleep(60000);
        
        let attempts = 0;
        const maxAttempts = 100;
        const POLL_INTERVAL_MS = 5000;
        
        while (attempts < maxAttempts) {
            try {
                const statusResponse = await fetch(`${SERVER_URL}/api/check-status`, {
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
                    const downloadResponse = await fetch(`${SERVER_URL}/api/tts/download`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            audioUrl: statusResult.videoUrl,
                            filename: `seg_${veo3Result.segmentIndex}_${Date.now()}.mp4`
                        })
                    });
                    const downloadResult = await downloadResponse.json();
                    if (downloadResult.success) {
                        console.log(`✅ [Monitor] seg=${veo3Result.segmentIndex + 1} hoàn thành`);
                        return {
                            success: true,
                            segmentIndex: veo3Result.segmentIndex,
                            path: downloadResult.savedTo || downloadResult.outPath || downloadResult.path
                        };
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

    // Tạo prompt cho từng cảnh
    function buildPromptForScene(scene, character, story, sceneIndex) {
        const charDesc = `CHARACTER (MUST REMAIN IDENTICAL IN ALL SCENES): ${character.name}, age ${character.age}. Face: ${character.appearance.face}. Hair: ${character.appearance.hairColor} ${character.appearance.hairStyle}. Eyes: ${character.appearance.eyeColor}. Skin: ${character.appearance.skinColor}. Body: ${character.appearance.body}. Outfit: ${character.outfit.top}, ${character.outfit.bottom}, ${character.outfit.footwear}, ${character.outfit.accessories}.`;
        
        const styleEnforce = `PHOTOREALISTIC LIVE-ACTION: European live-action cinema, photorealistic, natural lighting, cinematic composition, real human skin texture, realistic facial features, natural hair movement, authentic clothing fabrics. ABSOLUTELY REALISTIC, PHOTOREALISTIC, LIVE-ACTION, NO animation, NO anime, NO cartoon.`;
        
        // Continuity từ cảnh trước và sau
        const prevScene = sceneIndex > 0 ? story.scenes[sceneIndex - 1] : null;
        const nextScene = sceneIndex < story.scenes.length - 1 ? story.scenes[sceneIndex + 1] : null;
        const continuityInfo = scene.continuity ? `CONTINUITY: ${scene.continuity}. ` : '';
        const prevInfo = prevScene ? `PREVIOUS SCENE CONTEXT: ${prevScene.location} - ${prevScene.action}. ` : '';
        const nextInfo = nextScene ? `NEXT SCENE CONTEXT: ${nextScene.location} - ${nextScene.action}. ` : '';
        const storyContext = story.mainGoal ? `STORY GOAL: ${story.mainGoal}. ` : '';
        
        const sceneDesc = `SCENE [${scene.timeStart}-${scene.timeEnd}s]: ${storyContext}${prevInfo}${continuityInfo}${nextInfo}Location: ${scene.location}. Action: ${scene.action}. ${scene.description}.`;
        
        const negatives = `NEGATIVE: no animation, no anime, no cartoon, no cel-shading, no hand-drawn, no text or subtitles on screen.`;
        
        return `${styleEnforce} ${charDesc} ${sceneDesc} ${negatives}`;
    }

    // Gửi từng cảnh
    async function processOne(index) {
        const scene = story.scenes[index];
        console.log(`➡️  [Bước 3] Segment ${index + 1}/${story.scenes.length}: ${scene.location} | ${scene.action}`);
        
        const prompt = buildPromptForScene(scene, character, story, index);
        let retry = 0;
        const maxRetries = 8;
        
        while (retry < maxRetries) {
            try {
                const resp = await fetch(`${SERVER_URL}/api/create-video`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                    const resultObj = {
                        segmentIndex: index,
                        timeRange: `${scene.timeStart}-${scene.timeEnd}s`,
                        location: scene.location,
                        action: scene.action,
                        prompt,
                        operationId: json.operationName,
                        success: true
                    };
                    monitorPromises.push(monitorAndDownload(resultObj));
                    return resultObj;
                }
                throw new Error(json && json.message ? json.message : 'Create video failed');
            } catch (e) {
                retry++;
                console.log(`⚠️  Segment ${index + 1} retry ${retry}/${maxRetries}: ${e.message}`);
                if (retry < maxRetries) {
                    await sleep(Math.pow(2, retry) * 1500);
                }
            }
        }
        return { segmentIndex: index, timeRange: `${scene.timeStart}-${scene.timeEnd}s`, error: 'Failed after retries', success: false };
    }

    // Xử lý theo batch
    for (let start = 0; start < story.scenes.length; start += CONCURRENCY) {
        const end = Math.min(start + CONCURRENCY, story.scenes.length);
        const batchTasks = [];
        for (let i = start; i < end; i++) {
            const offset = i - start;
            batchTasks.push((async () => {
                if (offset > 0) await sleep(100 * offset);
                return await processOne(i);
            })());
        }
        const batchRes = await Promise.all(batchTasks);
        veo3Results.push(...batchRes);
        if (end < story.scenes.length) await sleep(400);
    }

    // Lưu kết quả
    fs.writeFileSync(path.join(outputDir, 'veo-prompts.json'), JSON.stringify(veo3Results, null, 2), 'utf8');
    console.log(`✅ [Bước 3] Đã gửi ${veo3Results.filter(r => r.success).length}/${veo3Results.length} cảnh`);
    
    return { veo3Results, monitorPromises };
}

// Bước 4: Merge videos
async function mergeVideos(monitorPromises, outputDir) {
    console.log('🔄 [Bước 4] Theo dõi và tải video...');
    
    let videoFiles = [];
    if (monitorPromises && monitorPromises.length > 0) {
        videoFiles = await Promise.all(monitorPromises);
    }
    
    const okFiles = videoFiles.filter(v => v.success && v.path && fs.existsSync(v.path));
    console.log(`✅ [Bước 4] Video tải thành công: ${okFiles.length}`);
    
    if (okFiles.length === 0) throw new Error('Không có video nào được tải về');
    
    okFiles.sort((a, b) => a.segmentIndex - b.segmentIndex);
    
    const listPath = path.join(outputDir, 'video_list.txt');
    const listContent = okFiles.map(v => `file '${path.resolve(v.path).replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(listPath, listContent, 'utf8');
    
    const finalVideoPath = path.join(outputDir, `final_${Date.now()}.mp4`);
    const mergeCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${finalVideoPath}"`;
    await execAsync(mergeCmd);
    
    console.log(`🎉 Đã ghép video: ${finalVideoPath}`);
    return { finalVideoPath, successfulVideos: okFiles };
}

// Main
async function main() {
    try {
        console.log(`🚀 [START] Tạo video live-action 5 phút (${NUM_SEGMENTS} cảnh x ${SEGMENT_DURATION}s)...`);
        
        const { character, outputDir } = await createCharacter();
        const { story, outputDir: storyOutputDir } = await createStory(character, outputDir);
        const { veo3Results, monitorPromises } = await sendToVeo3(character, story, outputDir);
        const { finalVideoPath, successfulVideos } = await mergeVideos(monitorPromises, outputDir);
        
        const result = {
            timestamp: new Date().toISOString(),
            character,
            story: {
                overallTheme: story.overallTheme,
                scenes: story.scenes.map(s => ({
                    index: s.index,
                    location: s.location,
                    action: s.action
                }))
            },
            veo3OperationsSent: veo3Results.filter(r => r.success).length,
            videosDownloaded: successfulVideos.length,
            finalVideo: finalVideoPath,
            outputDir
        };
        
        const resultPath = path.join(outputDir, 'result.json');
        fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');
        console.log(`📊 Lưu kết quả: ${resultPath}`);
        console.log(`🎉 Hoàn thành! Video: ${finalVideoPath}`);
        
        return { success: true, result };
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        return { success: false, error: error.message };
    }
}

if (require.main === module) {
    main().then(r => {
        if (!r.success) {
            console.log(`❌ Thất bại: ${r.error}`);
            process.exit(1);
        }
    });
}

module.exports = { createCharacter, createStory, sendToVeo3, mergeVideos, main };

