const fetch = require('node-fetch');

async function testFullVideo() {
    try {
        console.log('🎬 [testFullVideo] Test tạo đủ cảnh cho video 23 phút');
        
        const videoPath = './test.mp4';
        const serverUrl = 'http://localhost:8888';
        
        // Test với 8 segments trước để xem workflow
        console.log('\n🎬 [Test] Tạo 8 segments (64 giây) trước...');
        const hybridResponse = await fetch(`${serverUrl}/api/veo3-hybrid-workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: videoPath,
                options: {
                    frameInterval: 8, // Mỗi 8 giây 1 frame
                    outputFilename: `veo3_full_test_${Date.now()}.mp4`
                }
            })
        });
        
        const hybridResult = await hybridResponse.json();
        console.log('🎬 [Test] Hybrid workflow result:', hybridResult.success ? '✅ Success' : '❌ Failed');
        
        if (hybridResult.success) {
            console.log('🎬 [Test] Workflow completed successfully');
            console.log('🎬 [Test] Next steps:', hybridResult.nextSteps);
            
            // Hiển thị thông tin chi tiết
            if (hybridResult.result) {
                const workflow = hybridResult.result;
                console.log('\n📊 [Details] Workflow details:');
                console.log(`📊 Video info: ${workflow.videoInfo.duration}s, ${workflow.videoInfo.width}x${workflow.videoInfo.height}`);
                console.log(`📊 Frames extracted: ${workflow.frames.length}`);
                console.log(`📊 Transcript length: ${workflow.transcript.length} characters`);
                console.log(`📊 Veo3 videos: ${workflow.veo3Videos.length}`);
                
                if (workflow.veo3Videos.length > 0) {
                    console.log('\n🎬 [Veo3 Videos] Operation names:');
                    workflow.veo3Videos.forEach((video, index) => {
                        console.log(`🎬 Video ${index + 1}: ${video.operationName} - "${video.description}"`);
                    });
                }
            }
        } else {
            console.log('❌ [Test] Error:', hybridResult.message);
        }
        
    } catch (error) {
        console.error('❌ [testFullVideo] Lỗi:', error);
    }
}

testFullVideo();
