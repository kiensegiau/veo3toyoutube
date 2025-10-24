const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

/**
 * Phân tích tổng thể video để xác định chủ đề chung
 * @param {string} videoPath - Đường dẫn video gốc
 * @param {Array} segments - Danh sách segments
 * @returns {Promise<Object>} - Phân tích chủ đề tổng thể
 */
async function analyzeOverallVideoTheme(videoPath, segments) {
    try {
        console.log(`🎯 [analyzeOverallVideoTheme] Phân tích chủ đề tổng thể...`);
        
        // Trích xuất một vài frames từ video để phân tích tổng thể
        const tempDir = path.join(path.dirname(videoPath), 'temp_theme_analysis');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Trích xuất frames từ các thời điểm khác nhau
        const frameTimes = [0, 8, 16, 24]; // Các thời điểm đại diện
        const frames = [];
        
        for (let i = 0; i < frameTimes.length; i++) {
            const frameTime = frameTimes[i];
            const framePath = path.join(tempDir, `theme_frame_${i}.jpg`);
            
            try {
                await execAsync(`ffmpeg -i "${videoPath}" -ss ${frameTime} -vframes 1 "${framePath}"`);
                
                if (fs.existsSync(framePath)) {
                    const imageBuffer = fs.readFileSync(framePath);
                    const base64Image = imageBuffer.toString('base64');
                    
                    frames.push({
                        time: frameTime,
                        path: framePath,
                        base64: base64Image
                    });
                }
            } catch (error) {
                console.warn(`⚠️ [analyzeOverallVideoTheme] Không thể trích frame tại ${frameTime}s:`, error.message);
            }
        }
        
        console.log(`🎯 [analyzeOverallVideoTheme] Đã trích xuất ${frames.length} frames để phân tích`);
        
        // Gửi cho ChatGPT để phân tích chủ đề tổng thể
        const systemPrompt = `Bạn là chuyên gia phân tích video với khả năng xác định chủ đề tổng thể và tính liên kết.

Nhiệm vụ: Phân tích các frames này để xác định:
1. CHỦ ĐỀ CHÍNH của video
2. ĐỊA ĐIỂM/THIẾT LẬP chung
3. PHONG CÁCH VISUAL chung
4. MÀU SẮC CHỦ ĐẠO
5. TÍNH LIÊN KẾT giữa các cảnh
6. HƯỚNG PHÁT TRIỂN của video

Trả về JSON format:
{
    "mainTheme": "chủ đề chính của video",
    "location": "địa điểm/thể loại chung",
    "visualStyle": "phong cách visual chung",
    "colorPalette": ["màu chủ đạo 1", "màu chủ đạo 2"],
    "mood": "tâm trạng/cảm xúc chung",
    "continuity": "cách các cảnh liên kết với nhau",
    "sceneProgression": "hướng phát triển từ cảnh này sang cảnh khác",
    "unifiedPrompt": "prompt tổng thể để tạo video liền mạch"
}`;

        const userPrompt = `Phân tích các frames này để xác định chủ đề tổng thể và tính liên kết cho video 32 giây.`;

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ];

        // Thêm images vào message
        if (frames.length > 0) {
            messages[1].content = [
                { type: "text", text: userPrompt },
                ...frames.map(frame => ({
                    type: "image_url",
                    image_url: {
                        url: `data:image/jpeg;base64,${frame.base64}`,
                        detail: "high"
                    }
                }))
            ];
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: messages,
                max_tokens: 1500,
                temperature: 0.7
            })
        });

        const data = await response.json();
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const analysisText = data.choices[0].message.content;
            console.log(`✅ [analyzeOverallVideoTheme] ChatGPT response`);
            
            // Parse JSON từ response
            try {
                const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const analysis = JSON.parse(jsonMatch[0]);
                    console.log(`✅ [analyzeOverallVideoTheme] Đã phân tích chủ đề: ${analysis.mainTheme}`);
                    return analysis;
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseError) {
                console.warn(`⚠️ [analyzeOverallVideoTheme] Không thể parse JSON, tạo mock analysis`);
                
                // Mock analysis fallback
                return {
                    mainTheme: "Professional technology demonstration",
                    location: "Modern office/studio environment",
                    visualStyle: "Clean, modern, professional",
                    colorPalette: ["#ffffff", "#000000", "#0066cc"],
                    mood: "Professional, confident, innovative",
                    continuity: "Smooth transitions between scenes",
                    sceneProgression: "Progressive demonstration of features",
                    unifiedPrompt: "Create a professional technology video with clean composition, modern lighting, and smooth transitions between scenes"
                };
            }
        } else {
            throw new Error('Invalid ChatGPT response');
        }
        
    } catch (error) {
        console.warn(`⚠️ [analyzeOverallVideoTheme] Lỗi:`, error.message);
        
        // Mock analysis fallback
        return {
            mainTheme: "Professional technology demonstration",
            location: "Modern office/studio environment", 
            visualStyle: "Clean, modern, professional",
            colorPalette: ["#ffffff", "#000000", "#0066cc"],
            mood: "Professional, confident, innovative",
            continuity: "Smooth transitions between scenes",
            sceneProgression: "Progressive demonstration of features",
            unifiedPrompt: "Create a professional technology video with clean composition, modern lighting, and smooth transitions between scenes"
        };
    }
}

