const fetch = require('node-fetch');
const fs = require('fs');

async function monitorAllVeo3Videos() {
    try {
        console.log('🔍 [Test] Kiểm tra trạng thái tất cả video Veo3...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Đọc danh sách video từ file kết quả
        console.log('📖 [Step 1] Đọc danh sách video...');
        const resultsPath = './temp/veo3-multiple-results.json';
        
        if (!fs.existsSync(resultsPath)) {
            throw new Error('Không tìm thấy file kết quả. Hãy chạy test-create-multiple-veo3.js trước.');
        }
        
        const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        console.log(`📖 [Step 1] Đã đọc ${resultsData.videos.length} video`);
        
        // Kiểm tra trạng thái từng video
        console.log('🔍 [Step 2] Kiểm tra trạng thái từng video...');
        const statusResults = [];
        
        for (const video of resultsData.videos) {
            console.log(`🔍 [Step 2] Kiểm tra video ${video.index}: ${video.operationName}`);
            
            const statusResponse = await fetch(`${serverUrl}/api/check-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operationName: video.operationName
                })
            });
            
            const statusResult = await statusResponse.json();
            
            if (statusResult.success) {
                statusResults.push({
                    index: video.index,
                    operationName: video.operationName,
                    status: statusResult.videoStatus,
                    timeRange: video.timeRange,
                    prompt: video.prompt.substring(0, 80) + '...',
                    videoUrl: statusResult.videoUrl || null
                });
                
                console.log(`🔍 [Step 2] Video ${video.index}: ${statusResult.videoStatus}`);
                
                if (statusResult.videoStatus === 'COMPLETED' && statusResult.videoUrl) {
                    console.log(`🎉 [Step 2] Video ${video.index} đã hoàn thành!`);
                }
            } else {
                console.log(`❌ [Step 2] Video ${video.index} lỗi: ${statusResult.message}`);
            }
            
            // Chờ 1 giây giữa các request
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Tóm tắt trạng thái
        console.log('📊 [Step 3] Tóm tắt trạng thái:');
        const completedVideos = statusResults.filter(v => v.status === 'COMPLETED');
        const pendingVideos = statusResults.filter(v => v.status === 'PENDING');
        const failedVideos = statusResults.filter(v => v.status === 'FAILED');
        
        console.log(`📊 [Step 3] - Hoàn thành: ${completedVideos.length}`);
        console.log(`📊 [Step 3] - Đang xử lý: ${pendingVideos.length}`);
        console.log(`📊 [Step 3] - Thất bại: ${failedVideos.length}`);
        
        for (const video of statusResults) {
            console.log(`📊 [Step 3] - Video ${video.index} (${video.timeRange}): ${video.status}`);
            if (video.videoUrl) {
                console.log(`📊 [Step 3]   URL: ${video.videoUrl}`);
            }
        }
        
        // Lưu trạng thái
        const statusPath = './temp/veo3-status-results.json';
        fs.writeFileSync(statusPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            totalVideos: statusResults.length,
            completed: completedVideos.length,
            pending: pendingVideos.length,
            failed: failedVideos.length,
            videos: statusResults
        }, null, 2));
        
        console.log(`📊 [Step 3] Đã lưu trạng thái vào: ${statusPath}`);
        
        // Nếu có video hoàn thành, tải về
        if (completedVideos.length > 0) {
            console.log('📥 [Step 4] Tải video hoàn thành...');
            
            for (const video of completedVideos) {
                console.log(`📥 [Step 4] Tải video ${video.index}...`);
                
                const downloadResponse = await fetch(`${serverUrl}/api/tts/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audioUrl: video.videoUrl,
                        filename: `veo3_video_${video.index}_${Date.now()}.mp4`
                    })
                });
                
                const downloadResult = await downloadResponse.json();
                console.log(`📥 [Step 4] Video ${video.index} download:`, downloadResult.success ? '✅ Success' : '❌ Failed');
                
                if (downloadResult.success) {
                    console.log(`📥 [Step 4] Video ${video.index} đã tải về: ${downloadResult.outPath}`);
                }
            }
        }
        
        console.log('🎉 [Test] Hoàn thành kiểm tra trạng thái!');
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Kiểm tra trạng thái tất cả video Veo3...');
monitorAllVeo3Videos();
