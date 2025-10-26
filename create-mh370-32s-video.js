const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

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
        
        // Step 3: Tạo 4 video Veo3 song song với prompts đồng nhất
        console.log('🎬 [Step 3] Tạo 4 video Veo3 song song với prompts đồng nhất...');
        
        const veo3Promises = analysis.segments.map(async (segment, index) => {
            console.log(`🎬 [Step 3] Tạo video segment ${index + 1}: ${segment.timeRange}`);
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
                    console.log(`✅ [Step 3] Segment ${index + 1} Veo3: ${veo3Result.operationName}`);
                    return {
                        segmentIndex: index,
                        timeRange: segment.timeRange,
                        focus: segment.focus,
                        prompt: segment.prompt,
                        operationId: veo3Result.operationName,
                        success: true
                    };
                } else {
                    console.log(`❌ [Step 3] Segment ${index + 1} thất bại: ${veo3Result.message}`);
                    return {
                        segmentIndex: index,
                        timeRange: segment.timeRange,
                        error: veo3Result.message,
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
        
        console.log(`✅ [Step 3] Đã gửi ${successfulOperations.length}/4 Veo3 requests`);
        console.log(`🚀 [Step 3] Tất cả Veo3 đang chạy ngầm...`);
        
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
                            console.log(`✅ [Step 4] Segment ${veo3Result.segmentIndex + 1} đã tải về`);
                            console.log(`✅ [Step 4] Video path: ${downloadResult.outPath}`);
                            return {
                                segmentIndex: veo3Result.segmentIndex,
                                timeRange: veo3Result.timeRange,
                                focus: veo3Result.focus,
                                path: downloadResult.outPath,
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
