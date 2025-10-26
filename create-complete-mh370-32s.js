const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

/**
 * Tạo video 5 phút hoàn chỉnh với transcript MH370
 */
async function createCompleteMH370Video5min() {
    try {
        console.log('🚀 [MH370] Tạo video 1 phút hoàn chỉnh với transcript MH370...');
        
        const serverUrl = 'http://localhost:8888';
        const youtubeUrl = 'https://www.youtube.com/watch?v=52ru0qDc0LQ';
        const outputDir = './temp/mh370-complete';
        const MAX_DURATION = 30; // Test với 30 giây
        
        // Validate URL
        const validUrl = youtubeUrl.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/);
        if (!validUrl) {
            throw new Error('URL YouTube không hợp lệ');
        }
        
        // Validate URL
        if (!youtubeUrl.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/)) {
            throw new Error('URL YouTube không hợp lệ');
        }
        
        // Thông số segments
        const SEGMENT_DURATION = 8; // Mỗi segment dài 8 giây

        // Sử dụng giới hạn 5 phút cố định
        const videoDuration = MAX_DURATION; // 5 phút = 300 giây
        const TOTAL_SEGMENTS = Math.ceil(videoDuration / SEGMENT_DURATION);
        
        console.log(`📊 [Info] Thời lượng sẽ xử lý: ${videoDuration} giây (giới hạn ${MAX_DURATION} giây)`);
        console.log(`📊 [Info] Số lượng segments: ${TOTAL_SEGMENTS} (${SEGMENT_DURATION}s/segment)`);
        
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
        
        // Step 2: ChatGPT phân tích và tạo prompt đồng nhất cho 36 segments
        console.log(`🤖 [Step 2] ChatGPT tạo prompt đồng nhất cho ${TOTAL_SEGMENTS} segments (1 phút)...`);
        
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

Nhiệm vụ: Dựa trên transcript về MH370, tạo kịch bản chi tiết cho ${TOTAL_SEGMENTS} segments video, mỗi segment ${SEGMENT_DURATION}s (tổng ${TOTAL_SEGMENTS * SEGMENT_DURATION}s = ${Math.floor((TOTAL_SEGMENTS * SEGMENT_DURATION) / 60)} phút ${(TOTAL_SEGMENTS * SEGMENT_DURATION) % 60} giây).

MỖI SEGMENT 8 GIÂY CẦN:
1. Tập trung vào MỘT chủ đề/nội dung chính
2. Chi tiết timeline theo từng 2 giây:
   {
     "timeStart": 0,
     "timeEnd": 2,
     "action": "Mô tả hành động/cảnh quay cụ thể",
     "cameraStyle": "Góc máy và phong cách quay",
     "soundFocus": "Focus âm thanh chính",
     "visualDetails": "Chi tiết về ánh sáng và không khí"
   }

2. Đặc điểm chung cho mỗi segment:
1. HÌNH ẢNH ĐỒNG NHẤT về chủ đề MH370
2. MÀU SẮC NHẤT QUÁN (xanh dương đậm, đen, trắng)
3. PHONG CÁCH TÀI LIỆU ĐIỀU TRA
4. CHUYỂN TIẾP MƯỢT MÀ giữa các segments
5. CHI TIẾT CỤ THỂ cho từng segment

Trả về JSON format:
{
    "overallTheme": "Chủ đề tổng thể",
    "colorScheme": "Bảng màu chính",
    "visualStyle": "Phong cách visual",
    "segments": [
        {
            "timeRange": "0-8s",
            "focus": "Nội dung chính của segment",
            "prompt": "Prompt tổng quát",
            "detailedTimeline": [
                {
                    "timeStart": 0,
                    "timeEnd": 2,
                    "action": "Mô tả chi tiết hành động/cảnh quay (ví dụ: Close-up of radar screen showing MH370's last known position)",
                    "cameraStyle": "Góc máy và kỹ thuật quay cụ thể (ví dụ: Macro close-up, slow push in)",
                    "visualStyle": "Chi tiết về ánh sáng và không khí (ví dụ: Low-key lighting, blue tint)",
                    "transitionEffect": "Hiệu ứng chuyển cảnh (ví dụ: Subtle fade through)",
                    "graphicElements": "Đồ họa overlay (ví dụ: Flight path overlay, timestamp)",
                    "soundFocus": "Focus âm thanh (ví dụ: Radar beeping, muffled radio chatter)"
                },
                ... // Chi tiết cho từng 2 giây
            ]
        },
        ... (tất cả ${TOTAL_SEGMENTS} segments)
    ]
}

