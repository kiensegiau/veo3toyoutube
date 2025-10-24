const fetch = require('node-fetch');

async function testStepByStep() {
    try {
        console.log('🔍 [testStepByStep] Test từng bước một cách chi tiết');
        
        const serverUrl = 'http://localhost:8888';
        
        // Step 1: Test lấy thông tin video
        console.log('\n📊 [Step 1] Test lấy thông tin video...');
        const videoInfoResponse = await fetch(`${serverUrl}/api/extract-frames`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                count: 1,
                interval: 1
            })
        });
        
        const videoInfo = await videoInfoResponse.json();
        console.log('📊 [Step 1] Video info result:', videoInfo.success ? '✅ Success' : '❌ Failed');
        if (videoInfo.success) {
            console.log(`📊 [Step 1] Duration: ${videoInfo.videoInfo.duration}s`);
        }
        
        // Step 2: Test tạo video Veo3 đơn giản
        console.log('\n🎬 [Step 2] Test tạo video Veo3 đơn giản...');
        const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: "Professional technology scene with clean composition",
                prompt: "Professional technology scene with clean composition"
            })
        });
        
        const veo3Result = await veo3Response.json();
        console.log('🎬 [Step 2] Veo3 result:', veo3Result.success ? '✅ Success' : '❌ Failed');
        if (veo3Result.success) {
            console.log(`🎬 [Step 2] Operation: ${veo3Result.operationName}`);
        } else {
            console.log('🎬 [Step 2] Error:', veo3Result.message);
        }
        
        // Step 3: Test check status
        if (veo3Result.success) {
            console.log('\n⏳ [Step 3] Test check status...');
            const statusResponse = await fetch(`${serverUrl}/api/check-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operationName: veo3Result.operationName
                })
            });
            
            const statusResult = await statusResponse.json();
            console.log('⏳ [Step 3] Status result:', statusResult.success ? '✅ Success' : '❌ Failed');
            if (statusResult.success) {
                console.log(`⏳ [Step 3] Status: ${statusResult.videoStatus}`);
            } else {
                console.log('⏳ [Step 3] Error:', statusResult.message);
            }
        }
        
        // Step 4: Test merge videos
        console.log('\n🔗 [Step 4] Test merge videos...');
        const mergeResponse = await fetch(`${serverUrl}/api/merge-videos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                duration: 8,
                filename: `test_merge_${Date.now()}.mp4`
            })
        });
        
        const mergeResult = await mergeResponse.json();
        console.log('🔗 [Step 4] Merge result:', mergeResult.success ? '✅ Success' : '❌ Failed');
        if (mergeResult.success) {
            console.log(`🔗 [Step 4] Output: ${mergeResult.output.filename}`);
        } else {
            console.log('🔗 [Step 4] Error:', mergeResult.message);
        }
        
        console.log('\n✅ [COMPLETE] Test hoàn thành!');
        
    } catch (error) {
        console.error('\n❌ [EXCEPTION] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Bắt đầu test từng bước...');
testStepByStep();
