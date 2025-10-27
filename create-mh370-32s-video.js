const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

// Video Configuration
const VIDEO_DURATION = 120; // Total video duration (seconds)
const SEGMENT_DURATION = 8; // Each segment duration (seconds)
const NUM_SEGMENTS = Math.floor(VIDEO_DURATION / SEGMENT_DURATION);

// Cache cookie để tránh lấy liên tục
let cachedCookie = null;
let cookieCacheTime = 0;
const COOKIE_CACHE_DURATION = 30 * 60 * 1000; // 30 phút

/**
 * Lấy cookie từ cache hoặc fetch mới
 */
async function getCachedOrFreshCookie(serverUrl) {
    const now = Date.now();
    
    // Nếu có cache và chưa hết hạn
    if (cachedCookie && (now - cookieCacheTime) < COOKIE_CACHE_DURATION) {
        console.log(`🍪 Sử dụng cached cookie (còn ${Math.floor((COOKIE_CACHE_DURATION - (now - cookieCacheTime)) / 1000 / 60)} phút)`);
        return cachedCookie;
    }
    
    // Lấy cookie mới
    console.log(`🔄 Lấy cookie mới từ server...`);
    try {
        const response = await fetch(`${serverUrl}/api/labs/get-cookies`, {
            method: 'GET'
        });
        
        const result = await response.json();
        
        if (result.success && result.cookies) {
            cachedCookie = result.cookies;
            cookieCacheTime = now;
            console.log(`✅ Đã cache cookie mới`);
            return cachedCookie;
        } else {
            throw new Error('Không lấy được cookie từ server');
        }
    } catch (error) {
        console.error(`❌ Lỗi lấy cookie:`, error.message);
        return null;
    }
}

/**
 * Tạo video với transcript và hình ảnh đồng nhất
 */
