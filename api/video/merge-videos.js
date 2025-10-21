const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Mỗi video dài 8 giây
const VIDEO_DURATION = 8;

function ensureVideosDir() {
    const videosDir = path.join(__dirname, '../../public/videos');
    if (!fs.existsSync(videosDir)) {
        fs.mkdirSync(videosDir, { recursive: true });
    }
    return videosDir;
}

function getRandomVideos(videosDir, count) {
    try {
        const files = fs.readdirSync(videosDir)
            .filter(file => file.endsWith('.mp4'))
            .map(file => path.join(videosDir, file));
        
        if (files.length === 0) {
            throw new Error('Không tìm thấy video nào trong thư mục videos/');
        }
        
        // Lấy ngẫu nhiên số lượng video cần thiết
        const selectedVideos = [];
        for (let i = 0; i < count; i++) {
            const randomIndex = Math.floor(Math.random() * files.length);
            selectedVideos.push(files[randomIndex]);
        }
        
        return selectedVideos;
    } catch (error) {
        throw new Error(`Lỗi đọc thư mục videos: ${error.message}`);
    }
}

function createConcatFile(videoPaths, concatFilePath) {
    const content = videoPaths.map(videoPath => `file '${videoPath.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatFilePath, content, 'utf8');
}

async function mergeVideos(req, res) {
    try {
        const body = req.body || {};
        const duration = parseInt(body.duration) || 60; // Mặc định 60 giây
        const outputFilename = body.filename || `merged_${Date.now()}.mp4`;
        
        console.log(`🎬 [mergeVideos] Yêu cầu ghép video ${duration} giây`);
        
        // Tính số lượng video cần thiết
        const videoCount = Math.ceil(duration / VIDEO_DURATION);
        console.log(`📊 [mergeVideos] Cần ${videoCount} video (mỗi video ${VIDEO_DURATION}s)`);
        
        // Lấy thư mục videos
        const videosDir = ensureVideosDir();
        
        // Lấy video ngẫu nhiên
        const selectedVideos = getRandomVideos(videosDir, videoCount);
        console.log(`🎲 [mergeVideos] Đã chọn ${selectedVideos.length} video ngẫu nhiên`);
        
        // Tạo file concat cho FFmpeg
        const concatFilePath = path.join(__dirname, '../../temp', `concat_${Date.now()}.txt`);
        const tempDir = path.dirname(concatFilePath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        createConcatFile(selectedVideos, concatFilePath);
        console.log(`📝 [mergeVideos] Đã tạo file concat: ${concatFilePath}`);
        
        // Đường dẫn file output
        const outputDir = path.join(__dirname, '../../public/videos');
        const outputPath = path.join(outputDir, outputFilename);
        
        // Sử dụng FFmpeg để ghép video
        const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputPath}" -y`;
        console.log(`🔧 [mergeVideos] Chạy FFmpeg: ${ffmpegCommand}`);
        
        const { stdout, stderr } = await execAsync(ffmpegCommand);
        console.log(`✅ [mergeVideos] FFmpeg stdout: ${stdout}`);
        if (stderr) {
            console.log(`⚠️ [mergeVideos] FFmpeg stderr: ${stderr}`);
        }
        
        // Xóa file concat tạm
        try {
            fs.unlinkSync(concatFilePath);
            console.log(`🗑️ [mergeVideos] Đã xóa file concat tạm`);
        } catch (err) {
            console.warn(`⚠️ [mergeVideos] Không thể xóa file concat: ${err.message}`);
        }
        
        // Kiểm tra file output
        if (!fs.existsSync(outputPath)) {
            throw new Error('File video ghép không được tạo thành công');
        }
        
        const stats = fs.statSync(outputPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`🎉 [mergeVideos] Hoàn thành! File: ${outputFilename} (${fileSizeMB}MB)`);
        
        return res.json({
            success: true,
            message: `Đã ghép ${videoCount} video thành công`,
            output: {
                filename: outputFilename,
                path: outputPath,
                publicPath: `/videos/${outputFilename}`,
                size: stats.size,
                sizeMB: fileSizeMB,
                duration: duration,
                videoCount: videoCount
            },
            selectedVideos: selectedVideos.map(v => path.basename(v))
        });
        
    } catch (error) {
        console.error('❌ [mergeVideos] Lỗi:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi ghép video: ' + error.message,
            error: error.message
        });
    }
}

async function listAvailableVideos(req, res) {
    try {
        const videosDir = ensureVideosDir();
        const files = fs.readdirSync(videosDir)
            .filter(file => file.endsWith('.mp4'))
            .map(file => {
                const filePath = path.join(videosDir, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    size: stats.size,
                    sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
                    path: filePath,
                    publicPath: `/videos/${file}`
                };
            });
        
        return res.json({
            success: true,
            count: files.length,
            videos: files,
            totalSizeMB: files.reduce((sum, v) => sum + parseFloat(v.sizeMB), 0).toFixed(2)
        });
        
    } catch (error) {
        console.error('❌ [listAvailableVideos] Lỗi:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi liệt kê video: ' + error.message,
            error: error.message
        });
    }
}

module.exports = {
    mergeVideos,
    listAvailableVideos
};
