const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function mergeAvailableVideos() {
    try {
        console.log('🎬 [Merge] Ghép các video Veo3 đã có...');
        
        const audioDir = './public/audio';
        const outputDir = './temp/veo3-32s-sequential-test';
        
        // Tìm các video segment mới nhất
        const files = fs.readdirSync(audioDir);
        const segmentFiles = files
            .filter(file => file.startsWith('veo3_segment_') && file.endsWith('.mp4'))
            .map(file => {
                const stats = fs.statSync(path.join(audioDir, file));
                return {
                    name: file,
                    path: path.join(audioDir, file),
                    mtime: stats.mtime
                };
            })
            .sort((a, b) => b.mtime - a.mtime); // Sắp xếp theo thời gian mới nhất
        
        console.log(`📊 [Merge] Tìm thấy ${segmentFiles.length} video segments`);
        
        // Lấy 4 video mới nhất (có thể có nhiều phiên bản)
        const latestSegments = [];
        for (let i = 0; i < 4; i++) {
            if (segmentFiles[i]) {
                latestSegments.push({
                    index: i,
                    path: segmentFiles[i].path,
                    name: segmentFiles[i].name
                });
            }
        }
        
        console.log(`📊 [Merge] Sẽ ghép ${latestSegments.length} video segments`);
        latestSegments.forEach((seg, i) => {
            console.log(`📊 [Merge] Segment ${i}: ${seg.name}`);
        });
        
        if (latestSegments.length === 0) {
            throw new Error('Không tìm thấy video segments để ghép');
        }
        
        // Tạo file list cho ffmpeg
        const listPath = path.join(outputDir, 'manual_video_list.txt');
        const listContent = latestSegments.map(video => {
            const absolutePath = path.resolve(video.path);
            const normalizedPath = absolutePath.replace(/\\/g, '/');
            return `file '${normalizedPath}'`;
        }).join('\n');
        
        console.log(`📝 [Merge] Tạo file list: ${listPath}`);
        console.log(`📝 [Merge] Nội dung file list:\n${listContent}`);
        
        fs.writeFileSync(listPath, listContent, 'utf8');
        
        // Ghép video
        const finalVideoPath = path.join(outputDir, `veo3_32s_manual_${Date.now()}.mp4`);
        const mergeCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${finalVideoPath}"`;
        
        console.log(`🎬 [Merge] Đang ghép video...`);
        console.log(`🎬 [Merge] Command: ${mergeCmd}`);
        
        await execAsync(mergeCmd);
        
        console.log(`✅ [Merge] Đã ghép video thành: ${finalVideoPath}`);
        
        // Kiểm tra file kết quả
        if (fs.existsSync(finalVideoPath)) {
            const stats = fs.statSync(finalVideoPath);
            console.log(`📊 [Merge] Video kết quả: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        }
        
        return {
            success: true,
            finalVideo: finalVideoPath,
            segmentsUsed: latestSegments.length
        };
        
    } catch (error) {
        console.error(`❌ [Merge] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

console.log('🚀 [START] Ghép các video Veo3 đã có...');
mergeAvailableVideos().then(result => {
    if (result.success) {
        console.log('🎉 [Merge] Hoàn thành ghép video!');
        console.log(`🎉 [Merge] Video kết quả: ${result.finalVideo}`);
        console.log(`🎉 [Merge] Số segments: ${result.segmentsUsed}`);
    } else {
        console.log(`❌ [Merge] Thất bại: ${result.error}`);
    }
});