/**
 * Xử lý video 32s thành 4 đoạn 8s song song với chủ đề liên kết và ghép lại
 * @param {string} videoPath - Đường dẫn video gốc
 * @param {Object} options - Tùy chọn
 * @returns {Promise<Object>} - Kết quả hoàn chỉnh
 */
async function veo3Parallel32sWorkflow(videoPath, options = {}) {
    try {
        console.log(`🎬 [veo3Parallel32sWorkflow] Xử lý video 32s song song với chủ đề liên kết: ${videoPath}`);
        
        const {
            startSecond = 0,
            totalDuration = 32,
            segmentDuration = 8,
            outputDir = './temp/veo3-32s-parallel'
        } = options;
        
        // Tạo thư mục output
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const segmentsNeeded = Math.ceil(totalDuration / segmentDuration); // 4 segments
        console.log(`📊 [Step 1] Sẽ tạo ${segmentsNeeded} segments song song`);
        
        // Step 1: Tạo các segments song song
        console.log(`✂️ [Step 1] Tạo ${segmentsNeeded} segments song song...`);
        const segmentPromises = [];
        
        for (let i = 0; i < segmentsNeeded; i++) {
            const segmentStart = startSecond + (i * segmentDuration);
            const segmentEnd = Math.min(segmentStart + segmentDuration, startSecond + totalDuration);
            const segmentPath = path.join(outputDir, `segment_${i}_${segmentStart}s-${segmentEnd}s.mp4`);
            
            console.log(`✂️ [Step 1] Tạo segment ${i + 1}: ${segmentStart}s-${segmentEnd}s`);
            
            const segmentPromise = execAsync(`ffmpeg -i "${videoPath}" -ss ${segmentStart} -t ${segmentDuration} -c copy -avoid_negative_ts make_zero "${segmentPath}"`);
            segmentPromises.push({
                index: i,
                startSecond: segmentStart,
                endSecond: segmentEnd,
                path: segmentPath,
                promise: segmentPromise
            });
        }
        
        // Chờ tất cả segments hoàn thành
        const segments = [];
        for (const segmentData of segmentPromises) {
            await segmentData.promise;
            segments.push({
                index: segmentData.index,
                startSecond: segmentData.startSecond,
                endSecond: segmentData.endSecond,
                path: segmentData.path,
                duration: segmentData.endSecond - segmentData.startSecond
            });
            console.log(`✅ [Step 1] Segment ${segmentData.index + 1} hoàn thành`);
        }
        
        console.log(`✅ [Step 1] Đã tạo ${segments.length} segments`);
        
        // Step 1.5: Phân tích tổng thể video để xác định chủ đề chung
        console.log(`🎯 [Step 1.5] Phân tích tổng thể video để xác định chủ đề chung...`);
        const overallAnalysis = await analyzeOverallVideoTheme(videoPath, segments);
        console.log(`✅ [Step 1.5] Đã phân tích chủ đề: ${overallAnalysis.mainTheme}`);
        
        // Step 2: Xử lý song song từng segment với Veo3 (có chủ đề chung)
        console.log(`🎬 [Step 2] Xử lý song song ${segments.length} segments với Veo3 (chủ đề: ${overallAnalysis.mainTheme})...`);
        const serverUrl = 'http://localhost:8888';
        
        const veo3Promises = segments.map(async (segment) => {
            console.log(`🎬 [Step 2] Xử lý segment ${segment.index + 1} với chủ đề chung...`);
            
            try {
                // Gọi API complete workflow với thông tin chủ đề
                const response = await fetch(`${serverUrl}/api/veo3-complete-workflow`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        videoPath: segment.path,
                        startSecond: 0,
                        duration: segmentDuration,
                        frameInterval: 1,
                        maxFrames: 8,
                        outputDir: path.join(outputDir, `segment_${segment.index}_result`),
                        themeContext: overallAnalysis // Truyền thông tin chủ đề
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    console.log(`✅ [Step 2] Segment ${segment.index + 1} Veo3: ${result.result.veo3Operation}`);
                    return {
                        segmentIndex: segment.index,
                        segment: segment,
                        veo3Operation: result.result.veo3Operation,
                        success: true
                    };
                } else {
                    console.log(`❌ [Step 2] Segment ${segment.index + 1} thất bại: ${result.message}`);
                    return {
                        segmentIndex: segment.index,
                        segment: segment,
                        error: result.message,
                        success: false
                    };
                }
            } catch (error) {
                console.log(`❌ [Step 2] Segment ${segment.index + 1} lỗi: ${error.message}`);
                return {
                    segmentIndex: segment.index,
                    segment: segment,
                    error: error.message,
                    success: false
                };
            }
        });
        
        // Chờ tất cả Veo3 hoàn thành
        const veo3Results = await Promise.all(veo3Promises);
        const successfulSegments = veo3Results.filter(r => r.success);
        
        console.log(`✅ [Step 2] Đã xử lý ${successfulSegments.length}/${segments.length} segments`);
        
        // Step 3: Kiểm tra trạng thái và tải video Veo3
        console.log(`🔍 [Step 3] Kiểm tra trạng thái và tải video Veo3...`);
        const videoFiles = [];
        
        for (const veo3Result of successfulSegments) {
            console.log(`🔍 [Step 3] Kiểm tra segment ${veo3Result.segmentIndex + 1}...`);
            
            // Kiểm tra trạng thái
            const statusResponse = await fetch(`${serverUrl}/api/check-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operationName: veo3Result.veo3Operation
                })
            });
            
            const statusResult = await statusResponse.json();
            
            if (statusResult.success && statusResult.videoStatus === 'COMPLETED' && statusResult.videoUrl) {
                console.log(`✅ [Step 3] Segment ${veo3Result.segmentIndex + 1} đã hoàn thành`);
                
                // Tải video
                const downloadResponse = await fetch(`${serverUrl}/api/tts/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audioUrl: statusResult.videoUrl,
                        filename: `veo3_segment_${veo3Result.segmentIndex}_${Date.now()}.mp4`
                    })
                });
                
                const downloadResult = await downloadResponse.json();
                
                if (downloadResult.success) {
                    videoFiles.push({
                        segmentIndex: veo3Result.segmentIndex,
                        path: downloadResult.outPath,
                        startSecond: veo3Result.segment.startSecond,
                        endSecond: veo3Result.segment.endSecond
                    });
                    console.log(`✅ [Step 3] Segment ${veo3Result.segmentIndex + 1} đã tải về`);
                } else {
                    console.log(`❌ [Step 3] Segment ${veo3Result.segmentIndex + 1} tải về thất bại`);
                }
            } else {
                console.log(`⏳ [Step 3] Segment ${veo3Result.segmentIndex + 1} đang xử lý...`);
            }
        }
        
        console.log(`✅ [Step 3] Đã tải ${videoFiles.length} video Veo3`);
        
        // Step 4: Ghép video thành 1 video kết quả
        if (videoFiles.length > 0) {
            console.log(`🎬 [Step 4] Ghép ${videoFiles.length} video thành 1 video kết quả...`);
            
            // Sắp xếp theo thứ tự
            videoFiles.sort((a, b) => a.segmentIndex - b.segmentIndex);
            
            // Tạo file list cho ffmpeg
            const listPath = path.join(outputDir, 'video_list.txt');
            const listContent = videoFiles.map(video => {
                const videoPath = video.path || '';
                return `file '${videoPath.replace(/\\/g, '/')}'`;
            }).join('\n');
            fs.writeFileSync(listPath, listContent);
            
            // Ghép video
            const finalVideoPath = path.join(outputDir, `veo3_32s_final_${Date.now()}.mp4`);
            const mergeCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${finalVideoPath}"`;
            
            await execAsync(mergeCmd);
            
            console.log(`✅ [Step 4] Đã ghép video thành: ${finalVideoPath}`);
            
            // Lưu kết quả hoàn chỉnh
            const finalResult = {
                timestamp: new Date().toISOString(),
                originalVideo: videoPath,
                totalDuration: totalDuration,
                overallTheme: overallAnalysis,
                segmentsCreated: segments.length,
                segmentsProcessed: successfulSegments.length,
                videosDownloaded: videoFiles.length,
                finalVideo: finalVideoPath,
                segments: segments,
                veo3Results: veo3Results,
                videoFiles: videoFiles,
                outputDir: outputDir
            };
            
            const resultPath = path.join(outputDir, 'veo3-32s-parallel-result.json');
            fs.writeFileSync(resultPath, JSON.stringify(finalResult, null, 2));
            
            console.log(`📊 [Step 4] Đã lưu kết quả vào: ${resultPath}`);
            
            return {
                success: true,
                result: finalResult
            };
            
        } else {
            throw new Error('Không có video nào được tải về để ghép');
        }
        
    } catch (error) {
        console.error(`❌ [veo3Parallel32sWorkflow] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * API endpoint cho workflow 32s song song với chủ đề liên kết
 */
async function veo3Parallel32sWorkflowAPI(req, res) {
    try {
        console.log(`🎬 [veo3Parallel32sWorkflowAPI] API workflow 32s song song với chủ đề liên kết được gọi`);
        
        const { videoPath, startSecond, totalDuration, segmentDuration, outputDir } = req.body;
        
        if (!videoPath) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu videoPath'
            });
        }
        
        const result = await veo3Parallel32sWorkflow(videoPath, {
            startSecond,
            totalDuration,
            segmentDuration,
            outputDir
        });
        
        if (result.success) {
            return res.json({
                success: true,
                message: `Đã hoàn thành workflow 32s song song với chủ đề liên kết`,
                result: result.result
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }
        
    } catch (error) {
        console.error(`❌ [veo3Parallel32sWorkflowAPI] Lỗi:`, error.message);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

module.exports = {
    analyzeOverallVideoTheme,
    veo3Parallel32sWorkflow,
    veo3Parallel32sWorkflowAPI
};