const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Import các modules
const { extractFramesFromVideo, getVideoInfo } = require('./extract-frames');
const { analyzeVideoWithChatGPT, generateMockTranscript } = require('./analyze-video-chatgpt');
const { createMultipleVeo3Videos } = require('./veo3-generator');

// Hàm merge videos
async function mergeVeo3Videos(videoPaths, outputPath) {
    try {
        console.log(`🎬 [mergeVeo3Videos] Merge ${videoPaths.length} videos`);
        
        if (videoPaths.length === 0) {
            throw new Error('Không có video để merge');
        }
        
        // Tạo file list cho ffmpeg
        const listFilePath = path.join(__dirname, '../../temp/video_list.txt');
        const listContent = videoPaths.map(videoPath => `file '${videoPath}'`).join('\n');
        fs.writeFileSync(listFilePath, listContent);
        
        // Merge videos
        const command = `ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -c copy "${outputPath}"`;
        console.log(`🔧 [mergeVeo3Videos] Chạy lệnh: ${command}`);
        
        await execAsync(command);
        
        // Xóa file list
        fs.unlinkSync(listFilePath);
        
        console.log(`✅ [mergeVeo3Videos] Merge thành công: ${outputPath}`);
        
        return {
            success: true,
            outputPath,
            totalVideos: videoPaths.length
        };
        
    } catch (error) {
        console.error('❌ [mergeVeo3Videos] Lỗi:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Workflow chính: Hybrid method
async function createVeo3FromVideoHybrid(videoPath, options = {}) {
    try {
        console.log(`🚀 [createVeo3FromVideoHybrid] Bắt đầu workflow Hybrid cho: ${videoPath}`);
        
        const {
            frameCount = null, // Sẽ tính toán dựa trên duration
            frameInterval = 8,  // Mỗi 8 giây 1 frame
            outputFilename = `veo3_hybrid_${Date.now()}.mp4`
        } = options;
        
        // Step 1: Lấy thông tin video
        console.log(`📊 [Step 1] Lấy thông tin video...`);
        const videoInfo = await getVideoInfo(videoPath);
        if (!videoInfo.success) {
            throw new Error(`Không thể lấy thông tin video: ${videoInfo.error}`);
        }
        console.log(`✅ [Step 1] Video info: ${videoInfo.duration}s, ${videoInfo.width}x${videoInfo.height}`);
        
        // Step 2: Tính toán số segments cần thiết
        const totalDuration = videoInfo.duration;
        const segmentsNeeded = Math.ceil(totalDuration / 8); // Mỗi 8 giây 1 video Veo3
        const maxSegments = 200; // Tối đa 200 segments (26.7 phút video)
        const finalSegments = Math.min(segmentsNeeded, maxSegments);
        
        console.log(`📊 [Step 2] Video duration: ${totalDuration}s (${(totalDuration/60).toFixed(1)} phút)`);
        console.log(`📊 [Step 2] Segments needed: ${segmentsNeeded} (mỗi 8s)`);
        console.log(`📊 [Step 2] Final segments: ${finalSegments} (limited to ${maxSegments})`);
        console.log(`📊 [Step 2] Total video time: ${finalSegments * 8}s (${(finalSegments * 8 / 60).toFixed(1)} phút)`);
        
        if (segmentsNeeded > maxSegments) {
            console.log(`⚠️ [Step 2] Video quá dài! Sẽ chỉ tạo ${maxSegments} segments (${maxSegments * 8 / 60} phút)`);
            console.log(`💡 [Step 2] Để tạo toàn bộ video, cần chia thành nhiều batch hoặc tăng maxSegments`);
        }
        
        // Step 3: Extract frames (1 frame cho mỗi segment)
        console.log(`📸 [Step 3] Extract ${finalSegments} frames...`);
        const framesResult = await extractFramesFromVideo(videoPath, {
            count: finalSegments,
            interval: 8 // Mỗi 8 giây 1 frame
        });
        if (!framesResult.success) {
            throw new Error(`Không thể extract frames: ${framesResult.error}`);
        }
        console.log(`✅ [Step 3] Đã extract ${framesResult.totalFrames} frames`);
        
        // Step 4: Tạo transcript (mock hoặc real)
        console.log(`📝 [Step 4] Tạo transcript...`);
        const transcript = await generateMockTranscript(videoInfo);
        console.log(`✅ [Step 4] Transcript: ${transcript.length} characters`);
        
        // Step 5: Phân tích với ChatGPT
        console.log(`🤖 [Step 5] Phân tích video với ChatGPT...`);
        const analysis = await analyzeVideoWithChatGPT(transcript, framesResult.frames, videoInfo);
        if (!analysis.success) {
            throw new Error(`ChatGPT analysis failed: ${analysis.error}`);
        }
        console.log(`✅ [Step 5] ChatGPT phân tích thành công`);
        
        // Step 6: Tạo Veo3 videos
        console.log(`🎬 [Step 6] Tạo Veo3 videos...`);
        const veo3Result = await createMultipleVeo3Videos(analysis.analysis, options);
        if (!veo3Result.success) {
            throw new Error(`Veo3 generation failed: ${veo3Result.error}`);
        }
        console.log(`✅ [Step 6] Đã tạo ${veo3Result.successfulVideos}/${veo3Result.totalVideos} Veo3 videos`);
        
        // Step 7: Check status và download videos (nếu cần)
        console.log(`⏳ [Step 7] Veo3 videos đang được tạo...`);
        console.log(`📋 [Step 7] Operation names: ${veo3Result.veo3Videos.map(v => v.operationName).join(', ')}`);
        
        // Tạo output directory
        const outputDir = path.join(__dirname, '../../public/final-videos');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const finalOutputPath = path.join(outputDir, outputFilename);
        
        return {
            success: true,
            message: 'Veo3 Hybrid workflow hoàn thành',
            workflow: {
                videoPath,
                videoInfo,
                frames: framesResult.frames,
                transcript,
                analysis: analysis.analysis,
                veo3Videos: veo3Result.veo3Videos,
                outputPath: finalOutputPath
            },
            nextSteps: [
                'Check status của Veo3 videos',
                'Download completed videos',
                'Merge videos thành final output'
            ]
        };
        
    } catch (error) {
        console.error('❌ [createVeo3FromVideoHybrid] Lỗi:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// API endpoint chính
async function veo3HybridWorkflowAPI(req, res) {
    try {
        const { videoPath, options = {} } = req.body;
        
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
        
        console.log(`🎬 [veo3HybridWorkflowAPI] Bắt đầu Hybrid workflow cho: ${videoPath}`);
        
        const result = await createVeo3FromVideoHybrid(videoPath, options);
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Veo3 Hybrid workflow thất bại',
                error: result.error
            });
        }
        
        return res.json({
            success: true,
            message: 'Veo3 Hybrid workflow hoàn thành',
            result: result.workflow,
            nextSteps: result.nextSteps
        });
        
    } catch (error) {
        console.error('❌ [veo3HybridWorkflowAPI] Lỗi:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi Veo3 Hybrid workflow',
            error: error.message
        });
    }
}

module.exports = {
    createVeo3FromVideoHybrid,
    mergeVeo3Videos,
    veo3HybridWorkflowAPI
};
