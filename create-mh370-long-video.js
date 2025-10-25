const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

/**
 * Làm sạch JSON string để parse được
 */
function cleanJsonString(jsonString) {
    return jsonString
        .replace(/\/\/.*$/gm, '') // Loại bỏ comment //
        .replace(/\/\*[\s\S]*?\*\//g, '') // Loại bỏ comment /* */
        .replace(/,(\s*[}\]])/g, '$1') // Loại bỏ trailing comma
        .replace(/\s+/g, ' ') // Chuẩn hóa whitespace
        .trim();
}

/**
 * Parse JSON từ ChatGPT response với xử lý lỗi tốt
 */
function parseChatGPTResponse(responseText) {
    try {
        console.log(`🔍 Đang phân tích response từ ChatGPT...`);
        
        // Tìm JSON trong response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Không tìm thấy JSON trong response');
        }
        
        // Làm sạch và parse JSON
        const cleanedJson = cleanJsonString(jsonMatch[0]);
        console.log(`🔍 JSON đã làm sạch: ${cleanedJson.substring(0, 200)}...`);
        
        const parsed = JSON.parse(cleanedJson);
        
        // Validate structure - không cần segments array cho format mới
        if (!parsed.focus || !parsed.prompt) {
            throw new Error('JSON không có focus hoặc prompt hợp lệ');
        }
        
        console.log(`✅ Parse thành công! Focus: ${parsed.focus}`);
        return parsed;
        
    } catch (error) {
        console.error(`❌ Lỗi parse JSON: ${error.message}`);
        throw error;
    }
}

/**
 * Tạo video MH370 dài hơn 23 phút chia thành từng cảnh 8s
 */
