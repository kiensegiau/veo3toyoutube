const fetch = require('node-fetch');

async function testSimple8s() {
    try {
        console.log('🎬 [testSimple8s] Test tạo video 8s đơn giản');
        
        const serverUrl = 'http://localhost:8888';
        
        // Test tạo video 8s đơn giản
        console.log('\n🎬 [Test] Tạo video 8s đơn giản...');
        console.log('🔍 [Test] Gọi API: /api/create-simple-8s-video');
        console.log('🔍 [Test] URL đầy đủ:', `${serverUrl}/api/create-simple-8s-video`);
        const response = await fetch(`${serverUrl}/api/create-simple-8s-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                outputFilename: `simple_8s_${Date.now()}.mp4`
            })
        });
        
        console.log('🎬 [Test] Đang chờ response...');
        const result = await response.json();
        console.log('🎬 [Test] Result:', result.success ? '✅ Success' : '❌ Failed');
        
        if (result.success) {
            console.log('\n🎉 [SUCCESS] Video 8s tạo thành công!');
            
            // Hiển thị thông tin chi tiết
            console.log('\n📊 [DETAILS] Thông tin video:');
            console.log(`📊 Original video: ${result.result.originalVideo}`);
            console.log(`📊 Duration: ${result.result.duration}s`);
            console.log(`📊 Veo3 operation: ${result.result.veo3Operation}`);
            console.log(`📊 Video URL: ${result.result.videoUrl}`);
            console.log(`📊 Downloaded file: ${result.result.downloadedFile}`);
            console.log(`📊 Output path: ${result.result.outputPath}`);
            
            console.log('\n✅ [COMPLETE] Video 8s đã sẵn sàng!');
            
        } else {
            console.log('\n❌ [ERROR] Tạo video thất bại!');
            console.log('❌ Message:', result.message);
            if (result.error) {
                console.log('❌ Error details:', result.error);
            }
        }
        
    } catch (error) {
        console.error('\n❌ [EXCEPTION] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Bắt đầu test video 8s đơn giản...');
testSimple8s();
