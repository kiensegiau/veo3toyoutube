const fetch = require('node-fetch');

async function test30sVideo() {
    try {
        console.log('🎬 [test30sVideo] Test tạo video 30 giây từ video gốc');
        
        const serverUrl = 'http://localhost:8888';
        
        // Test tạo video 30 giây (4 segments x 8s = 32s)
        console.log('\n🎬 [Test] Tạo video 30 giây từ video gốc...');
        const response = await fetch(`${serverUrl}/api/create-veo3-complete-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                duration: 30, // 30 giây
                segmentDuration: 8, // Mỗi segment 8 giây
                outputFilename: `veo3_30s_${Date.now()}.mp4`
            })
        });
        
        const result = await response.json();
        console.log('🎬 [Test] 30s video result:', result.success ? '✅ Success' : '❌ Failed');
        
        if (result.success) {
            console.log('🎬 [Test] Video 30s tạo thành công!');
            
            // Hiển thị thông tin chi tiết
            console.log('\n📊 [Details] Thông tin video:');
            console.log(`📊 Original video: ${result.result.originalVideo}`);
            console.log(`📊 Duration: ${result.result.duration}s`);
            console.log(`📊 Segments: ${result.result.segments}`);
            console.log(`📊 Veo3 videos: ${result.result.veo3Videos}`);
            
            if (result.result.finalVideo) {
                console.log('\n🎬 [Final Video] Thông tin video cuối:');
                console.log(`🎬 Filename: ${result.result.finalVideo.filename}`);
                console.log(`🎬 Path: ${result.result.finalVideo.path}`);
                console.log(`🎬 Public path: ${result.result.finalVideo.publicPath}`);
                console.log(`🎬 Size: ${result.result.finalVideo.sizeMB}MB`);
                
                console.log('\n✅ [Success] Video 30s đã sẵn sàng!');
                console.log(`💡 [Next] Có thể xem video tại: ${result.result.finalVideo.publicPath}`);
            }
            
        } else {
            console.log('❌ [Test] Error:', result.message);
            if (result.error) {
                console.log('❌ [Test] Error details:', result.error);
            }
        }
        
    } catch (error) {
        console.error('❌ [test30sVideo] Lỗi:', error);
    }
}

test30sVideo();
