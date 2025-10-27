const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

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
 * Tạo video 32s với transcript MH370 và hình ảnh đồng nhất
 */
async function createMH370Video32s() {
    try {
        console.log('🚀 [MH370] Tạo video 32s với transcript MH370...');
        
        const serverUrl = 'http://localhost:8888';
        const youtubeUrl = 'https://youtu.be/52ru0qDc0LQ?si=zahSVRyDiQy7Jd6H';
        const outputDir = './temp/mh370-32s-video';
        
        // Tạo thư mục output
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Step 1: Lấy transcript từ YouTube
        console.log('📝 [Step 1] Lấy transcript từ YouTube MH370...');
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
        
        // Step 2: ChatGPT phân tích và tạo prompt đồng nhất cho 4 segments
        console.log('🤖 [Step 2] ChatGPT tạo prompt đồng nhất cho 4 segments...');
        
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
                        content: `Bạn là chuyên gia tạo prompt video cho Veo3 với khả năng tạo hình ảnh đồng nhất và liền mạch.

⚠️ QUAN TRỌNG: Veo3 KHÔNG hỗ trợ text/chữ trong video. TUYỆT ĐỐI KHÔNG tạo prompt có chữ, caption, subtitle.

Nhiệm vụ: Dựa trên transcript, tạo 4 prompts cho 4 segments 8s (tổng 32s) với:
1. HÌNH ẢNH ĐỒNG NHẤT về nội dung transcript - CHỈ VISUAL, KHÔNG CHỮ
2. MÀU SẮC NHẤT QUÁN (chọn bảng màu phù hợp với chủ đề)
3. PHONG CÁCH phù hợp với nội dung (documentary, cinematic, artistic, etc)
4. CHUYỂN TIẾP MƯỢT MÀ giữa các segments
5. CHI TIẾT CỤ THỂ cho từng segment - KHÔNG TEXT OVERLAY

Trả về JSON format:
{
    "overallTheme": "Chủ đề tổng thể",
    "colorScheme": "Bảng màu chính",
    "visualStyle": "Phong cách visual",
    "segments": [
        {
            "timeRange": "0-8s",
            "focus": "Nội dung chính của segment",
            "prompt": "Prompt chi tiết cho Veo3 với hình ảnh cụ thể"
        },
        {
            "timeRange": "8-16s", 
            "focus": "Nội dung chính của segment",
            "prompt": "Prompt chi tiết cho Veo3 với hình ảnh cụ thể"
        },
        {
            "timeRange": "16-24s",
            "focus": "Nội dung chính của segment", 
            "prompt": "Prompt chi tiết cho Veo3 với hình ảnh cụ thể"
        },
        {
            "timeRange": "24-32s",
            "focus": "Nội dung chính của segment",
            "prompt": "Prompt chi tiết cho Veo3 với hình ảnh cụ thể"
        }
    ]
}` 
                    },
                    { 
                        role: "user", 
                        content: `Dựa trên transcript này, tạo 4 prompts đồng nhất cho video 32s:

TRANSCRIPT:
${transcriptText}

YÊU CẦU:
- Mỗi segment 8s phải có hình ảnh cụ thể liên quan đến nội dung transcript
- Đồng nhất về màu sắc và phong cách
- Chuyển tiếp mượt mà giữa các segments
- Chi tiết cụ thể: scenes, objects, actions dựa trên nội dung

⚠️ TUYỆT ĐỐI KHÔNG ĐƯỢC:
❌ KHÔNG tạo prompt có bất kỳ text/chữ nào xuất hiện trong video
❌ KHÔNG có text overlay, caption, subtitle, title
❌ KHÔNG có hiệu ứng đồ họa có chữ
✅ CHỈ có hình ảnh thuần túy: objects, scenes, actions, movements` 
                    }
                ],
                max_tokens: 2000,
                temperature: 0.7
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

⚠️ QUAN TRỌNG - TUYỆT ĐỐI KHÔNG ĐƯỢC:
❌ KHÔNG có text/chữ/subtitle xuất hiện trong video
❌ KHÔNG có dòng chữ "MH370", "Mất tích", "Tìm kiếm", etc.
❌ KHÔNG có caption, title, watermark
❌ KHÔNG có biểu tượng chữ viết nào
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

