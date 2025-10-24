const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Hàm extract frames từ video
async function extractFramesFromVideo(videoPath, options = {}) {
    try {
        const {
            count = 8,           // Số frames cần extract
            interval = 8,         // Khoảng cách giữa các frames (giây)
            quality = 'medium',   // Chất lượng ảnh
            outputDir = null      // Thư mục output
        } = options;

        console.log(`🎬 [extractFrames] Bắt đầu extract frames từ: ${videoPath}`);
        
        // Tạo thư mục output nếu chưa có
        const framesDir = outputDir || path.join(__dirname, '../../temp/frames');
        if (!fs.existsSync(framesDir)) {
            fs.mkdirSync(framesDir, { recursive: true });
        }

        const frames = [];
        const timestamp = Date.now();
        
        for (let i = 0; i < count; i++) {
            const frameTime = i * interval;
            const frameFilename = `frame_${i + 1}_${frameTime}s_${timestamp}.jpg`;
            const framePath = path.join(framesDir, frameFilename);
            
            console.log(`📸 [extractFrames] Extracting frame ${i + 1}/${count} at ${frameTime}s`);
            
            // Sử dụng ffmpeg để extract frame
            const command = `ffmpeg -y -i "${videoPath}" -ss ${frameTime} -vframes 1 -q:v 2 "${framePath}"`;
            
            try {
                await execAsync(command);
                
                if (fs.existsSync(framePath)) {
                    frames.push({
                        index: i + 1,
                        timestamp: frameTime,
                        path: framePath,
                        filename: frameFilename,
                        relativePath: path.relative(process.cwd(), framePath)
                    });
                    console.log(`✅ [extractFrames] Frame ${i + 1} extracted: ${frameFilename}`);
                } else {
                    console.warn(`⚠️ [extractFrames] Frame ${i + 1} không được tạo`);
                }
            } catch (error) {
                console.error(`❌ [extractFrames] Lỗi extract frame ${i + 1}:`, error.message);
            }
        }

        console.log(`🎉 [extractFrames] Hoàn thành extract ${frames.length}/${count} frames`);
        
        return {
            success: true,
            frames,
            totalFrames: frames.length,
            outputDir: framesDir,
            videoPath
        };

    } catch (error) {
        console.error('❌ [extractFrames] Lỗi:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Hàm lấy thông tin video
async function getVideoInfo(videoPath) {
    try {
        console.log(`📊 [getVideoInfo] Lấy thông tin video: ${videoPath}`);
        
        const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
        const { stdout } = await execAsync(command);
        const info = JSON.parse(stdout);
        
        const duration = parseFloat(info.format.duration);
        const videoStream = info.streams.find(s => s.codec_type === 'video');
        
        return {
            success: true,
            duration,
            width: videoStream.width,
            height: videoStream.height,
            fps: eval(videoStream.r_frame_rate),
            codec: videoStream.codec_name,
            format: info.format.format_name,
            size: info.format.size
        };
        
    } catch (error) {
        console.error('❌ [getVideoInfo] Lỗi:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// API endpoint
async function extractFramesAPI(req, res) {
    try {
        const { videoPath, count = 8, interval = 8, quality = 'medium' } = req.body;
        
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
        
        // Lấy thông tin video trước
        const videoInfo = await getVideoInfo(videoPath);
        if (!videoInfo.success) {
            return res.status(500).json({
                success: false,
                message: 'Không thể lấy thông tin video',
                error: videoInfo.error
            });
        }
        
        // Extract frames
        const result = await extractFramesFromVideo(videoPath, {
            count,
            interval,
            quality
        });
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Không thể extract frames',
                error: result.error
            });
        }
        
        return res.json({
            success: true,
            message: `Đã extract ${result.totalFrames} frames`,
            videoInfo,
            frames: result.frames,
            outputDir: result.outputDir
        });
        
    } catch (error) {
        console.error('❌ [extractFramesAPI] Lỗi:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi extract frames',
            error: error.message
        });
    }
}

module.exports = {
    extractFramesFromVideo,
    getVideoInfo,
    extractFramesAPI
};
