const fetch = require('node-fetch');

async function testVeo3UnifiedAPI() {
    try {
        console.log('🚀 [Test] Bắt đầu test Veo3 Unified API...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Test 1: Split video
        console.log('📊 [Test 1] Test split video...');
        const splitResponse = await fetch(`${serverUrl}/api/split-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                maxSegments: 5
            })
        });
        
        const splitResult = await splitResponse.json();
        console.log('📊 [Test 1] Split result:', splitResult.success ? '✅ Success' : '❌ Failed');
        
        if (splitResult.success) {
            console.log(`📊 [Test 1] Đã tạo ${splitResult.result.segments.length} segments`);
        }
        
        // Test 2: Simple workflow
        console.log('🎬 [Test 2] Test simple workflow...');
        const simpleResponse = await fetch(`${serverUrl}/api/veo3-simple-workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                startSecond: 0,
                duration: 8
            })
        });
        
        const simpleResult = await simpleResponse.json();
        console.log('🎬 [Test 2] Simple workflow result:', simpleResult.success ? '✅ Success' : '❌ Failed');
        
        if (simpleResult.success) {
            console.log(`🎬 [Test 2] Đã tạo JSON với ${simpleResult.result.veo3JSON.length} segments`);
        }
        
        console.log('🎉 [Test] Hoàn thành test Veo3 Unified API!');
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Bắt đầu test Veo3 Unified API...');
testVeo3UnifiedAPI();
