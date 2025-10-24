const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

/**
 * Tạo video 32s MH370 không có chữ - chỉ video thuần túy
 */
async function createMH370VideoNoText() {
    try {
        console.log('🚀 [MH370] Tạo video 32s MH370 không có chữ...');
        
        const serverUrl = 'http://localhost:8888';
        const youtubeUrl = 'https://youtu.be/52ru0qDc0LQ?si=zahSVRyDiQy7Jd6H';
        const outputDir = './temp/mh370-no-text-32s';
        
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
        
        // Step 2: ChatGPT tạo prompt KHÔNG CÓ CHỮ - chỉ video thuần túy
        console.log('🤖 [Step 2] ChatGPT tạo prompt KHÔNG CÓ CHỮ cho 4 segments...');
        
        const chatGPTResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { 
                        role: "system", 
                        content: `Bạn là chuyên gia tạo prompt video cho Veo3 với khả năng tạo hình ảnh đồng nhất và liền mạch.

QUAN TRỌNG: KHÔNG BAO GIỜ thêm bất cứ chữ, text, subtitle, hoặc văn bản nào vào video. Chỉ tạo video thuần túy với hình ảnh.

Nhiệm vụ: Phân tích chi tiết transcript về MH370 và tạo 4 prompts cho 4 segments 8s (tổng 32s) với:

YÊU CẦU CHI TIẾT:
1. PHÂN TÍCH TRANSCRIPT: Đọc kỹ transcript, xác định các sự kiện chính, thời gian, địa điểm, nhân vật
2. TẠO CÂU CHUYỆN LOGIC: Xây dựng câu chuyện có đầu, giữa, cuối dựa trên nội dung transcript
3. HÌNH ẢNH ĐỒNG NHẤT: Mỗi segment phải liên quan trực tiếp đến nội dung transcript
4. MÀU SẮC NHẤT QUÁN: Xanh dương đậm, đen, trắng, xám - phong cách điều tra chuyên nghiệp
5. PHONG CÁCH TÀI LIỆU: Như phim tài liệu điều tra, nghiêm túc, chuyên nghiệp
6. CHUYỂN TIẾP MƯỢT MÀ: Segment sau phải tiếp nối logic từ segment trước
7. CHI TIẾT CỤ THỂ: Mô tả rõ ràng camera angle, lighting, objects, movements
8. TUYỆT ĐỐI KHÔNG CÓ CHỮ, TEXT, SUBTITLE

CẤU TRÚC LOGIC:
- Segment 1 (0-8s): Mở đầu - Bối cảnh, sự kiện ban đầu
- Segment 2 (8-16s): Phát triển - Chi tiết điều tra, dữ liệu
- Segment 3 (16-24s): Cao trào - Tìm kiếm, khám phá
- Segment 4 (24-32s): Kết thúc - Hiện trạng, tương lai

Trả về JSON format:
{
    "overallTheme": "Chủ đề tổng thể dựa trên transcript",
    "colorScheme": "Bảng màu chính",
    "visualStyle": "Phong cách visual",
    "storyline": "Cốt truyện logic dựa trên transcript",
    "segments": [
        {
            "timeRange": "0-8s",
            "focus": "Nội dung chính của segment dựa trên transcript",
            "transcriptContent": "Phần transcript tương ứng",
            "visualElements": "Các yếu tố hình ảnh cụ thể",
            "cameraWork": "Góc quay, chuyển động camera",
            "lighting": "Ánh sáng, tông màu",
            "prompt": "Prompt chi tiết cho Veo3 với hình ảnh cụ thể - KHÔNG CÓ CHỮ"
        },
        {
            "timeRange": "8-16s", 
            "focus": "Nội dung chính của segment dựa trên transcript",
            "transcriptContent": "Phần transcript tương ứng",
            "visualElements": "Các yếu tố hình ảnh cụ thể",
            "cameraWork": "Góc quay, chuyển động camera",
            "lighting": "Ánh sáng, tông màu",
            "prompt": "Prompt chi tiết cho Veo3 với hình ảnh cụ thể - KHÔNG CÓ CHỮ"
        },
        {
            "timeRange": "16-24s",
            "focus": "Nội dung chính của segment dựa trên transcript", 
            "transcriptContent": "Phần transcript tương ứng",
            "visualElements": "Các yếu tố hình ảnh cụ thể",
            "cameraWork": "Góc quay, chuyển động camera",
            "lighting": "Ánh sáng, tông màu",
            "prompt": "Prompt chi tiết cho Veo3 với hình ảnh cụ thể - KHÔNG CÓ CHỮ"
        },
        {
            "timeRange": "24-32s",
            "focus": "Nội dung chính của segment dựa trên transcript",
            "transcriptContent": "Phần transcript tương ứng",
            "visualElements": "Các yếu tố hình ảnh cụ thể",
            "cameraWork": "Góc quay, chuyển động camera",
            "lighting": "Ánh sáng, tông màu",
            "prompt": "Prompt chi tiết cho Veo3 với hình ảnh cụ thể - KHÔNG CÓ CHỮ"
        }
    ]
}` 
                    },
                    { 
                        role: "user", 
                        content: `Phân tích chi tiết transcript về MH370 và tạo 4 prompts logic cho video 32s:

TRANSCRIPT:
${transcriptText}

YÊU CẦU CHI TIẾT:
1. PHÂN TÍCH TRANSCRIPT: Đọc kỹ từng câu, xác định:
   - Sự kiện chính theo thời gian
   - Địa điểm, nhân vật, tình huống
   - Cảm xúc, tông điệu của câu chuyện
   - Chi tiết kỹ thuật, dữ liệu

2. TẠO CÂU CHUYỆN LOGIC VỀ MH370:
   - Segment 1: Mở đầu - MH370 cất cánh từ Kuala Lumpur, mất tích
   - Segment 2: Phát triển - Điều tra radar, dữ liệu vệ tinh MH370
   - Segment 3: Cao trào - Tìm kiếm MH370 ở Ấn Độ Dương, Ocean Infinity
   - Segment 4: Kết thúc - Hiện trạng tìm kiếm MH370, hy vọng

3. HÌNH ẢNH CỤ THỂ VỀ MH370:
   - Mỗi segment PHẢI liên quan trực tiếp đến MH370
   - Boeing 777-200ER (loại máy bay MH370)
   - Sân bay Kuala Lumpur (nơi MH370 cất cánh)
   - Ấn Độ Dương (nơi tìm kiếm MH370)
   - Dữ liệu radar, vệ tinh về MH370
   - Camera work: angles, movements, transitions
   - Lighting: mood, atmosphere, color temperature

4. TÍNH NHẤT QUÁN:
   - Màu sắc: Xanh dương đậm, đen, trắng, xám
   - Phong cách: Tài liệu điều tra chuyên nghiệp về MH370
   - Chuyển tiếp: Logic từ segment trước sang segment sau

5. TUYỆT ĐỐI KHÔNG CÓ CHỮ, TEXT, SUBTITLE, VĂN BẢN NÀO

QUAN TRỌNG: TẤT CẢ 4 SEGMENTS PHẢI LIÊN QUAN ĐẾN MH370 - KHÔNG ĐƯỢC TẠO VIDEO KHÁC CHỦ ĐỀ!

Hãy phân tích transcript và tạo câu chuyện logic về MH370, sau đó tạo 4 prompts chi tiết cho Veo3.` 
                    }
                ],
                max_tokens: 3000,
                temperature: 0.7
            })
        });
        
        const chatGPTResult = await chatGPTResponse.json();
        console.log('🤖 [Step 2] ChatGPT result:', chatGPTResult.choices ? '✅ Success' : '❌ Failed');
        
        if (!chatGPTResult.choices) {
            console.error('❌ [Step 2] ChatGPT API Error:', chatGPTResult);
            throw new Error('ChatGPT không trả về kết quả');
        }
        
        if (chatGPTResult.error) {
            console.error('❌ [Step 2] ChatGPT API Error:', chatGPTResult.error);
            throw new Error(`ChatGPT API Error: ${chatGPTResult.error.message}`);
        }
        
        const analysisText = chatGPTResult.choices[0].message.content;
        console.log(`🤖 [Step 2] Phân tích hoàn chỉnh:`);
        console.log(analysisText);
        
        // Parse JSON từ response - Cải thiện để sử dụng ChatGPT hiệu quả hơn
        let analysis;
        try {
            console.log(`🔍 [Step 2] Đang phân tích response từ ChatGPT...`);
            
            // Tìm JSON trong response - cải thiện regex để tìm JSON tốt hơn
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonString = jsonMatch[0];
                console.log(`🔍 [Step 2] Tìm thấy JSON, đang parse...`);
                
                analysis = JSON.parse(jsonString);
                console.log(`✅ [Step 2] ChatGPT phân tích thành công!`);
                console.log(`✅ [Step 2] Chủ đề: ${analysis.overallTheme}`);
                console.log(`✅ [Step 2] Màu sắc: ${analysis.colorScheme}`);
                console.log(`✅ [Step 2] Phong cách: ${analysis.visualStyle}`);
                console.log(`✅ [Step 2] Cốt truyện: ${analysis.storyline || 'N/A'}`);
                
                // Validate segments có đủ thông tin
                if (analysis.segments && analysis.segments.length === 4) {
                    console.log(`✅ [Step 2] Đã tạo ${analysis.segments.length} segments từ ChatGPT:`);
                    analysis.segments.forEach((segment, index) => {
                        console.log(`✅ [Step 2] Segment ${index + 1}: ${segment.focus}`);
                        console.log(`✅ [Step 2] - Transcript: ${segment.transcriptContent ? segment.transcriptContent.substring(0, 100) + '...' : 'N/A'}`);
                        console.log(`✅ [Step 2] - Visual: ${segment.visualElements || 'N/A'}`);
                        console.log(`✅ [Step 2] - Camera: ${segment.cameraWork || 'N/A'}`);
                    });
                } else {
                    console.warn(`⚠️ [Step 2] ChatGPT trả về segments không đúng format, đang sửa...`);
                    // Sửa segments nếu ChatGPT trả về không đúng format
                    if (!analysis.segments || analysis.segments.length !== 4) {
                        analysis.segments = analysis.segments || [];
                        while (analysis.segments.length < 4) {
                            analysis.segments.push({
                                timeRange: `${analysis.segments.length * 8}-${(analysis.segments.length + 1) * 8}s`,
                                focus: `Segment ${analysis.segments.length + 1} from ChatGPT`,
                                transcriptContent: "Content from ChatGPT analysis",
                                visualElements: "Professional documentary visuals",
                                cameraWork: "Professional documentary camera work",
                                lighting: "Professional documentary lighting",
                                prompt: segment.prompt || "Professional documentary video"
                            });
                        }
                    }
                }
            } else {
                console.warn(`⚠️ [Step 2] Không tìm thấy JSON trong response ChatGPT`);
                console.warn(`⚠️ [Step 2] Response content: ${analysisText.substring(0, 200)}...`);
                throw new Error('No JSON found in ChatGPT response');
            }
        } catch (parseError) {
            console.error(`❌ [Step 2] Lỗi parse ChatGPT response: ${parseError.message}`);
            console.error(`❌ [Step 2] ChatGPT response: ${analysisText.substring(0, 300)}...`);
            
            // Thử lại ChatGPT lần nữa với prompt đơn giản hơn
            console.log(`🔄 [Step 2] Thử lại ChatGPT với prompt đơn giản hơn...`);
            
            try {
                const retryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o',
                        messages: [
                            { 
                                role: "system", 
                                content: `Tạo 4 segments video 32s về MH370 dựa trên transcript. Trả về JSON format:
{
    "overallTheme": "Chủ đề",
    "colorScheme": "Màu sắc", 
    "visualStyle": "Phong cách",
    "segments": [
        {"timeRange": "0-8s", "focus": "Nội dung", "prompt": "Prompt cho Veo3 - KHÔNG CÓ CHỮ"},
        {"timeRange": "8-16s", "focus": "Nội dung", "prompt": "Prompt cho Veo3 - KHÔNG CÓ CHỮ"},
        {"timeRange": "16-24s", "focus": "Nội dung", "prompt": "Prompt cho Veo3 - KHÔNG CÓ CHỮ"},
        {"timeRange": "24-32s", "focus": "Nội dung", "prompt": "Prompt cho Veo3 - KHÔNG CÓ CHỮ"}
    ]
}` 
                            },
                            { 
                                role: "user", 
                                content: `Dựa trên transcript này, tạo 4 segments video MH370:

TRANSCRIPT:
${transcriptText}

Yêu cầu: Video tài liệu điều tra MH370, màu xanh dương đậm, đen, trắng. KHÔNG CÓ CHỮ, TEXT, SUBTITLE.` 
                            }
                        ],
                        max_tokens: 2000,
                        temperature: 0.5
                    })
                });
                
                const retryResult = await retryResponse.json();
                
                if (retryResult.choices && !retryResult.error) {
                    const retryText = retryResult.choices[0].message.content;
                    console.log(`🔄 [Step 2] ChatGPT retry response: ${retryText.substring(0, 200)}...`);
                    
                    const retryJsonMatch = retryText.match(/\{[\s\S]*\}/);
                    if (retryJsonMatch) {
                        analysis = JSON.parse(retryJsonMatch[0]);
                        console.log(`✅ [Step 2] ChatGPT retry thành công!`);
                        console.log(`✅ [Step 2] Chủ đề: ${analysis.overallTheme}`);
                        console.log(`✅ [Step 2] Đã tạo ${analysis.segments?.length || 0} segments`);
                    } else {
                        throw new Error('Retry response không có JSON');
                    }
                } else {
                    throw new Error('ChatGPT retry thất bại');
                }
                
            } catch (retryError) {
                console.error(`❌ [Step 2] ChatGPT retry cũng thất bại: ${retryError.message}`);
                throw new Error(`ChatGPT không thể xử lý transcript sau 2 lần thử: ${parseError.message}`);
            }
        }
        
        // Step 3: Tạo 4 video Veo3 tuần tự với prompts KHÔNG CÓ CHỮ
        console.log('🎬 [Step 3] Tạo 4 video Veo3 tuần tự với prompts KHÔNG CÓ CHỮ...');
        
        const veo3Results = [];
        
        for (let i = 0; i < analysis.segments.length; i++) {
            const segment = analysis.segments[i];
            console.log(`🎬 [Step 3] Tạo video segment ${i + 1}: ${segment.timeRange}`);
            console.log(`🎬 [Step 3] Focus: ${segment.focus}`);
            console.log(`🎬 [Step 3] Transcript: ${segment.transcriptContent ? segment.transcriptContent.substring(0, 100) + '...' : 'N/A'}`);
            console.log(`🎬 [Step 3] Visual: ${segment.visualElements || 'N/A'}`);
            console.log(`🎬 [Step 3] Camera: ${segment.cameraWork || 'N/A'}`);
            console.log(`🎬 [Step 3] Prompt: ${segment.prompt.substring(0, 150)}...`);
            
            try {
                // Tạo prompt chi tiết hơn với thông tin từ segment - ĐẢM BẢO LIÊN QUAN ĐẾN MH370
                const enhancedPrompt = `MH370 INVESTIGATION DOCUMENTARY - ${segment.prompt}

MH370 SPECIFIC REQUIREMENTS:
- MUST be about Malaysia Airlines flight MH370 disappearance
- MUST show Boeing 777-200ER aircraft (MH370's aircraft type)
- MUST relate to the 2014 disappearance and ongoing investigation
- MUST include MH370-specific elements: Kuala Lumpur airport, Indian Ocean search, satellite data, Ocean Infinity search

SEGMENT DETAILS:
- Time Range: ${segment.timeRange}
- Focus: ${segment.focus}
- Visual Elements: ${segment.visualElements || 'MH370 investigation visuals'}
- Camera Work: ${segment.cameraWork || 'Professional documentary camera work'}
- Lighting: ${segment.lighting || 'Professional documentary lighting'}

CRITICAL: NO TEXT, NO SUBTITLES, NO WORDS - PURE VISUAL STORYTELLING ONLY - MUST BE ABOUT MH370`;

                const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: enhancedPrompt,
                        prompt: enhancedPrompt
                    })
                });
                
                const veo3Result = await veo3Response.json();
                
                if (veo3Result.success) {
                    console.log(`✅ [Step 3] Segment ${i + 1} Veo3: ${veo3Result.operationName}`);
                    veo3Results.push({
                        segmentIndex: i,
                        timeRange: segment.timeRange,
                        focus: segment.focus,
                        transcriptContent: segment.transcriptContent,
                        visualElements: segment.visualElements,
                        cameraWork: segment.cameraWork,
                        lighting: segment.lighting,
                        prompt: enhancedPrompt,
                        operationId: veo3Result.operationName,
                        success: true
                    });
                } else {
                    console.log(`❌ [Step 3] Segment ${i + 1} thất bại: ${veo3Result.message}`);
                    veo3Results.push({
                        segmentIndex: i,
                        timeRange: segment.timeRange,
                        focus: segment.focus,
                        error: veo3Result.message,
                        success: false
                    });
                }
                
                // Chờ giữa các requests để tránh spam và đảm bảo chất lượng
                if (i < analysis.segments.length - 1) {
                    console.log(`⏳ [Step 3] Chờ 8 giây trước khi tạo segment tiếp theo để đảm bảo chất lượng...`);
                    await new Promise(resolve => setTimeout(resolve, 8000));
                }
                
            } catch (error) {
                console.log(`❌ [Step 3] Segment ${i + 1} lỗi: ${error.message}`);
                veo3Results.push({
                    segmentIndex: i,
                    timeRange: segment.timeRange,
                    focus: segment.focus,
                    error: error.message,
                    success: false
                });
            }
        }
        
        const successfulOperations = veo3Results.filter(r => r.success);
        console.log(`✅ [Step 3] Đã gửi ${successfulOperations.length}/4 Veo3 requests`);
        
        if (successfulOperations.length > 0) {
            console.log(`🚀 [Step 3] Tất cả Veo3 đang chạy ngầm...`);
            console.log(`🚀 [Step 3] Các operation IDs:`);
            successfulOperations.forEach(op => {
                console.log(`🚀 [Step 3] - Segment ${op.segmentIndex + 1}: ${op.operationId}`);
            });
            
            console.log(`⏳ [Step 3] Video sẽ được tải về trong vài phút...`);
            console.log(`⏳ [Step 3] Kiểm tra thư mục public/audio/ để xem video mới`);
            
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
                segments: analysis.segments,
                veo3Results: veo3Results,
                outputDir: outputDir,
                note: "KHÔNG CÓ CHỮ - CHỈ VIDEO THUẦN TÚY"
            };
            
            const resultPath = path.join(outputDir, 'mh370-no-text-32s-result.json');
            fs.writeFileSync(resultPath, JSON.stringify(finalResult, null, 2));
            
            console.log(`📊 [Step 3] Đã lưu kết quả vào: ${resultPath}`);
            
            console.log('🎉 [MH370] Hoàn thành tạo video 32s KHÔNG CÓ CHỮ!');
            console.log(`🎉 [MH370] Chủ đề: ${analysis.overallTheme}`);
            console.log(`🎉 [MH370] Màu sắc: ${analysis.colorScheme}`);
            console.log(`🎉 [MH370] Đã gửi ${successfulOperations.length} Veo3 requests`);
            console.log(`⏳ [MH370] Video sẽ được tải về trong vài phút...`);
            console.log(`📝 [MH370] LƯU Ý: Video này KHÔNG CÓ CHỮ, chỉ có hình ảnh thuần túy`);
            
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

console.log('🚀 [START] Tạo video 32s MH370 KHÔNG CÓ CHỮ...');
createMH370VideoNoText().then(result => {
    if (result.success) {
        console.log('🎉 [MH370] Hoàn thành thành công!');
        console.log(`🎉 [MH370] Chủ đề: ${result.result.overallTheme}`);
        console.log(`🎉 [MH370] Đã gửi ${result.result.veo3OperationsSent} Veo3 requests`);
        console.log(`📝 [MH370] LƯU Ý: Video này KHÔNG CÓ CHỮ, chỉ có hình ảnh thuần túy`);
    } else {
        console.log(`❌ [MH370] Thất bại: ${result.error}`);
    }
});
