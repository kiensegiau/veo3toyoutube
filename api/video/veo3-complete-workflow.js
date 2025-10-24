const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Hàm tạo video hoàn chỉnh từ video gốc
async function createVeo3CompleteVideo(videoPath, options = {}) {
    try {
        console.log(`🎬 [createVeo3CompleteVideo] Bắt đầu tạo video 2 phút từ: ${videoPath}`);
        
        const {
            duration = 120, // 2 phút = 120 giây
            segmentDuration = 8, // Mỗi segment 8 giây
            outputFilename = `veo3_complete_${Date.now()}.mp4`
        } = options;
        
        const serverUrl = 'http://localhost:8888';
        const segmentsNeeded = Math.ceil(duration / segmentDuration); // 15 segments cho 2 phút
        
        console.log(`📊 [Step 1] Tính toán: ${segmentsNeeded} segments, mỗi ${segmentDuration}s`);
        
        // Step 1: Lấy thông tin video
        console.log(`📊 [Step 2] Lấy thông tin video...`);
        const videoInfoResponse = await fetch(`${serverUrl}/api/extract-frames`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: videoPath,
                count: 1,
                interval: 1
            })
        });
        
        const videoInfo = await videoInfoResponse.json();
        if (!videoInfo.success) {
            throw new Error(`Không thể lấy thông tin video: ${videoInfo.message}`);
        }
        
        console.log(`✅ [Step 2] Video info: ${videoInfo.videoInfo.duration}s, ${videoInfo.videoInfo.width}x${videoInfo.videoInfo.height}`);
        
        // Step 2: Tạo timeline đơn giản cho video
        console.log(`🎬 [Step 3] Tạo timeline đơn giản cho ${duration}s...`);
        const timelineSegments = [];
        
        // Tạo timeline đơn giản không cần ChatGPT
        for (let i = 0; i < segmentsNeeded; i++) {
            const startSecond = i * segmentDuration;
            const endSecond = Math.min(startSecond + segmentDuration, duration);
            
            console.log(`📸 [Step 3] Tạo segment ${i + 1}/${segmentsNeeded}: ${startSecond}s-${endSecond}s`);
            
            // Tạo timeline đơn giản
            const simpleTimeline = [
                {
                    timeStart: 0,
                    timeEnd: 2,
                    action: `Scene ${i + 1} - Professional technology scene with clean composition`,
                    cameraStyle: "medium-shot, static camera",
                    soundFocus: "Professional background sound",
                    visualDetails: "Clean white and black color scheme with bright lighting"
                },
                {
                    timeStart: 2,
                    timeEnd: 4,
                    action: `Scene ${i + 1} - Dynamic movement with modern elements`,
                    cameraStyle: "angled shot, slight panning",
                    soundFocus: "Smooth ambient sound",
                    visualDetails: "Modern color palette with dynamic lighting"
                },
                {
                    timeStart: 4,
                    timeEnd: 6,
                    action: `Scene ${i + 1} - Close-up details with focus on key elements`,
                    cameraStyle: "close-up, focused shot",
                    soundFocus: "Clear, detailed audio",
                    visualDetails: "Sharp focus with professional lighting"
                },
                {
                    timeStart: 6,
                    timeEnd: 8,
                    action: `Scene ${i + 1} - Wide shot revealing full context`,
                    cameraStyle: "wide shot, gradual zoom out",
                    soundFocus: "Full ambient soundscape",
                    visualDetails: "Complete scene with balanced composition"
                }
            ];
            
            // Lưu timeline segment
            timelineSegments.push({
                segmentIndex: i,
                startSecond: startSecond,
                endSecond: endSecond,
                timeline: simpleTimeline
            });
            
            console.log(`✅ [Step 3] Segment ${i + 1} timeline hoàn thành`);
        }
        
        console.log(`✅ [Step 3] Đã tạo ${timelineSegments.length} timeline segments`);
        
        // Step 3: Tạo video Veo3 cho từng segment
        console.log(`🎬 [Step 4] Tạo video Veo3 cho ${timelineSegments.length} segments...`);
        const veo3Videos = [];
        
        for (let i = 0; i < timelineSegments.length; i++) {
            const segment = timelineSegments[i];
            console.log(`🎬 [Step 4] Tạo video Veo3 cho segment ${i + 1}/${timelineSegments.length}`);
            
            // Tạo video Veo3 cho segment này
            const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: segment.timeline[0].action, // Sử dụng action đầu tiên
                    prompt: segment.timeline[0].action
                })
            });
            
            const veo3Result = await veo3Response.json();
            if (!veo3Result.success) {
                console.warn(`⚠️ [Step 4] Veo3 segment ${i + 1} thất bại, bỏ qua`);
                continue;
            }
            
            veo3Videos.push({
                segmentIndex: i,
                startSecond: segment.startSecond,
                endSecond: segment.endSecond,
                operationName: veo3Result.operationName,
                requestId: veo3Result.requestId,
                status: 'PENDING'
            });
            
            console.log(`✅ [Step 4] Veo3 segment ${i + 1} tạo thành công`);
            
            // Delay để tránh rate limit
            if (i < timelineSegments.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log(`✅ [Step 4] Đã tạo ${veo3Videos.length} video Veo3`);
        
        // Step 4: Check status và download videos
        console.log(`⏳ [Step 5] Chờ video Veo3 hoàn thành...`);
        const completedVideos = [];
        
        for (let i = 0; i < veo3Videos.length; i++) {
            const video = veo3Videos[i];
            console.log(`⏳ [Step 5] Chờ video ${i + 1}/${veo3Videos.length} hoàn thành...`);
            
            // Check status
            const statusResponse = await fetch(`${serverUrl}/api/check-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operationName: video.operationName
                })
            });
            
            const statusResult = await statusResponse.json();
            if (statusResult.success && statusResult.videoStatus === 'COMPLETED') {
                completedVideos.push({
                    ...video,
                    status: 'COMPLETED',
                    videoUrl: statusResult.videoUrl
                });
                console.log(`✅ [Step 5] Video ${i + 1} hoàn thành`);
            } else {
                console.warn(`⚠️ [Step 5] Video ${i + 1} chưa hoàn thành, bỏ qua`);
            }
        }
        
        console.log(`✅ [Step 5] Đã hoàn thành ${completedVideos.length}/${veo3Videos.length} video`);
        
        // Step 5: Merge videos
        if (completedVideos.length > 0) {
            console.log(`🎬 [Step 6] Merge ${completedVideos.length} video...`);
            
            // Tạo output directory
            const outputDir = path.join(__dirname, '../../public/final-videos');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
            const finalOutputPath = path.join(outputDir, outputFilename);
            
            // Merge videos
            const mergeResponse = await fetch(`${serverUrl}/api/merge-videos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    duration: duration,
                    filename: outputFilename
                })
            });
            
            const mergeResult = await mergeResponse.json();
            if (!mergeResult.success) {
                throw new Error(`Không thể merge video: ${mergeResult.message}`);
            }
            
            console.log(`✅ [Step 6] Video cuối cùng: ${mergeResult.output.filename}`);
            
            return {
                success: true,
                message: `Đã tạo video 2 phút thành công`,
                result: {
                    originalVideo: videoPath,
                    duration: duration,
                    segments: timelineSegments.length,
                    veo3Videos: completedVideos.length,
                    finalVideo: {
                        filename: outputFilename,
                        path: finalOutputPath,
                        publicPath: `/final-videos/${outputFilename}`,
                        size: mergeResult.output.size,
                        sizeMB: mergeResult.output.sizeMB
                    }
                }
            };
        } else {
            throw new Error('Không có video nào hoàn thành');
        }
        
    } catch (error) {
        console.error('❌ [createVeo3CompleteVideo] Lỗi:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// API endpoint
async function createVeo3CompleteVideoAPI(req, res) {
    try {
        const { videoPath, duration = 120, segmentDuration = 8, outputFilename } = req.body;
        
        if (!videoPath) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu videoPath'
            });
        }
        
        // Kiểm tra file tồn tại
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({
                success: false,
                message: 'Video file không tồn tại'
            });
        }
        
        console.log(`🎬 [createVeo3CompleteVideoAPI] Tạo video ${duration}s từ: ${videoPath}`);
        
        const result = await createVeo3CompleteVideo(videoPath, {
            duration,
            segmentDuration,
            outputFilename
        });
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Không thể tạo video hoàn chỉnh',
                error: result.error
            });
        }
        
        return res.json({
            success: true,
            message: `Đã tạo video ${duration}s thành công`,
            result: result.result
        });
        
    } catch (error) {
        console.error('❌ [createVeo3CompleteVideoAPI] Lỗi:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi tạo video hoàn chỉnh',
            error: error.message
        });
    }
}

module.exports = {
    createVeo3CompleteVideo,
    createVeo3CompleteVideoAPI
};
