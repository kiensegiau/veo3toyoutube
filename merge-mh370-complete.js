const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function mergeMH370Videos() {
    try {
        console.log('🎬 [MH370] Ghép video MH370...');
        
        const outputDir = './temp/mh370-complete-32s';
        const audioDir = './public/audio';
        
        // Tạo thư mục output
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Tìm tất cả video MH370 mới nhất
        const files = fs.readdirSync(audioDir);
        const mh370Videos = files.filter(file => file.includes('mh370_segment_') && file.endsWith('.mp4'));
        
        console.log(`📝 [MH370] Tìm thấy ${mh370Videos.length} video MH370:`);
        mh370Videos.forEach((video, index) => {
            console.log(`📝 [MH370] ${index + 1}. ${video}`);
        });
        
        if (mh370Videos.length === 0) {
            throw new Error('Không tìm thấy video MH370 nào');
        }
        
        // Sắp xếp theo thứ tự segment
        const sortedVideos = mh370Videos.sort((a, b) => {
            const aSegment = parseInt(a.match(/segment_(\d+)/)[1]);
            const bSegment = parseInt(b.match(/segment_(\d+)/)[1]);
            return aSegment - bSegment;
        });
        
        console.log(`📝 [MH370] Video đã sắp xếp theo thứ tự:`);
        sortedVideos.forEach((video, index) => {
            console.log(`📝 [MH370] ${index + 1}. ${video}`);
        });
        
        // Kiểm tra các file video tồn tại
        const validVideoFiles = sortedVideos.map(video => {
            const videoPath = path.join(audioDir, video);
            if (!fs.existsSync(videoPath)) {
                console.warn(`⚠️ [MH370] File video không tồn tại: ${videoPath}`);
                return null;
            }
            return {
                filename: video,
                path: videoPath
            };
        }).filter(video => video !== null);
        
        if (validVideoFiles.length === 0) {
            throw new Error('Không có file video hợp lệ để ghép');
        }
        
        console.log(`📝 [MH370] Có ${validVideoFiles.length} file video hợp lệ để ghép`);
        
        // Tạo file list cho ffmpeg
        const listPath = path.join(outputDir, 'mh370_video_list.txt');
        const listContent = validVideoFiles.map(video => {
            const absolutePath = path.resolve(video.path);
            const normalizedPath = absolutePath.replace(/\\/g, '/');
            return `file '${normalizedPath}'`;
        }).join('\n');
        
        console.log(`📝 [MH370] Tạo file list: ${listPath}`);
        fs.writeFileSync(listPath, listContent, 'utf8');
        
        // Ghép video
        const finalVideoPath = path.join(outputDir, `mh370_32s_final_${Date.now()}.mp4`);
        const mergeCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${finalVideoPath}"`;
        
        console.log(`🎬 [MH370] Ghép video với lệnh: ${mergeCmd}`);
        await execAsync(mergeCmd);
        
        console.log(`✅ [MH370] Đã ghép video thành: ${finalVideoPath}`);
        
        // Lưu kết quả
        const finalResult = {
            timestamp: new Date().toISOString(),
            videosFound: mh370Videos.length,
            videosUsed: validVideoFiles.length,
            finalVideo: finalVideoPath,
            videoFiles: validVideoFiles,
            outputDir: outputDir
        };
        
        const resultPath = path.join(outputDir, 'mh370-merge-result.json');
        fs.writeFileSync(resultPath, JSON.stringify(finalResult, null, 2));
        
        console.log(`📊 [MH370] Đã lưu kết quả vào: ${resultPath}`);
        
        console.log('🎉 [MH370] Hoàn thành ghép video MH370!');
        console.log(`🎉 [MH370] Video kết quả: ${finalVideoPath}`);
        console.log(`🎉 [MH370] Chủ đề: Cuộc điều tra bí ẩn chuyến bay MH370`);
        console.log(`🎉 [MH370] Màu sắc: Xanh dương đậm, đen, trắng`);
        console.log(`🎉 [MH370] Phong cách: Tài liệu điều tra`);
        
        return {
            success: true,
            result: finalResult
        };
        
    } catch (error) {
        console.error(`❌ [MH370] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

console.log('🚀 [START] Ghép video MH370...');
mergeMH370Videos().then(result => {
    if (result.success) {
        console.log('🎉 [MH370] Hoàn thành thành công!');
        console.log(`🎉 [MH370] Video: ${result.result.finalVideo}`);
    } else {
        console.log(`❌ [MH370] Thất bại: ${result.error}`);
    }
});
