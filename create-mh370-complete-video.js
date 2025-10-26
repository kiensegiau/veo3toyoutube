const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

/**
 * Tạo video hoàn thiện MH370 với đầy đủ thời gian
 */
async function createMH370CompleteVideo() {
    try {
        console.log('🚀 [MH370] Tạo video hoàn thiện MH370...');
        
        const serverUrl = 'http://localhost:8888';
        const youtubeUrl = 'https://youtu.be/52ru0qDc0LQ?si=zahSVRyDiQy7Jd6H';
        const outputDir = './temp/mh370-complete-video';
        
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
        
        // Step 2: ChatGPT tạo prompt cho video hoàn thiện
        console.log('🤖 [Step 2] ChatGPT tạo prompt cho video hoàn thiện...');
        
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

QUAN TRỌNG: KHÔNG BAO GIỜ thêm bất cứ chữ, text, subtitle, hoặc văn bản nào vào video. Chỉ tạo video thuần túy với hình ảnh.

Nhiệm vụ: Phân tích chi tiết transcript về MH370 và tạo 1 prompt duy nhất cho video hoàn thiện với:

YÊU CẦU CHI TIẾT:
1. PHÂN TÍCH TRANSCRIPT: Đọc kỹ từng câu, xác định:
   - Sự kiện chính theo thời gian
   - Địa điểm, nhân vật, tình huống
   - Cảm xúc, tông điệu của câu chuyện
   - Chi tiết kỹ thuật, dữ liệu

2. TẠO CÂU CHUYỆN LOGIC VỀ MH370:
   - Mở đầu: MH370 cất cánh từ Kuala Lumpur, mất tích
   - Phát triển: Điều tra radar, dữ liệu vệ tinh MH370
   - Cao trào: Tìm kiếm MH370 ở Ấn Độ Dương, Ocean Infinity
   - Kết thúc: Hiện trạng tìm kiếm MH370, hy vọng

3. HÌNH ẢNH CỤ THỂ VỀ MH370:
   - Video PHẢI liên quan trực tiếp đến MH370
   - Boeing 777-200ER (loại máy bay MH370)
   - Sân bay Kuala Lumpur (nơi MH370 cất cánh)
   - Ấn Độ Dương (nơi tìm kiếm MH370)
   - Dữ liệu radar, vệ tinh về MH370
   - Camera work: angles, movements, transitions
   - Lighting: mood, atmosphere, color temperature

4. TÍNH NHẤT QUÁN:
   - Màu sắc: Xanh dương đậm, đen, trắng, xám
   - Phong cách: Tài liệu điều tra chuyên nghiệp về MH370
   - Chuyển tiếp: Logic từ mở đầu đến kết thúc

5. TUYỆT ĐỐI KHÔNG CÓ CHỮ, TEXT, SUBTITLE, VĂN BẢN NÀO

QUAN TRỌNG: TẠO 1 PROMPT DUY NHẤT CHO VIDEO HOÀN THIỆN - KHÔNG PHẢI SEGMENTS!

Trả về JSON format:
{
    "overallTheme": "Chủ đề tổng thể dựa trên transcript",
    "colorScheme": "Bảng màu chính",
    "visualStyle": "Phong cách visual",
    "storyline": "Cốt truyện logic dựa trên transcript",
    "videoPrompt": "Prompt chi tiết cho Veo3 tạo video hoàn thiện - KHÔNG CÓ CHỮ"
}` 
                    },
                    { 
                        role: "user", 
                        content: `Phân tích chi tiết transcript về MH370 và tạo 1 prompt cho video hoàn thiện:

TRANSCRIPT:
${transcriptText}

YÊU CẦU CHI TIẾT:
1. PHÂN TÍCH TRANSCRIPT: Đọc kỹ từng câu, xác định:
   - Sự kiện chính theo thời gian
   - Địa điểm, nhân vật, tình huống
   - Cảm xúc, tông điệu của câu chuyện
   - Chi tiết kỹ thuật, dữ liệu

2. TẠO CÂU CHUYỆN LOGIC VỀ MH370:
   - Mở đầu: MH370 cất cánh từ Kuala Lumpur, mất tích
   - Phát triển: Điều tra radar, dữ liệu vệ tinh MH370
   - Cao trào: Tìm kiếm MH370 ở Ấn Độ Dương, Ocean Infinity
   - Kết thúc: Hiện trạng tìm kiếm MH370, hy vọng

3. HÌNH ẢNH CỤ THỂ VỀ MH370:
   - Video PHẢI liên quan trực tiếp đến MH370
   - Boeing 777-200ER (loại máy bay MH370)
   - Sân bay Kuala Lumpur (nơi MH370 cất cánh)
   - Ấn Độ Dương (nơi tìm kiếm MH370)
   - Dữ liệu radar, vệ tinh về MH370
   - Camera work: angles, movements, transitions
   - Lighting: mood, atmosphere, color temperature

4. TÍNH NHẤT QUÁN:
   - Màu sắc: Xanh dương đậm, đen, trắng, xám
   - Phong cách: Tài liệu điều tra chuyên nghiệp về MH370
   - Chuyển tiếp: Logic từ mở đầu đến kết thúc

5. TUYỆT ĐỐI KHÔNG CÓ CHỮ, TEXT, SUBTITLE, VĂN BẢN NÀO

QUAN TRỌNG: TẠO 1 PROMPT DUY NHẤT CHO VIDEO HOÀN THIỆN - KHÔNG PHẢI SEGMENTS!

Hãy phân tích transcript và tạo 1 prompt chi tiết cho video hoàn thiện về MH370.` 
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
        
        // Parse JSON từ response
        let analysis;
        try {
            console.log(`🔍 [Step 2] Đang phân tích response từ ChatGPT...`);
            
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
                console.log(`✅ [Step 2] Video prompt: ${analysis.videoPrompt ? analysis.videoPrompt.substring(0, 200) + '...' : 'N/A'}`);
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
                        model: 'gpt-4o-mini',
                        messages: [
                            { 
                                role: "system", 
                                content: `Tạo 1 prompt video hoàn thiện về MH370 dựa trên transcript. Trả về JSON format:
{
    "overallTheme": "Chủ đề",
    "colorScheme": "Màu sắc", 
    "visualStyle": "Phong cách",
    "videoPrompt": "Prompt cho Veo3 - KHÔNG CÓ CHỮ"
}` 
                            },
                            { 
                                role: "user", 
                                content: `Dựa trên transcript này, tạo 1 prompt video hoàn thiện về MH370:

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
                        console.log(`✅ [Step 2] Video prompt: ${analysis.videoPrompt ? analysis.videoPrompt.substring(0, 200) + '...' : 'N/A'}`);
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
        
        // Step 3: Tạo video Veo3 hoàn thiện
        console.log('🎬 [Step 3] Tạo video Veo3 hoàn thiện...');
        
        // Tạo prompt chi tiết hơn với thông tin từ analysis
        const enhancedPrompt = `MH370 INVESTIGATION DOCUMENTARY - ${analysis.videoPrompt}

MH370 SPECIFIC REQUIREMENTS:
- MUST be about Malaysia Airlines flight MH370 disappearance
- MUST show Boeing 777-200ER aircraft (MH370's aircraft type)
- MUST relate to the 2014 disappearance and ongoing investigation
- MUST include MH370-specific elements: Kuala Lumpur airport, Indian Ocean search, satellite data, Ocean Infinity search
- MUST be a complete documentary video with smooth transitions
- MUST tell the complete story from takeoff to current search status

VIDEO DETAILS:
- Theme: ${analysis.overallTheme}
- Color Scheme: ${analysis.colorScheme}
- Visual Style: ${analysis.visualStyle}
- Storyline: ${analysis.storyline}

CRITICAL: NO TEXT, NO SUBTITLES, NO WORDS - PURE VISUAL STORYTELLING ONLY - MUST BE ABOUT MH370`;

        console.log(`🎬 [Step 3] Enhanced prompt: ${enhancedPrompt.substring(0, 300)}...`);
        
        try {
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
                console.log(`✅ [Step 3] Video Veo3: ${veo3Result.operationName}`);
                
                // Lưu kết quả hoàn chỉnh
                const finalResult = {
                    timestamp: new Date().toISOString(),
                    youtubeUrl: youtubeUrl,
                    transcript: transcriptText,
                    overallTheme: analysis.overallTheme,
                    colorScheme: analysis.colorScheme,
                    visualStyle: analysis.visualStyle,
                    storyline: analysis.storyline,
                    videoPrompt: analysis.videoPrompt,
                    enhancedPrompt: enhancedPrompt,
                    operationId: veo3Result.operationName,
                    outputDir: outputDir,
                    note: "VIDEO HOÀN THIỆN - KHÔNG CÓ CHỮ - CHỈ VIDEO THUẦN TÚY"
                };
                
                const resultPath = path.join(outputDir, 'mh370-complete-video-result.json');
                fs.writeFileSync(resultPath, JSON.stringify(finalResult, null, 2));
                
                console.log(`📊 [Step 3] Đã lưu kết quả vào: ${resultPath}`);
                
                console.log('🎉 [MH370] Hoàn thành tạo video hoàn thiện!');
                console.log(`🎉 [MH370] Chủ đề: ${analysis.overallTheme}`);
                console.log(`🎉 [MH370] Màu sắc: ${analysis.colorScheme}`);
                console.log(`🎉 [MH370] Operation ID: ${veo3Result.operationName}`);
                console.log(`⏳ [MH370] Video sẽ được tải về trong vài phút...`);
                console.log(`📝 [MH370] LƯU Ý: Video này KHÔNG CÓ CHỮ, chỉ có hình ảnh thuần túy`);
                
                return {
                    success: true,
                    result: finalResult
                };
                
            } else {
                throw new Error(`Veo3 thất bại: ${veo3Result.message}`);
            }
            
        } catch (error) {
            console.log(`❌ [Step 3] Veo3 lỗi: ${error.message}`);
            throw error;
        }
        
    } catch (error) {
        console.error(`❌ [MH370] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

console.log('🚀 [START] Tạo video hoàn thiện MH370...');
createMH370CompleteVideo().then(result => {
    if (result.success) {
        console.log('🎉 [MH370] Hoàn thành thành công!');
        console.log(`🎉 [MH370] Chủ đề: ${result.result.overallTheme}`);
        console.log(`🎉 [MH370] Operation ID: ${result.result.operationId}`);
        console.log(`📝 [MH370] LƯU Ý: Video này KHÔNG CÓ CHỮ, chỉ có hình ảnh thuần túy`);
    } else {
        console.log(`❌ [MH370] Thất bại: ${result.error}`);
    }
});