YÊU CẦU CHI TIẾT:
- Chia thành 4 scenes: 0-2s, 2-4s, 4-6s, 6-8s
- action: hành động cụ thể dựa trên nội dung - KHÔNG TEXT/CHỮ
- cameraStyle: camera movement rõ ràng (zoom in/out, pan left/right/up/down, tilt, steady, tracking shot)
- transition: chuyển cảnh phù hợp (fade, dissolve, cut, smooth pan, cross dissolve, match cut)
- soundFocus: âm thanh phù hợp với nội dung (ambient, dramatic music, nature sounds, effects)
- visualDetails: màu ${analysis.colorScheme}, phong cách ${analysis.visualStyle}, lighting, texture, atmosphere

⚠️ TUYỆT ĐỐI:
- KHÔNG có text overlay, subtitle, caption bất kỳ
- KHÔNG có chữ viết xuất hiện trong video
- CHỈ có hình ảnh thuần túy: objects, scenes, actions, movements
- Veo3 không hỗ trợ render chữ, nên TRÁNH HOÀN TOÀN

QUAN TRỌNG VỀ TRANSITION GIỮA SEGMENTS:
- Scene 1 (0-2s): PHẢI transition mượt mà TỪ ${prevSegment ? `"${prevSegment.focus}" của segment trước` : 'màn hình đen với fade in'}
  ${prevSegment ? `→ Visual phải liên kết với scene cuối segment trước, dùng cross dissolve, match cut hoặc smooth pan` : '→ Fade in từ đen, hoặc slow zoom in'}
- Scenes 2-3 (2-6s): transition mượt giữa các scenes TRONG segment này
  → Dùng dissolve, smooth camera movement để kết nối
- Scene 4 (6-8s): PHẢI chuẩn bị transition SANG ${nextSegment ? `"${nextSegment.focus}" của segment sau` : 'kết thúc với fade out'}
  ${nextSegment ? `→ Visual và camera phải setup cho scene đầu segment sau, tạo continuity` : '→ Fade out hoặc slow zoom out để kết thúc'}

🎬 MỤC TIÊU: 4 segments ghép lại phải liền mạch như 1 video duy nhất!

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
                        temperature: 0.7
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
        
        console.log(`✅ [Step 3] Đã tối ưu và gửi ${successfulOperations.length}/4 Veo3 requests`);
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
                                filename: `mh370_segment_${veo3Result.segmentIndex}_${Date.now()}.mp4`
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
            const listPath = path.join(outputDir, 'mh370_video_list.txt');
            const listContent = validVideoFiles.map(video => {
                const absolutePath = path.resolve(video.path);
                const normalizedPath = absolutePath.replace(/\\/g, '/');
                return `file '${normalizedPath}'`;
            }).join('\n');
            
            console.log(`📝 [Step 5] Tạo file list: ${listPath}`);
            fs.writeFileSync(listPath, listContent, 'utf8');
            
            // Ghép video
            const finalVideoPath = path.join(outputDir, `mh370_32s_final_${Date.now()}.mp4`);
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
            
            const resultPath = path.join(outputDir, 'mh370-32s-result.json');
            fs.writeFileSync(resultPath, JSON.stringify(finalResult, null, 2));
            
            console.log(`📊 [Step 5] Đã lưu kết quả vào: ${resultPath}`);
            
            console.log('🎉 [MH370] Hoàn thành tạo video 32s với transcript MH370!');
            console.log(`🎉 [MH370] Video kết quả: ${finalVideoPath}`);
            console.log(`🎉 [MH370] Chủ đề: ${analysis.overallTheme}`);
            console.log(`🎉 [MH370] Màu sắc: ${analysis.colorScheme}`);
            
            return {
                success: true,
                result: finalResult
            };
            
        } else {
            throw new Error('Không có video nào được tải về để ghép');
        }
        
    } catch (error) {
        console.error(`❌ [MH370] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

console.log('🚀 [START] Tạo video 32s với transcript MH370...');
createMH370Video32s().then(result => {
    if (result.success) {
        console.log('🎉 [MH370] Hoàn thành thành công!');
        console.log(`🎉 [MH370] Video: ${result.result.finalVideo}`);
    } else {
        console.log(`❌ [MH370] Thất bại: ${result.error}`);
    }
});
