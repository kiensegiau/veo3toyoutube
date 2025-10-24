const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

/**
 * Tạo video 32s hoàn chỉnh với transcript MH370
 */
async function createCompleteMH370Video32s() {
    try {
        console.log('🚀 [MH370] Tạo video 32s hoàn chỉnh với transcript MH370...');
        
        const serverUrl = 'http://localhost:8888';
        const youtubeUrl = 'https://youtu.be/52ru0qDc0LQ?si=zahSVRyDiQy7Jd6H';
        const outputDir = './temp/mh370-complete-32s';
        
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
                model: 'gpt-4o',
                messages: [
                    { 
                        role: "system", 
                        content: `Bạn là chuyên gia tạo prompt video cho Veo3 với khả năng tạo hình ảnh đồng nhất và liền mạch.

Nhiệm vụ: Dựa trên transcript về MH370, tạo 4 prompts cho 4 segments 8s (tổng 32s) với:
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
                        content: `Dựa trên transcript về MH370 này, tạo 4 prompts đồng nhất cho video 32s:

TRANSCRIPT:
${transcriptText}

YÊU CẦU:
- Mỗi segment 8s phải có hình ảnh cụ thể về MH370
- Đồng nhất về màu sắc và phong cách
- Chuyển tiếp mượt mà giữa các segments
- Chi tiết cụ thể: máy bay, biển, vệ tinh, đồ họa điều tra` 
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
            console.warn(`⚠️ [Step 2] Không thể parse JSON, tạo mock analysis`);
            
            // Mock analysis fallback
            analysis = {
                overallTheme: "MH370 Investigation Documentary",
                colorScheme: "Deep blue, black, white",
                visualStyle: "Documentary investigation style",
                segments: [
                    {
                        timeRange: "0-8s",
                        focus: "MH370 disappearance overview",
                        prompt: "Create a documentary-style video showing Malaysia Airlines Boeing 777-200ER flying over dark ocean waters at night. Deep blue and black color scheme with white text overlays showing flight path. Professional investigation graphics with satellite imagery background."
                    },
                    {
                        timeRange: "8-16s",
                        focus: "Search efforts and satellite data",
                        prompt: "Show detailed satellite imagery and search operations in the Indian Ocean. Deep blue ocean waters with search vessels and aircraft. Investigation graphics showing radar data and flight path analysis. Professional documentary style with blue and white color scheme."
                    },
                    {
                        timeRange: "16-24s",
                        focus: "Ocean Infinity search operations",
                        prompt: "Display Ocean Infinity's advanced search technology and underwater vehicles searching the ocean floor. Deep blue underwater scenes with high-tech equipment. Professional investigation graphics showing search patterns and sonar data."
                    },
                    {
                        timeRange: "24-32s",
                        focus: "Current investigation status",
                        prompt: "Show current investigation status with updated search data and ongoing efforts. Deep blue ocean with investigation graphics and timeline. Professional documentary conclusion with blue and white color scheme, showing continued search efforts."
                    }
                ]
            };
        }
        
        // Step 3: Tạo 4 video Veo3 tuần tự với prompts đồng nhất
        console.log('🎬 [Step 3] Tạo 4 video Veo3 tuần tự với prompts đồng nhất...');
        
        const veo3Results = [];
        
        for (let i = 0; i < analysis.segments.length; i++) {
            const segment = analysis.segments[i];
            console.log(`🎬 [Step 3] Tạo video segment ${i + 1}: ${segment.timeRange}`);
            console.log(`🎬 [Step 3] Focus: ${segment.focus}`);
            console.log(`🎬 [Step 3] Prompt: ${segment.prompt.substring(0, 100)}...`);
            
            try {
                const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: segment.prompt,
                        prompt: segment.prompt
                    })
                });
                
                const veo3Result = await veo3Response.json();
                
                if (veo3Result.success) {
                    console.log(`✅ [Step 3] Segment ${i + 1} Veo3: ${veo3Result.operationName}`);
                    veo3Results.push({
                        segmentIndex: i,
                        timeRange: segment.timeRange,
                        focus: segment.focus,
                        prompt: segment.prompt,
                        operationId: veo3Result.operationName,
                        success: true
                    });
                } else {
                    console.log(`❌ [Step 3] Segment ${i + 1} thất bại: ${veo3Result.message}`);
                    veo3Results.push({
                        segmentIndex: i,
                        timeRange: segment.timeRange,
                        error: veo3Result.message,
                        success: false
                    });
                }
                
                // Chờ giữa các requests để tránh spam
                if (i < analysis.segments.length - 1) {
                    console.log(`⏳ [Step 3] Chờ 5 giây trước khi tạo segment tiếp theo...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                
            } catch (error) {
                console.log(`❌ [Step 3] Segment ${i + 1} lỗi: ${error.message}`);
                veo3Results.push({
                    segmentIndex: i,
                    timeRange: segment.timeRange,
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
                outputDir: outputDir
            };
            
            const resultPath = path.join(outputDir, 'mh370-complete-32s-result.json');
            fs.writeFileSync(resultPath, JSON.stringify(finalResult, null, 2));
            
            console.log(`📊 [Step 3] Đã lưu kết quả vào: ${resultPath}`);
            
            console.log('🎉 [MH370] Hoàn thành tạo video 32s với transcript MH370!');
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

console.log('🚀 [START] Tạo video 32s hoàn chỉnh với transcript MH370...');
createCompleteMH370Video32s().then(result => {
    if (result.success) {
        console.log('🎉 [MH370] Hoàn thành thành công!');
        console.log(`🎉 [MH370] Chủ đề: ${result.result.overallTheme}`);
        console.log(`🎉 [MH370] Đã gửi ${result.result.veo3OperationsSent} Veo3 requests`);
    } else {
        console.log(`❌ [MH370] Thất bại: ${result.error}`);
    }
});
