const fetch = require('node-fetch');

async function testVeo3Correct() {
    try {
        console.log('🚀 [testVeo3Correct] Test Veo3 với logic chia video đúng');
        
        const videoPath = './test.mp4';
        const serverUrl = 'http://localhost:8888';
        
        // Test với video 23 phút
        console.log('\n📊 [Test] Video info:');
        const extractResponse = await fetch(`${serverUrl}/api/extract-frames`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: videoPath,
                count: 8, // Test với 8 frames trước
                interval: 8
            })
        });
        
        const extractResult = await extractResponse.json();
        if (extractResult.success) {
            const duration = extractResult.videoInfo.duration;
            console.log(`📊 Video duration: ${duration}s (${(duration/60).toFixed(1)} phút)`);
            console.log(`📊 Resolution: ${extractResult.videoInfo.width}x${extractResult.videoInfo.height}`);
            
            // Tính toán số segments cần thiết
            const segmentsNeeded = Math.ceil(duration / 8); // Mỗi 8 giây 1 segment
            const maxSegments = 64; // Tối đa 64 segments (8 phút)
            const finalSegments = Math.min(segmentsNeeded, maxSegments);
            
            console.log(`📊 Segments needed: ${segmentsNeeded}`);
            console.log(`📊 Final segments: ${finalSegments} (limited to ${maxSegments})`);
            console.log(`📊 Total video time: ${finalSegments * 8}s (${(finalSegments * 8 / 60).toFixed(1)} phút)`);
            
            if (segmentsNeeded > maxSegments) {
                console.log(`⚠️ Video quá dài! Sẽ chỉ tạo ${maxSegments} segments (${maxSegments * 8 / 60} phút)`);
                console.log(`💡 Để tạo toàn bộ video, cần chia thành nhiều batch hoặc tăng maxSegments`);
            }
        }
        
        // Test Hybrid workflow với logic mới
        console.log('\n🚀 [Test] Hybrid workflow với logic mới...');
        const hybridResponse = await fetch(`${serverUrl}/api/veo3-hybrid-workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: videoPath,
                options: {
                    frameInterval: 8, // Mỗi 8 giây 1 frame
                    outputFilename: `veo3_hybrid_correct_${Date.now()}.mp4`
                }
            })
        });
        
        const hybridResult = await hybridResponse.json();
        console.log('🚀 [Test] Hybrid workflow result:', hybridResult.success ? '✅ Success' : '❌ Failed');
        
        if (hybridResult.success) {
            console.log('🚀 [Test] Workflow completed successfully');
            console.log('🚀 [Test] Next steps:', hybridResult.nextSteps);
        } else {
            console.log('❌ [Test] Error:', hybridResult.message);
        }
        
    } catch (error) {
        console.error('❌ [testVeo3Correct] Lỗi:', error);
    }
}

testVeo3Correct();