async function createMH370LongVideo() {
    try {
        console.log('🚀 [MH370] Tạo video dài MH370 (hơn 23 phút)...');
        
        const serverUrl = 'http://localhost:8888';
        const youtubeUrl = 'https://youtu.be/52ru0qDc0LQ?si=zahSVRyDiQy7Jd6H';
        const outputDir = './temp/mh370-long-video';
        
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
        
        // Step 2: Chia transcript thành các đoạn 8s
        console.log('📝 [Step 2] Chia transcript thành các đoạn 8s...');
        
        // Tính toán số segments cần thiết (23 phút = 1380 giây ÷ 8s = 172.5 ≈ 173 segments)
        const totalDurationSeconds = 23 * 60; // 23 phút = 1380 giây
        const segmentDurationSeconds = 8;
        const totalSegments = Math.ceil(totalDurationSeconds / segmentDurationSeconds);
        
        console.log(`📝 [Step 2] Tổng thời gian: ${totalDurationSeconds}s (23 phút)`);
        console.log(`📝 [Step 2] Mỗi segment: ${segmentDurationSeconds}s`);
        console.log(`📝 [Step 2] Tổng segments cần tạo: ${totalSegments}`);
        
        // Chia transcript thành các đoạn
        const transcriptWords = transcriptText.split(' ');
        const wordsPerSegment = Math.ceil(transcriptWords.length / totalSegments);
        
        const segments = [];
        for (let i = 0; i < totalSegments; i++) {
            const startTime = i * segmentDurationSeconds;
            const endTime = Math.min((i + 1) * segmentDurationSeconds, totalDurationSeconds);
            const startWordIndex = i * wordsPerSegment;
            const endWordIndex = Math.min((i + 1) * wordsPerSegment, transcriptWords.length);
            const segmentText = transcriptWords.slice(startWordIndex, endWordIndex).join(' ');
            
            segments.push({
                segmentIndex: i,
                timeRange: `${startTime}-${endTime}s`,
                transcriptContent: segmentText,
                startTime: startTime,
                endTime: endTime
            });
        }
        
        console.log(`✅ [Step 2] Đã chia transcript thành ${segments.length} segments`);
        console.log(`✅ [Step 2] Ví dụ segment đầu: ${segments[0].transcriptContent.substring(0, 100)}...`);
        
        // Step 3: Phân tích từng segment với ChatGPT
        console.log('🤖 [Step 3] Phân tích từng segment với ChatGPT...');
        
        const analyzedSegments = [];
        const analysisBatchSize = 3; // Giảm xuống 3 segments cùng lúc để tránh rate limit
        
        for (let i = 0; i < segments.length; i += analysisBatchSize) {
            const batch = segments.slice(i, i + analysisBatchSize);
            console.log(`🤖 [Step 3] Xử lý batch ${Math.floor(i/analysisBatchSize) + 1}: segments ${i + 1}-${Math.min(i + analysisBatchSize, segments.length)}`);
            
            // Xử lý batch song song
            const batchPromises = batch.map(async (segment, batchIndex) => {
                const segmentIndex = i + batchIndex;
                console.log(`🤖 [Step 3] Phân tích segment ${segmentIndex + 1}: ${segment.timeRange}`);
                
                try {
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
                                    content: `Bạn là chuyên gia tạo prompt video cho Veo3 về MH370.

QUAN TRỌNG: KHÔNG BAO GIỜ thêm bất cứ chữ, text, subtitle, hoặc văn bản nào vào video. Chỉ tạo video thuần túy với hình ảnh.

Nhiệm vụ: Phân tích một đoạn transcript về MH370 và tạo prompt cho Veo3:

YÊU CẦU:
1. HÌNH ẢNH CỤ THỂ VỀ MH370:
   - PHẢI liên quan trực tiếp đến MH370
   - Boeing 777-200ER (loại máy bay MH370)
   - Sân bay Kuala Lumpur (nơi MH370 cất cánh)
   - Ấn Độ Dương (nơi tìm kiếm MH370)
   - Dữ liệu radar, vệ tinh về MH370

2. TÍNH NHẤT QUÁN:
   - Màu sắc: Xanh dương đậm, đen, trắng, xám
   - Phong cách: Tài liệu điều tra chuyên nghiệp về MH370
   - Camera work: angles, movements, transitions
   - Lighting: mood, atmosphere, color temperature

3. TUYỆT ĐỐI KHÔNG CÓ CHỮ, TEXT, SUBTITLE, VĂN BẢN NÀO

Trả về JSON format:
{
    "focus": "Nội dung chính của segment",
    "visualElements": "Các yếu tố hình ảnh cụ thể",
    "cameraWork": "Góc quay, chuyển động camera",
    "lighting": "Ánh sáng, tông màu",
    "prompt": "Prompt chi tiết cho Veo3 - KHÔNG CÓ CHỮ"
}` 
                                },
                                { 
                                    role: "user", 
                                    content: `Phân tích đoạn transcript này về MH370 và tạo prompt cho Veo3:

TRANSCRIPT SEGMENT:
${segment.transcriptContent}

THÔNG TIN SEGMENT:
- Time Range: ${segment.timeRange}
- Segment Index: ${segmentIndex + 1}/${segments.length}

Yêu cầu: Tạo prompt video 8s về MH370 dựa trên đoạn transcript này. Video phải liên quan đến MH370, không có chữ, màu xanh dương đậm, đen, trắng, xám.` 
                                }
                            ],
                            max_tokens: 1000,
                            temperature: 0.7
                        })
                    });
                    
                    const chatGPTResult = await chatGPTResponse.json();
                    
                    if (chatGPTResult.choices && !chatGPTResult.error) {
                        const analysisText = chatGPTResult.choices[0].message.content;
                        const analysis = parseChatGPTResponse(analysisText);
                        
                        return {
                            ...segment,
                            focus: analysis.focus,
                            visualElements: analysis.visualElements,
                            cameraWork: analysis.cameraWork,
                            lighting: analysis.lighting,
                            prompt: analysis.prompt,
                            success: true
                        };
                    } else {
                        throw new Error('ChatGPT API Error');
                    }
                    
                } catch (error) {
                    console.log(`❌ [Step 3] Segment ${segmentIndex + 1} lỗi: ${error.message}`);
                    return {
                        ...segment,
                        error: error.message,
                        success: false
                    };
                }
            });
            
            // Chờ batch hoàn thành
            const batchResults = await Promise.all(batchPromises);
            analyzedSegments.push(...batchResults);
            
            // Chờ giữa các batches để tránh spam
            if (i + analysisBatchSize < segments.length) {
                console.log(`⏳ [Step 3] Chờ 5 giây trước khi xử lý batch tiếp theo...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        const successfulSegments = analyzedSegments.filter(s => s.success);
        console.log(`✅ [Step 3] Đã phân tích ${successfulSegments.length}/${segments.length} segments`);
        
        if (successfulSegments.length === 0) {
            throw new Error('Không có segment nào được phân tích thành công');
        }
        
        // Tạo analysis object để tương thích với code cũ
        const analysis = {
            overallTheme: "Cuộc điều tra và tìm kiếm chuyến bay MH370",
            colorScheme: "Xanh dương đậm, đen, trắng, xám",
            visualStyle: "Phong cách tài liệu điều tra chuyên nghiệp",
            storyline: "Cuộc hành trình từ sự biến mất bí ẩn của MH370 đến những nỗ lực tìm kiếm không ngừng nghỉ",
            totalSegments: successfulSegments.length,
            segments: successfulSegments
        };
        
        console.log(`✅ [Step 3] Đã phân tích thành công ${analysis.segments.length} segments`);
        console.log(`✅ [Step 3] Chủ đề: ${analysis.overallTheme}`);
        console.log(`✅ [Step 3] Màu sắc: ${analysis.colorScheme}`);
        console.log(`✅ [Step 3] Phong cách: ${analysis.visualStyle}`);
        
        // Hiển thị một số segments đầu
        if (analysis.segments && analysis.segments.length > 0) {
            console.log(`✅ [Step 3] Ví dụ segments đã phân tích:`);
            analysis.segments.forEach((segment, index) => {
                if (index < 3) { // Chỉ hiển thị 3 segments đầu
                    console.log(`✅ [Step 3] Segment ${index + 1}: ${segment.focus}`);
                    console.log(`✅ [Step 3] - Transcript: ${segment.transcriptContent ? segment.transcriptContent.substring(0, 100) + '...' : 'N/A'}`);
                    console.log(`✅ [Step 3] - Visual: ${segment.visualElements || 'N/A'}`);
                    console.log(`✅ [Step 3] - Camera: ${segment.cameraWork || 'N/A'}`);
                }
            });
            if (analysis.segments.length > 3) {
                console.log(`✅ [Step 3] ... và ${analysis.segments.length - 3} segments khác`);
            }
        }
        
        // Step 4: Tạo video Veo3 cho từng segment
        console.log(`🎬 [Step 4] Tạo video Veo3 cho ${analysis.segments.length} segments...`);
        
        const veo3Results = [];
        const batchSize = 5; // Xử lý 5 segments cùng lúc
        
        for (let i = 0; i < analysis.segments.length; i += batchSize) {
            const batch = analysis.segments.slice(i, i + batchSize);
            console.log(`🎬 [Step 4] Xử lý batch ${Math.floor(i/batchSize) + 1}: segments ${i + 1}-${Math.min(i + batchSize, analysis.segments.length)}`);
            
            // Xử lý batch song song
            const batchPromises = batch.map(async (segment, batchIndex) => {
                const segmentIndex = i + batchIndex;
                console.log(`🎬 [Step 4] Tạo video segment ${segmentIndex + 1}: ${segment.timeRange}`);
                console.log(`🎬 [Step 4] Focus: ${segment.focus}`);
                console.log(`🎬 [Step 4] Transcript: ${segment.transcriptContent ? segment.transcriptContent.substring(0, 100) + '...' : 'N/A'}`);
                console.log(`🎬 [Step 4] Visual: ${segment.visualElements || 'N/A'}`);
                console.log(`🎬 [Step 4] Camera: ${segment.cameraWork || 'N/A'}`);
                console.log(`🎬 [Step 4] Prompt: ${segment.prompt.substring(0, 150)}...`);
                
                try {
                    // Tạo prompt chi tiết hơn với thông tin từ segment
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
                        console.log(`✅ [Step 4] Segment ${segmentIndex + 1} Veo3: ${veo3Result.operationName}`);
                        return {
                            segmentIndex: segmentIndex,
                            timeRange: segment.timeRange,
                            focus: segment.focus,
                            transcriptContent: segment.transcriptContent,
                            visualElements: segment.visualElements,
                            cameraWork: segment.cameraWork,
                            lighting: segment.lighting,
                            prompt: enhancedPrompt,
                            operationId: veo3Result.operationName,
                            success: true
                        };
                    } else {
                        console.log(`❌ [Step 4] Segment ${segmentIndex + 1} thất bại: ${veo3Result.message}`);
                        return {
                            segmentIndex: segmentIndex,
                            timeRange: segment.timeRange,
                            focus: segment.focus,
                            error: veo3Result.message,
                            success: false
                        };
                    }
                    
                } catch (error) {
                    console.log(`❌ [Step 4] Segment ${segmentIndex + 1} lỗi: ${error.message}`);
                    return {
                        segmentIndex: segmentIndex,
                        timeRange: segment.timeRange,
                        focus: segment.focus,
                        error: error.message,
                        success: false
                    };
                }
            });
            
            // Chờ batch hoàn thành
            const batchResults = await Promise.all(batchPromises);
            veo3Results.push(...batchResults);
            
            // Chờ giữa các batches để tránh spam
            if (i + batchSize < analysis.segments.length) {
                console.log(`⏳ [Step 4] Chờ 10 giây trước khi xử lý batch tiếp theo...`);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
        
        const successfulOperations = veo3Results.filter(r => r.success);
        console.log(`✅ [Step 4] Đã gửi ${successfulOperations.length}/${analysis.segments.length} Veo3 requests`);
        
        if (successfulOperations.length > 0) {
            console.log(`🚀 [Step 4] Tất cả Veo3 đang chạy ngầm...`);
            console.log(`🚀 [Step 4] Các operation IDs (${successfulOperations.length}):`);
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
                storyline: analysis.storyline,
                totalSegments: analysis.segments.length,
                segmentsCreated: analysis.segments.length,
                veo3OperationsSent: successfulOperations.length,
                segments: analysis.segments,
                veo3Results: veo3Results,
                outputDir: outputDir,
                note: "VIDEO DÀI HƠN 23 PHÚT - CHIA THÀNH TỪNG CẢNH 8S - KHÔNG CÓ CHỮ"
            };
            
            const resultPath = path.join(outputDir, 'mh370-long-video-result.json');
            fs.writeFileSync(resultPath, JSON.stringify(finalResult, null, 2));
            
            console.log(`📊 [Step 3] Đã lưu kết quả vào: ${resultPath}`);
            
            console.log('🎉 [MH370] Hoàn thành tạo video dài!');
            console.log(`🎉 [MH370] Chủ đề: ${analysis.overallTheme}`);
            console.log(`🎉 [MH370] Màu sắc: ${analysis.colorScheme}`);
            console.log(`🎉 [MH370] Tổng segments: ${analysis.segments.length}`);
            console.log(`🎉 [MH370] Đã gửi ${successfulOperations.length} Veo3 requests`);
            console.log(`⏳ [MH370] Video sẽ được tải về trong vài phút...`);
            console.log(`📝 [MH370] LƯU Ý: Video dài hơn 23 phút, chia thành từng cảnh 8s, KHÔNG CÓ CHỮ`);
            
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

console.log('🚀 [START] Tạo video dài MH370 (hơn 23 phút)...');
createMH370LongVideo().then(result => {
    if (result.success) {
        console.log('🎉 [MH370] Hoàn thành thành công!');
        console.log(`🎉 [MH370] Chủ đề: ${result.result.overallTheme}`);
        console.log(`🎉 [MH370] Tổng segments: ${result.result.totalSegments}`);
        console.log(`🎉 [MH370] Đã gửi ${result.result.veo3OperationsSent} Veo3 requests`);
        console.log(`📝 [MH370] LƯU Ý: Video dài hơn 23 phút, chia thành từng cảnh 8s, KHÔNG CÓ CHỮ`);
    } else {
        console.log(`❌ [MH370] Thất bại: ${result.error}`);
    }
});