Chú ý: 
1. Tạo đủ ${TOTAL_SEGMENTS} segments, mỗi segment ${SEGMENT_DURATION}s
2. Phân chia nội dung transcript để cover toàn bộ câu chuyện MH370 theo thời lượng video gốc ${Math.floor(videoDuration / 60)} phút ${videoDuration % 60} giây
3. Đảm bảo nội dung được phân bổ đều và hợp lý theo timeline của video` 
                    },
                    { 
                        role: "user", 
                        content: `Dựa trên transcript về MH370 này, tạo 36 prompts đồng nhất cho video 5 phút:

TRANSCRIPT:
${transcriptText}

YÊU CẦU:
- Mỗi segment 8s phải có hình ảnh cụ thể về MH370
- Đồng nhất về màu sắc và phong cách
- Chuyển tiếp mượt mà giữa các segments
- Chi tiết cụ thể: máy bay, biển, vệ tinh, đồ họa điều tra
- Phân chia nội dung transcript đều nhau cho 36 segments` 
                    }
                ],
                max_tokens: 8000,
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
            console.error(`❌ [Step 2] Lỗi khi parse JSON response: ${parseError.message}`);
            throw new Error('Không thể phân tích kết quả từ ChatGPT. Vui lòng thử lại.');
        }
        
        // Step 3: Tối ưu prompt cho từng segment bằng ChatGPT
        console.log('🤖 [Step 3] Tối ưu prompt cho từng segment bằng ChatGPT...');
        
        const optimizedSegments = [];
        for (let i = 0; i < analysis.segments.length; i++) {
            const segment = analysis.segments[i];
            console.log(`🤖 [Step 3] Tối ưu prompt cho segment ${i + 1}: ${segment.timeRange}`);
            
            try {
                const optimizationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                                content: `Bạn là chuyên gia tối ưu prompt cho Veo3 AI.
Nhiệm vụ: Tối ưu prompt cho segment video 8 giây để tạo video mượt mà và chuyên nghiệp.

YÊU CẦU:
1. Tập trung vào MỘT chủ đề chính trong 8 giây
2. Phân tích chi tiết từng 2 giây theo format:
   {
     "timeStart": 0,
     "timeEnd": 2,
     "action": "Mô tả hành động/cảnh quay chi tiết",
     "cameraStyle": "Góc máy và phong cách quay cụ thể",
     "soundFocus": "Focus âm thanh chính của cảnh",
     "visualDetails": "Chi tiết về ánh sáng và không khí"
   }
3. Đảm bảo mỗi đoạn 2 giây có:
   - Một hành động rõ ràng, cụ thể
   - Góc máy và chuyển động camera chuyên nghiệp
   - Âm thanh phù hợp với cảnh
   - Visual và ánh sáng đặc trưng
4. Chuyển cảnh mượt mà giữa các đoạn 2 giây
5. Trả về JSON format:
{
    "segmentTheme": "Chủ đề chính của segment 8 giây",
    "timeline": [
        {
            "timeStart": 0,
            "timeEnd": 2,
            "action": "Mô tả hành động/cảnh quay cụ thể",
            "cameraStyle": "Góc máy và phong cách quay",
            "soundFocus": "Focus âm thanh chính",
            "visualDetails": "Chi tiết về ánh sáng và không khí"
        },
        ... // Chi tiết cho mỗi 2-3 giây
    ],
    "visualNotes": {
        "cameraMovement": "Ghi chú về chuyển động camera",
        "lightingSetup": "Thiết lập ánh sáng",
        "graphicsStyle": "Phong cách đồ họa",
        "colorPalette": "Bảng màu chi tiết"
    },
    "transitionNotes": {
        "fromPrevious": "Chuyển cảnh từ segment trước",
        "toNext": "Chuyển cảnh sang segment sau"
    }
}`
                            },
                            {
                                role: "user",
                                content: `Tối ưu prompt sau cho segment ${segment.timeRange}:
