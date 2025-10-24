const fetch = require('node-fetch');

async function test8sSimple() {
    try {
        console.log('🎬 [test8sSimple] Test tạo video 8 giây đơn giản');
        
        const serverUrl = 'http://localhost:8888';
        
        // Test tạo video 8 giây (1 segment)
        console.log('\n🎬 [Step 1] Tạo video 8 giây từ video gốc...');
        const response = await fetch(`${serverUrl}/api/create-veo3-complete-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                duration: 8, // Chỉ 8 giây
                segmentDuration: 8, // 1 segment duy nhất
                outputFilename: `veo3_8s_${Date.now()}.mp4`
            })
        });
        
        console.log('🎬 [Step 2] Đang chờ response...');
        const result = await response.json();
        console.log('🎬 [Step 3] Response received:', result.success ? '✅ Success' : '❌ Failed');
        
        if (result.success) {
            console.log('\n🎉 [SUCCESS] Video 8s tạo thành công!');
            
            // Hiển thị thông tin chi tiết
            console.log('\n📊 [DETAILS] Thông tin video:');
            console.log(`📊 Original video: ${result.result.originalVideo}`);
            console.log(`📊 Duration: ${result.result.duration}s`);
            console.log(`📊 Segments: ${result.result.segments}`);
            console.log(`📊 Veo3 videos: ${result.result.veo3Videos}`);
            
            if (result.result.finalVideo) {
                console.log('\n🎬 [FINAL VIDEO] Thông tin video cuối:');
                console.log(`🎬 Filename: ${result.result.finalVideo.filename}`);
                console.log(`🎬 Path: ${result.result.finalVideo.path}`);
                console.log(`🎬 Public path: ${result.result.finalVideo.publicPath}`);
                console.log(`🎬 Size: ${result.result.finalVideo.sizeMB}MB`);
                
                console.log('\n✅ [COMPLETE] Video 8s đã sẵn sàng!');
                console.log(`💡 [VIEW] Có thể xem video tại: ${result.result.finalVideo.publicPath}`);
            }
            
        } else {
            console.log('\n❌ [ERROR] Tạo video thất bại!');
            console.log('❌ Message:', result.message);
            if (result.error) {
                console.log('❌ Error details:', result.error);
            }
        }
        
    } catch (error) {
        console.error('\n❌ [EXCEPTION] Lỗi:', error.message);
        console.error('❌ Stack:', error.stack);
    }
}

console.log('🚀 [START] Bắt đầu test 8s video...');
test8sSimple();