async function createMH370Video32s() {
    try {
        const videoMinutes = Math.floor(VIDEO_DURATION / 60);
        const videoSeconds = VIDEO_DURATION % 60;
        const durationText = videoMinutes > 0 ? `${videoMinutes}:${videoSeconds.toString().padStart(2, '0')}` : `${videoSeconds}s`;
        
        console.log(`🚀 Tạo video ${durationText} (${VIDEO_DURATION}s) từ YouTube với ${NUM_SEGMENTS} segments...`);
        
        const serverUrl = 'http://localhost:8888';
        const youtubeUrl = 'https://youtu.be/52ru0qDc0LQ?si=zahSVRyDiQy7Jd6H';
        const outputDir = `./temp/youtube-${VIDEO_DURATION}s-video`;
        
        // Tạo thư mục output
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Step 1: Lấy transcript từ YouTube
        console.log('📝 [Step 1] Lấy transcript từ YouTube...');
        const transcriptResponse = await fetch(`${serverUrl}/api/get-transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: youtubeUrl,
                lang: 'vi'
            })
        });
        
        const transcriptResult = await transcriptResponse.json();
        console.log('📝 [Step 1] Transcript result:', transcriptResult.success ? '✅ Success' : '❌ Failed');
        
        if (!transcriptResult.success) {
            throw new Error(`Không thể lấy transcript: ${transcriptResult.message}`);
        }
        
        const transcriptText = typeof transcriptResult.transcript === 'string' ? 
            transcriptResult.transcript : 
            JSON.stringify(transcriptResult.transcript);
        
        console.log(`📝 [Step 1] Transcript: ${transcriptText.substring(0, 300)}...`);
        
        // Step 2: ChatGPT phân tích và tạo prompt đồng nhất
        console.log(`🤖 [Step 2] ChatGPT tạo prompt đồng nhất cho ${NUM_SEGMENTS} segments (${VIDEO_DURATION}s)...`);
        
        const chatGPTResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { 
                        role: "system", 
                        content: `Bạn là chuyên gia tạo prompt video cho Veo3 với khả năng visual hóa nội dung transcript CHÍNH XÁC.

⚠️ QUAN TRỌNG TUYỆT ĐỐI:
1. 🎯 CHỈ tạo visual DỰA TRÊN nội dung CÓ TRONG transcript - KHÔNG sáng tạo thêm
2. 📖 ĐỌC KỸ transcript, hiểu đúng nội dung, rồi mới visual hóa
3. ✅ Mỗi segment PHẢI khớp với 1 phần CỤ THỂ trong transcript
4. ❌ KHÔNG tạo cảnh không liên quan đến transcript
5. ❌ KHÔNG có text/chữ/caption trong video (Veo3 không hỗ trợ)

Nhiệm vụ: Phân tích transcript thành ${NUM_SEGMENTS} segments (${SEGMENT_DURATION}s/segment, tổng ${VIDEO_DURATION}s):
1. ĐÚNG NỘI DUNG: Mỗi prompt phải visual hóa ĐÚNG 1 phần cụ thể trong transcript
2. MÀU SẮC ĐỒNG NHẤT: Chọn bảng màu phù hợp với chủ đề thực tế của transcript
3. PHONG CÁCH PHÙ HỢP: Documentary/cinematic/artistic tùy nội dung transcript
4. LIÊN KẾT MƯỢT: Các segments chuyển tiếp tự nhiên theo dòng chảy transcript
5. CHI TIẾT CỤ THỂ: Visual cụ thể từ transcript - KHÔNG sáng tạo
6. CÂU CHUYỆN ĐÚNG: Theo đúng logic và thứ tự của transcript

Trả về JSON format với ${NUM_SEGMENTS} segments LIÊN TỤC:
{
    "overallTheme": "Chủ đề CHÍNH duy nhất xuyên suốt video (dựa trên transcript)",
    "colorScheme": "Bảng màu NHẤT QUÁN cho toàn bộ video",
    "visualStyle": "Phong cách ĐỒNG NHẤT (documentary/cinematic/artistic)",
    "segments": [
        {
            "timeRange": "0-${SEGMENT_DURATION}s",
            "focus": "Phần đầu của chủ đề (từ transcript)",
            "prompt": "Visual mở đầu - đúng nội dung transcript, CÓ LIÊN KẾT với segment sau"
        },
        {
            "timeRange": "${SEGMENT_DURATION}-${SEGMENT_DURATION * 2}s", 
            "focus": "Tiếp tục chủ đề (từ transcript)",
            "prompt": "Visual tiếp nối segment trước - cùng BỐI CẢNH, LIÊN KẾT với segment trước/sau"
        },
        ... (tổng ${NUM_SEGMENTS} segments - TẤT CẢ PHẢI CÙNG CHỦ ĐỀ/BỐI CẢNH)
        {
            "timeRange": "${VIDEO_DURATION - SEGMENT_DURATION}-${VIDEO_DURATION}s",
            "focus": "Kết thúc chủ đề (từ transcript)",
            "prompt": "Visual kết thúc - LIÊN KẾT với segment trước, đúng nội dung transcript"
        }
    ]
}

⚠️ LƯU Ý: Tất cả segments PHẢI cùng overallTheme và visualStyle, KHÔNG nhảy sang chủ đề khác!` 
                    },
                    { 
                        role: "user", 
                        content: `🎯 ĐỌC KỸ transcript và tạo ${NUM_SEGMENTS} prompts ĐÚNG NỘI DUNG cho video ${VIDEO_DURATION}s:

📄 TRANSCRIPT:
${transcriptText}

🔍 BƯỚC 1 - ĐỌC VÀ PHÂN TÍCH:
- Đọc KỸ TOÀN BỘ transcript từ đầu đến cuối
- Xác định CHỦ ĐỀ CHÍNH, BỐI CẢNH, và LUỒNG CÂU CHUYỆN
- Nắm rõ các sự kiện, khái niệm, hành động được đề cập
- Xác định MÔI TRƯỜNG/BỐI CẢNH chung xuyên suốt video

🎬 BƯỚC 2 - TẠO ${NUM_SEGMENTS} PROMPTS LIÊN TỤC:
1. CHỦ ĐỀ & BỐI CẢNH XUYÊN SUỐT:
   - Tất cả ${NUM_SEGMENTS} segments PHẢI cùng 1 chủ đề/bối cảnh chính
   - KHÔNG nhảy sang chủ đề/bối cảnh khác không liên quan
   - Visual phải CÓ SỰ LIÊN KẾT giữa các segments
   
2. ĐÚNG NỘI DUNG TRANSCRIPT:
   - Mỗi segment = visual hóa 1 phần CỤ THỂ trong transcript
   - Theo đúng THỨ TỰ và LOGIC của transcript
   - KHÔNG sáng tạo thêm cảnh không được nhắc đến

📋 VÍ DỤ VỀ TÍNH LIÊN TỤC:
✅ ĐÚNG - Video xuyên suốt về "du lịch biển":
   Seg 1: Bãi biển buổi sáng → Seg 2: Lặn biển → Seg 3: Ngắm san hô → Seg 4: Hoàng hôn biển
   → Tất cả cùng BỐI CẢNH BIỂN, liên kết mượt mà

❌ SAI - Nhảy cóc không liên quan:
   Seg 1: Bãi biển → Seg 2: Núi tuyết → Seg 3: Thành phố → Seg 4: Sa mạc
   → Nhảy lung tung, không có sự liên kết

📋 VÍ DỤ ĐÚNG SAI VỚI TRANSCRIPT:
✅ ĐÚNG: Transcript nói "máy bay cất cánh" → Prompt: "Máy bay Boeing cất cánh từ sân bay"
✅ ĐÚNG: Transcript nói "radar mất tín hiệu" → Prompt: "Màn hình radar với tín hiệu biến mất"
❌ SAI: Transcript về "nấu ăn" nhưng segment 5 lại viết về "đá bóng" (không liên quan)
❌ SAI: Tự thêm cảnh không có trong transcript

⚠️ YÊU CẦU VISUAL:
❌ KHÔNG có text/chữ/caption/subtitle/title trong video
❌ KHÔNG có graphic text/watermark/logo
✅ CHỈ visual thuần: objects, scenes, actions, movements, atmosphere

🎯 KIỂM TRA CUỐI CÙNG TRƯỚC KHI TRẢ VỀ:
1. Tất cả ${NUM_SEGMENTS} segments có cùng CHỦ ĐỀ/BỐI CẢNH chính không?
2. Có segment nào nhảy sang chủ đề khác không liên quan không?
3. Visual có thể chuyển tiếp mượt mà từ segment này sang segment khác không?
4. Tất cả đều dựa trên NỘI DUNG CÓ TRONG transcript chứ?

💡 MỤC TIÊU: ${NUM_SEGMENTS} segments ghép lại phải như 1 video LIỀN MẠCH, XUYÊN SUỐT 1 CHỦ ĐỀ!` 
                    }
                ],
                max_tokens: Math.min(16000, NUM_SEGMENTS * 250), // Động dựa trên số segments
                temperature: 0.3 // Thấp để chính xác, ít sáng tạo, tập trung vào transcript
            })
        });
        
        const chatGPTResult = await chatGPTResponse.json();
        console.log('🤖 [Step 2] ChatGPT result:', chatGPTResult.choices ? '✅ Success' : '❌ Failed');
        
        if (!chatGPTResult.choices) {
            throw new Error('ChatGPT không trả về kết quả');
        }
        
        const analysisText = chatGPTResult.choices[0].message.content;
        console.log(`🤖 [Step 2] Phân tích hoàn chỉnh:`);
        console.log(analysisText);
        
        // Parse JSON từ response
        let analysis;
        try {
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
                console.log(`✅ [Step 2] Đã phân tích: ${analysis.overallTheme}`);
                console.log(`✅ [Step 2] Màu sắc: ${analysis.colorScheme}`);
                console.log(`✅ [Step 2] Phong cách: ${analysis.visualStyle}`);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error(`❌ [Step 2] Không thể parse JSON từ ChatGPT:`, parseError.message);
            throw new Error('ChatGPT không trả về JSON hợp lệ. Vui lòng thử lại.');
        }
        
        // Lấy cookie trước khi tạo videos (chỉ lấy 1 lần cho tất cả)
        console.log('🍪 [Step 3] Lấy/cache cookie trước khi tạo videos...');
        await getCachedOrFreshCookie(serverUrl);
        
        // Step 3: Tối ưu hóa từng prompt với ChatGPT trước khi tạo video
        console.log('🤖 [Step 3] ChatGPT tối ưu hóa từng prompt cho Veo3...');
        
        // Thêm delay giữa các requests để tránh overload
        const veo3Promises = analysis.segments.map(async (segment, index) => {
            // Delay 2 giây cho mỗi segment để tránh gọi đồng thời quá nhiều
            await new Promise(resolve => setTimeout(resolve, index * 2000));
            console.log(`🤖 [Step 3] Tối ưu segment ${index + 1}: ${segment.timeRange}`);
            console.log(`🤖 [Step 3] Focus: ${segment.focus}`);
            
            try {
                // Tạo context về segments trước/sau để đảm bảo liên kết
                const prevSegment = index > 0 ? analysis.segments[index - 1] : null;
                const nextSegment = index < analysis.segments.length - 1 ? analysis.segments[index + 1] : null;
                
                // Gọi ChatGPT để tối ưu prompt với format chi tiết
                const optimizeResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [
                            { 
                                role: "system", 
                                content: `Bạn là chuyên gia tối ưu prompt cho Veo3 (Google Video AI).

Nhiệm vụ: Tối ưu hóa prompt thành JSON array chi tiết cho video 8 giây với CHUYỂN CẢNH mượt mà.

🎯 QUY TẮC VÀNG:
1. CHỈ tối ưu visual của prompt GỐC - KHÔNG đổi nội dung chính
2. KHÔNG thêm cảnh/yếu tố mới không có trong prompt gốc
3. CHỈ thêm chi tiết về: camera, transition, visual details, sound
4. GIỮ NGUYÊN ý nghĩa và nội dung của prompt gốc

⚠️ TUYỆT ĐỐI KHÔNG ĐƯỢC:
❌ KHÔNG có text/chữ/subtitle xuất hiện trong video
❌ KHÔNG có dòng chữ bất kỳ
❌ KHÔNG có caption, title, watermark
❌ KHÔNG có biểu tượng chữ viết
✅ CHỈ có hình ảnh thuần, không text overlay

Trả về ĐÚNG format JSON array này (4 phần tử cho 8 giây):
[
  {
    "timeStart": 0,
    "timeEnd": 2,
    "action": "Mô tả hành động KHÔNG CÓ CHỮ, chỉ visual thuần",
    "cameraStyle": "Phong cách camera (zoom in, pan left, tilt up, steady shot, etc)",
    "transition": "Chuyển cảnh từ scene trước (fade in, dissolve, cut, pan transition, zoom transition, etc)",
    "soundFocus": "Âm thanh tập trung",
    "visualDetails": "Chi tiết visual (màu sắc, ánh sáng, texture, shadows, etc) - KHÔNG CHỮ"
  },
  ...
]

YÊU CẦU CHUYỂN CẢNH:
- Scene đầu tiên: transition liên kết với segment trước (hoặc fade in nếu là segment đầu)
- Các scenes giữa: transition mượt mà (dissolve, smooth pan, gradual zoom)
- Scene cuối cùng: transition chuẩn bị cho segment sau (hoặc fade out nếu là segment cuối)

CHỈ trả về JSON array, KHÔNG có giải thích hay text khác.` 
                            },
                            { 
                                role: "user", 
                                content: `Tối ưu prompt này thành JSON array chi tiết cho video 8 giây với CHUYỂN CẢNH mượt mà:

OVERALL THEME: ${analysis.overallTheme}
COLOR SCHEME: ${analysis.colorScheme}
VISUAL STYLE: ${analysis.visualStyle}

SEGMENT HIỆN TẠI ${index + 1}/4: ${segment.timeRange}
FOCUS: ${segment.focus}
ORIGINAL PROMPT: ${segment.prompt}

BỐI CẢNH LIÊN KẾT:
${prevSegment ? `- SEGMENT TRƯỚC (${prevSegment.timeRange}): ${prevSegment.focus}
  → Scene đầu tiên (0-2s) cần transition mượt mà từ segment trước
  → Prompt gốc segment trước: ${prevSegment.prompt}` : '- ĐÂY LÀ SEGMENT ĐẦU TIÊN\n  → Scene đầu (0-2s) dùng "fade in" hoặc "slow zoom in" để mở màn'}

${nextSegment ? `- SEGMENT SAU (${nextSegment.timeRange}): ${nextSegment.focus}
  → Scene cuối cùng (6-8s) cần transition chuẩn bị cho segment sau
  → Prompt gốc segment sau: ${nextSegment.prompt}` : '- ĐÂY LÀ SEGMENT CUỐI CÙNG\n  → Scene cuối (6-8s) dùng "fade out" hoặc "slow zoom out" để kết thúc'}

🎯 YÊU CẦU TUYỆT ĐỐI:
1. GIỮ NGUYÊN NỘI DUNG của ORIGINAL PROMPT: "${segment.prompt}"
   - KHÔNG thêm yếu tố mới không có trong prompt gốc
   - KHÔNG đổi ý nghĩa chính của prompt gốc
   - CHỈ chia nhỏ thành 4 scenes (0-2s, 2-4s, 4-6s, 6-8s) và thêm chi tiết kỹ thuật

2. CHI TIẾT CẦN THÊM (không đổi nội dung):
   - action: Mô tả visual ĐÚNG với prompt gốc - KHÔNG TEXT/CHỮ
   - cameraStyle: camera movement (zoom in/out, pan left/right/up/down, tilt, steady, tracking shot)
   - transition: chuyển cảnh (fade, dissolve, cut, smooth pan, cross dissolve, match cut)
   - soundFocus: âm thanh phù hợp (ambient, dramatic music, nature sounds, effects)
   - visualDetails: màu ${analysis.colorScheme}, phong cách ${analysis.visualStyle}, lighting, texture, atmosphere

⚠️ TUYỆT ĐỐI KHÔNG ĐƯỢC:
- KHÔNG thêm cảnh/đối tượng/hành động mới không có trong ORIGINAL PROMPT
- KHÔNG có text overlay, subtitle, caption, chữ viết bất kỳ
- CHỈ visual thuần: objects, scenes, actions, movements từ ORIGINAL PROMPT

QUAN TRỌNG VỀ TRANSITION GIỮA SEGMENTS:
- Scene 1 (0-2s): PHẢI transition mượt mà TỪ ${prevSegment ? `"${prevSegment.focus}" của segment trước` : 'màn hình đen với fade in'}
  ${prevSegment ? `→ Visual phải liên kết với scene cuối segment trước, dùng cross dissolve, match cut hoặc smooth pan` : '→ Fade in từ đen, hoặc slow zoom in'}
- Scenes 2-3 (2-6s): transition mượt giữa các scenes TRONG segment này
  → Dùng dissolve, smooth camera movement để kết nối
- Scene 4 (6-${SEGMENT_DURATION}s): PHẢI chuẩn bị transition SANG ${nextSegment ? `"${nextSegment.focus}" của segment sau` : 'kết thúc với fade out'}
  ${nextSegment ? `→ Visual và camera phải setup cho scene đầu segment sau, tạo continuity` : '→ Fade out hoặc slow zoom out để kết thúc'}

🎬 MỤC TIÊU: ${NUM_SEGMENTS} segments ghép lại phải liền mạch như 1 video duy nhất!

📋 VÍ DỤ TRANSITION TỐT (dựa theo nội dung):
- Segment kết thúc với "object xa dần" 
  → Segment sau bắt đầu "zoom vào object mới" (liên kết: movement continuity)
- Segment kết thúc với "scene rộng" 
  → Segment sau bắt đầu "close-up detail" (liên kết: scale transition)
- Segment kết thúc với "màu sáng"
  → Segment sau bắt đầu "màu tương tự" (liên kết: color continuity)
- Segment kết thúc với "camera pan right"
  → Segment sau bắt đầu "camera continues panning" (liên kết: motion continuity)

CHỈ trả về JSON array, KHÔNG thêm text nào khác.` 
                            }
                        ],
                        max_tokens: 1500,
                        temperature: 0.3 // Thấp để giữ đúng nội dung, không sáng tạo thêm
                    })
                });
                
                const optimizeResult = await optimizeResponse.json();
                
                if (!optimizeResult.choices) {
                    throw new Error('ChatGPT optimization failed');
                }
                
                const optimizedContent = optimizeResult.choices[0].message.content.trim();
                
                // Parse JSON array từ response
                let detailedTimeline;
                try {
                    const jsonMatch = optimizedContent.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        detailedTimeline = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error('No JSON array found in response');
                    }
                } catch (parseError) {
                    console.warn(`⚠️ [Step 3] Không parse được JSON, dùng prompt gốc`);
                    detailedTimeline = null;
                }
                
                // Convert JSON array thành string prompt cho Veo3
                let optimizedPrompt;
                if (detailedTimeline && Array.isArray(detailedTimeline)) {
                    // Convert chi tiết timeline thành string description
                    optimizedPrompt = detailedTimeline.map(scene => {
                        const transitionText = scene.transition ? `Transition: ${scene.transition}.` : '';
                        return `[${scene.timeStart}-${scene.timeEnd}s] ${transitionText} ${scene.action}. Camera: ${scene.cameraStyle}. Visual: ${scene.visualDetails}. Sound: ${scene.soundFocus}`;
                    }).join(' ');
                    
                    console.log(`✅ [Step 3] Segment ${index + 1} optimized với ${detailedTimeline.length} scenes chi tiết:`);
                    detailedTimeline.forEach(scene => {
                        console.log(`   [${scene.timeStart}-${scene.timeEnd}s] ${scene.action}`);
                        if (scene.transition) {
                            console.log(`      🔄 Transition: ${scene.transition}`);
                        }
                        console.log(`      📹 Camera: ${scene.cameraStyle}`);
                        console.log(`      🎨 Visual: ${scene.visualDetails}`);
                        console.log(`      🔊 Sound: ${scene.soundFocus}`);
                    });
                } else {
                    // Fallback: dùng prompt gốc
                    optimizedPrompt = segment.prompt;
                    console.log(`⚠️ [Step 3] Segment ${index + 1} dùng prompt gốc`);
                }
                
                // Tạo video với retry mechanism
                console.log(`🎬 [Step 3] Tạo video segment ${index + 1} với prompt string tối ưu...`);
                
                let veo3Result = null;
                let retryCount = 0;
                const maxRetries = 3;
                
                while (retryCount < maxRetries) {
            try {
                const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                                input: optimizedPrompt,
                                prompt: optimizedPrompt
                    })
                });
                
                        veo3Result = await veo3Response.json();
                
                if (veo3Result.success) {
                            break; // Thành công, thoát vòng lặp
                        } else {
                            throw new Error(veo3Result.message || 'Create video failed');
                        }
                    } catch (error) {
                        retryCount++;
                        console.log(`⚠️ [Step 3] Segment ${index + 1} thất bại lần ${retryCount}/${maxRetries}: ${error.message}`);
                        
                        if (retryCount < maxRetries) {
                            // Đợi 3 giây trước khi retry
                            console.log(`⏳ [Step 3] Đợi 3s trước khi retry...`);
                            await new Promise(resolve => setTimeout(resolve, 3000));
                            
                            // Refresh cookie nếu lỗi liên quan đến cookie
                            if (error.message.includes('cookie') || error.message.includes('Chrome Labs')) {
                                console.log(`🔄 [Step 3] Refresh cookie...`);
                                cachedCookie = null; // Xóa cache
                                await getCachedOrFreshCookie(serverUrl);
                            }
                        }
                    }
                }
                
                if (veo3Result && veo3Result.success) {
                    console.log(`✅ [Step 3] Segment ${index + 1} Veo3: ${veo3Result.operationName}`);
                    return {
                        segmentIndex: index,
                        timeRange: segment.timeRange,
                        focus: segment.focus,
                        originalPrompt: segment.prompt,
                        detailedTimeline: detailedTimeline,
                        optimizedPrompt: optimizedPrompt,
                        operationId: veo3Result.operationName,
                        success: true
                    };
                } else {
                    console.log(`❌ [Step 3] Segment ${index + 1} thất bại sau ${maxRetries} lần thử`);
                    return {
                        segmentIndex: index,
                        timeRange: segment.timeRange,
                        error: veo3Result?.message || 'Failed after retries',
                        success: false
                    };
                }
            } catch (error) {
                console.log(`❌ [Step 3] Segment ${index + 1} lỗi: ${error.message}`);
                return {
                    segmentIndex: index,
                    timeRange: segment.timeRange,
                    error: error.message,
                    success: false
                };
            }
        });
        
        // Chờ tất cả Veo3 requests hoàn thành
        const veo3Results = await Promise.all(veo3Promises);
        const successfulOperations = veo3Results.filter(r => r.success);
        
        console.log(`✅ [Step 3] Đã tối ưu và gửi ${successfulOperations.length}/${analysis.segments.length} Veo3 requests`);
        console.log(`🚀 [Step 3] Tất cả Veo3 đang chạy ngầm với prompt đã tối ưu...`);
        
        // Step 4: Chạy ngầm - kiểm tra và tải video khi sẵn sàng
        console.log(`🔄 [Step 4] Chạy ngầm - kiểm tra và tải video khi sẵn sàng...`);
        
        const downloadPromises = successfulOperations.map(async (veo3Result) => {
            const operationId = veo3Result.operationId;
            console.log(`🔄 [Step 4] Monitor operation: ${operationId}`);
            
            // Polling để kiểm tra trạng thái
            let attempts = 0;
            const maxAttempts = 60; // Tối đa 60 lần (5 phút)
            
            while (attempts < maxAttempts) {
                try {
                    const statusResponse = await fetch(`${serverUrl}/api/check-status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            operationName: operationId
                        })
                    });
                    
                    const statusResult = await statusResponse.json();
                    
                    if (statusResult.success && statusResult.videoStatus === 'COMPLETED' && statusResult.videoUrl) {
                        console.log(`✅ [Step 4] Operation ${operationId} đã hoàn thành!`);
                        
                        // Tải video
                        const downloadResponse = await fetch(`${serverUrl}/api/tts/download`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                audioUrl: statusResult.videoUrl,
                                filename: `video_segment_${veo3Result.segmentIndex}_${Date.now()}.mp4`
                            })
                        });
                        
                        const downloadResult = await downloadResponse.json();
                        
                        if (downloadResult.success) {
                            // API trả về savedTo, không phải outPath
                            const videoPath = downloadResult.savedTo || downloadResult.outPath || downloadResult.path;
                            console.log(`✅ [Step 4] Segment ${veo3Result.segmentIndex + 1} đã tải về`);
                            console.log(`✅ [Step 4] Video path: ${videoPath}`);
                            console.log(`✅ [Step 4] Public path: ${downloadResult.publicPath}`);
                            return {
                                segmentIndex: veo3Result.segmentIndex,
                                timeRange: veo3Result.timeRange,
                                focus: veo3Result.focus,
                                path: videoPath,
                                publicPath: downloadResult.publicPath,
                                filename: downloadResult.filename,
                                operationId: operationId,
                                success: true
                            };
                        } else {
                            console.log(`❌ [Step 4] Segment ${veo3Result.segmentIndex + 1} tải về thất bại: ${downloadResult.message}`);
                            return {
                                segmentIndex: veo3Result.segmentIndex,
                                error: 'Download failed',
                                success: false
                            };
                        }
                    } else if (statusResult.success && statusResult.videoStatus === 'PENDING') {
                        console.log(`⏳ [Step 4] Operation ${operationId} đang xử lý... (attempt ${attempts + 1})`);
                        attempts++;
                        await new Promise(resolve => setTimeout(resolve, 5000)); // Chờ 5 giây
                    } else {
                        console.log(`❌ [Step 4] Operation ${operationId} thất bại hoặc không tìm thấy`);
                        return {
                            segmentIndex: veo3Result.segmentIndex,
                            error: 'Operation failed',
                            success: false
                        };
                    }
                } catch (error) {
                    console.warn(`⚠️ [Step 4] Lỗi kiểm tra operation ${operationId}:`, error.message);
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
            
            console.log(`⏰ [Step 4] Operation ${operationId} timeout sau ${maxAttempts} attempts`);
            return {
                segmentIndex: veo3Result.segmentIndex,
                error: 'Timeout',
                success: false
            };
        });
        
        // Chờ tất cả video được tải về
        console.log(`⏳ [Step 4] Chờ tất cả video được tải về...`);
        const videoFiles = await Promise.all(downloadPromises);
        const successfulVideos = videoFiles.filter(v => v.success);
        
        console.log(`✅ [Step 4] Đã tải ${successfulVideos.length}/4 video`);
        
        // Step 5: Ghép video thành 1 video kết quả
        if (successfulVideos.length > 0) {
            console.log(`🎬 [Step 5] Ghép ${successfulVideos.length} video thành 1 video kết quả...`);
            
            // Sắp xếp theo thứ tự
            successfulVideos.sort((a, b) => a.segmentIndex - b.segmentIndex);
            
            // Kiểm tra các file video tồn tại
            const validVideoFiles = successfulVideos.filter(video => {
                if (!video.path || !fs.existsSync(video.path)) {
                    console.warn(`⚠️ [Step 5] File video không tồn tại: ${video.path}`);
                    return false;
                }
                return true;
            });
            
            if (validVideoFiles.length === 0) {
                throw new Error('Không có file video hợp lệ để ghép');
            }
            
            console.log(`📝 [Step 5] Có ${validVideoFiles.length} file video hợp lệ để ghép`);
            
            // Tạo file list cho ffmpeg
            const listPath = path.join(outputDir, 'video_list.txt');
            const listContent = validVideoFiles.map(video => {
                const absolutePath = path.resolve(video.path);
                const normalizedPath = absolutePath.replace(/\\/g, '/');
                return `file '${normalizedPath}'`;
            }).join('\n');
            
            console.log(`📝 [Step 5] Tạo file list: ${listPath}`);
            fs.writeFileSync(listPath, listContent, 'utf8');
            
            // Ghép video
            const finalVideoPath = path.join(outputDir, `video_${VIDEO_DURATION}s_final_${Date.now()}.mp4`);
            const mergeCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${finalVideoPath}"`;
            
            await execAsync(mergeCmd);
            
            console.log(`✅ [Step 5] Đã ghép video thành: ${finalVideoPath}`);
            
            // Lưu kết quả hoàn chỉnh
            const finalResult = {
                timestamp: new Date().toISOString(),
                youtubeUrl: youtubeUrl,
                transcript: transcriptText,
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
            
            const resultPath = path.join(outputDir, `video-${VIDEO_DURATION}s-result.json`);
            fs.writeFileSync(resultPath, JSON.stringify(finalResult, null, 2));
            
            console.log(`📊 [Step 5] Đã lưu kết quả vào: ${resultPath}`);
            
            console.log(`🎉 Hoàn thành tạo video ${VIDEO_DURATION}s!`);
            console.log(`🎉 Video kết quả: ${finalVideoPath}`);
            console.log(`🎉 Chủ đề: ${analysis.overallTheme}`);
            console.log(`🎉 Màu sắc: ${analysis.colorScheme}`);
            
            return {
                success: true,
                result: finalResult
            };
            
        } else {
            throw new Error('Không có video nào được tải về để ghép');
        }
        
    } catch (error) {
        console.error(`❌ Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

console.log(`🚀 [START] Tạo video ${VIDEO_DURATION}s với ${NUM_SEGMENTS} segments từ YouTube...`);
createMH370Video32s().then(result => {
    if (result.success) {
        console.log('🎉 Hoàn thành thành công!');
        console.log(`🎉 Video: ${result.result.finalVideo}`);
    } else {
        console.log(`❌ Thất bại: ${result.error}`);
    }
});