Focus: ${segment.focus}
Original prompt: ${segment.prompt}

Hãy tối ưu để tạo video 8 giây đẹp và chuyên nghiệp nhất.`
                            }
                        ],
                        max_tokens: 1000,
                        temperature: 0.7
                    })
                });

                const optimizationResult = await optimizationResponse.json();
                
                if (optimizationResult.choices) {
                    const content = optimizationResult.choices[0].message.content;
                    console.log('\n🔍 [DEBUG] Raw ChatGPT Response for segment ' + (i + 1) + ':');
                    console.log(content);
                    
                    // Tìm và parse phần JSON trong response
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            const optimization = JSON.parse(jsonMatch[0]);
                            console.log('\n✅ [DEBUG] Parsed optimization object:');
                            console.log(JSON.stringify(optimization, null, 2));
                            
                            // Kiểm tra cấu trúc JSON trước khi sử dụng
                            if (!optimization.segmentTheme || !optimization.timeline || !optimization.visualNotes || !optimization.transitionNotes) {
                                throw new Error('JSON response thiếu các trường bắt buộc');
                            }

                            // Kiểm tra timeline array
                            if (!Array.isArray(optimization.timeline) || optimization.timeline.length === 0) {
                                throw new Error('Timeline không hợp lệ hoặc rỗng');
                            }

                            console.log(`✅ [Step 3] Đã tối ưu segment ${i + 1}`);
                            optimizedSegments.push({
                                ...segment,
                                originalPrompt: segment.prompt,
                                segmentTheme: optimization.segmentTheme,
                                prompt: {
                                    theme: optimization.segmentTheme,
                                    timeline: optimization.timeline,
                                    visualNotes: optimization.visualNotes,
                                    transitionNotes: optimization.transitionNotes
                                }
                            });
                        } catch (jsonError) {
                            console.error(`❌ [DEBUG] JSON Parse error: ${jsonError.message}`);
                            console.error('❌ [DEBUG] Problem JSON:', jsonMatch[0]);
                            throw new Error(`Không thể parse JSON từ response: ${jsonError.message}`);
                        }
                    } else {
                        console.error('❌ [DEBUG] No JSON found in response');
                        console.error('❌ [DEBUG] Full response:', content);
                        throw new Error('Không tìm thấy JSON trong response của ChatGPT');
                    }
                } else {
                    console.log(`⚠️ [Step 3] Không thể tối ưu segment ${i + 1}, giữ nguyên prompt gốc`);
                    optimizedSegments.push(segment);
                }

                // Chờ giữa các requests để tránh rate limit
                if (i < analysis.segments.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (error) {
                console.log(`❌ [Step 3] Lỗi khi tối ưu segment ${i + 1}: ${error.message}`);
                optimizedSegments.push(segment);
            }
        }

        // Step 4: Tạo video Veo3 tuần tự với prompts đã tối ưu
        console.log(`🎬 [Step 4] Tạo ${TOTAL_SEGMENTS} video Veo3 tuần tự với prompts đã tối ưu (1 phút)...`);
        
        const veo3Results = [];
        
        for (let i = 0; i < optimizedSegments.length; i++) {
            const segment = optimizedSegments[i];
            console.log(`🎬 [Step 4] Tạo video segment ${i + 1}: ${segment.timeRange}`);
            console.log(`🎬 [Step 4] Focus: ${segment.focus}`);
            console.log(`🎬 [Step 4] Theme: ${segment.prompt.theme}`);
            console.log('🎬 [Step 4] Full prompt:', JSON.stringify(segment.prompt, null, 2));
            
            try {
                // Kiểm tra cấu trúc prompt một lần nữa trước khi gửi
                const promptToSend = segment.prompt;
                if (!promptToSend.theme || !promptToSend.timeline || !promptToSend.visualNotes || !promptToSend.transitionNotes) {
                    throw new Error(`Segment ${i + 1}: Prompt thiếu trường bắt buộc`);
                }
                
                // Log chi tiết để kiểm tra
                console.log(`\n🔍 [DEBUG] Segment ${i + 1} Prompt Details:`);
                console.log('Theme:', promptToSend.theme);
                console.log('Timeline count:', promptToSend.timeline.length);
                console.log('Visual Notes:', Object.keys(promptToSend.visualNotes).join(', '));
                console.log('Transition Notes:', Object.keys(promptToSend.transitionNotes).join(', '));
                
                const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: segment.segmentTheme || segment.focus,
                        prompt: promptToSend
                    })
                });
                
                const veo3Result = await veo3Response.json();
                
                if (veo3Result.success) {
                    console.log(`✅ [Step 4] Segment ${i + 1} Veo3: ${veo3Result.operationName}`);
                    veo3Results.push({
                        segmentIndex: i,
                        timeRange: segment.timeRange,
                        focus: segment.focus,
                        prompt: segment.prompt,
                        operationId: veo3Result.operationName,
                        success: true
                    });
                } else {
                    console.log(`❌ [Step 4] Segment ${i + 1} thất bại: ${veo3Result.message}`);
                    veo3Results.push({
                        segmentIndex: i,
                        timeRange: segment.timeRange,
                        error: veo3Result.message,
                        success: false
                    });
                }
                
                // Chờ giữa các requests để tránh spam
                if (i < optimizedSegments.length - 1) {
                    console.log(`⏳ [Step 4] Chờ 5 giây trước khi tạo segment tiếp theo...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                
            } catch (error) {
                console.log(`❌ [Step 4] Segment ${i + 1} lỗi: ${error.message}`);
                veo3Results.push({
                    segmentIndex: i,
                    timeRange: segment.timeRange,
                    error: error.message,
                    success: false
                });
            }
        }
        
        const successfulOperations = veo3Results.filter(r => r.success);
        console.log(`✅ [Step 4] Đã gửi ${successfulOperations.length}/36 Veo3 requests`);
        
        if (successfulOperations.length > 0) {
            console.log(`🚀 [Step 4] Tất cả Veo3 đang chạy ngầm...`);
            console.log(`🚀 [Step 4] Các operation IDs:`);
            successfulOperations.forEach(op => {
                console.log(`🚀 [Step 4] - Segment ${op.segmentIndex + 1}: ${op.operationId}`);
            });
            
            console.log(`⏳ [Step 4] Video sẽ được tải về trong vài phút...`);
            console.log(`⏳ [Step 4] Kiểm tra thư mục public/audio/ để xem video mới`);
            
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
                segments: optimizedSegments,
                veo3Results: veo3Results,
                outputDir: outputDir
            };
            
            const resultPath = path.join(outputDir, 'mh370-complete-5min-result.json');
            fs.writeFileSync(resultPath, JSON.stringify(finalResult, null, 2));
            
            console.log(`📊 [Step 4] Đã lưu kết quả vào: ${resultPath}`);
            
            console.log('🎉 [MH370] Hoàn thành tạo video 1 phút với transcript MH370!');
            console.log(`🎉 [MH370] Chủ đề: ${analysis.overallTheme}`);
            console.log(`🎉 [MH370] Màu sắc: ${analysis.colorScheme}`);
            console.log(`🎉 [MH370] Đã gửi ${successfulOperations.length} Veo3 requests`);
            console.log(`⏳ [MH370] Video sẽ được tải về trong vài phút...`);
            
            return {
                success: true,
                result: finalResult
            };
            
        } else {
            throw new Error('Không có video Veo3 nào được tạo thành công');
        }
        
    } catch (error) {
        console.error(`❌ [MH370] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

console.log('🚀 [START] Tạo video 1 phút hoàn chỉnh với transcript MH370...');
createCompleteMH370Video5min().then(result => {
    if (result.success) {
        console.log('🎉 [MH370] Hoàn thành thành công!');
        console.log(`🎉 [MH370] Chủ đề: ${result.result.overallTheme}`);
        console.log(`🎉 [MH370] Đã gửi ${result.result.veo3OperationsSent} Veo3 requests`);
    } else {
        console.log(`❌ [MH370] Thất bại: ${result.error}`);
    }
});
