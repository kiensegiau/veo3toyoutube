const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

/**
 * Tách video thành các đoạn 8 giây
 * @param {string} videoPath - Đường dẫn video gốc
 * @param {Object} options - Tùy chọn
 * @returns {Promise<Object>} - Kết quả tách video
 */
async function splitVideoInto8sSegments(videoPath, options = {}) {
    try {
        console.log(`🎬 [splitVideoInto8sSegments] Tách video thành các đoạn 8s: ${videoPath}`);
        
        const {
            outputDir = './temp/segments',
            segmentDuration = 8,
            maxSegments = 200
        } = options;
        
        // Tạo thư mục output nếu chưa có
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Lấy thông tin video
        console.log(`📊 [Step 1] Lấy thông tin video...`);
        const ffprobeCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
        const { stdout } = await execAsync(ffprobeCmd);
        const videoInfo = JSON.parse(stdout);
        
        const duration = parseFloat(videoInfo.format.duration);
        const segmentsNeeded = Math.min(Math.ceil(duration / segmentDuration), maxSegments);
        
        console.log(`📊 [Step 1] Video: ${duration}s, cần ${segmentsNeeded} segments`);
        
        // Tách video thành các đoạn 8s
        console.log(`✂️ [Step 2] Tách video thành ${segmentsNeeded} segments...`);
        const segments = [];
        
        for (let i = 0; i < segmentsNeeded; i++) {
            const startTime = i * segmentDuration;
            const endTime = Math.min(startTime + segmentDuration, duration);
            const segmentFilename = `segment_${i.toString().padStart(3, '0')}_${startTime}s-${endTime}s.mp4`;
            const segmentPath = path.join(outputDir, segmentFilename);
            
            console.log(`✂️ [Step 2] Tạo segment ${i + 1}/${segmentsNeeded}: ${startTime}s-${endTime}s`);
            
            const ffmpegCmd = `ffmpeg -i "${videoPath}" -ss ${startTime} -t ${segmentDuration} -c copy -avoid_negative_ts make_zero "${segmentPath}"`;
            await execAsync(ffmpegCmd);
            
            segments.push({
                index: i,
                startTime: startTime,
                endTime: endTime,
                duration: endTime - startTime,
                filename: segmentFilename,
                path: segmentPath
            });
        }
        
        console.log(`✅ [Step 2] Đã tạo ${segments.length} segments`);
        
        return {
            success: true,
            videoInfo: {
                duration: duration,
                width: videoInfo.streams[0].width,
                height: videoInfo.streams[0].height,
                fps: eval(videoInfo.streams[0].r_frame_rate)
            },
            segments: segments,
            outputDir: outputDir
        };
        
    } catch (error) {
        console.error(`❌ [splitVideoInto8sSegments] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * API endpoint cho tách video
 */
async function splitVideoAPI(req, res) {
    try {
        console.log(`🎬 [splitVideoAPI] API tách video được gọi`);
        
        const { videoPath, outputDir, maxSegments } = req.body;
        
        if (!videoPath) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu videoPath'
            });
        }
        
        const result = await splitVideoInto8sSegments(videoPath, {
            outputDir,
            maxSegments
        });
        
        if (result.success) {
            return res.json({
                success: true,
                message: `Đã tách video thành ${result.segments.length} segments`,
                result: result
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }
        
    } catch (error) {
        console.error(`❌ [splitVideoAPI] Lỗi:`, error.message);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

module.exports = {
    splitVideoInto8sSegments,
    splitVideoAPI
};
