const fetch = require('node-fetch');

async function testVeo3CompleteWorkflow() {
    try {
        console.log('🚀 [Test] Bắt đầu test Veo3 Complete Workflow...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Step 1: Simple workflow để lấy JSON format
        console.log('🎬 [Step 1] Tạo JSON format từ video test.mp4...');
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
        console.log('🎬 [Step 1] Simple workflow result:', simpleResult.success ? '✅ Success' : '❌ Failed');
        
        if (!simpleResult.success) {
            throw new Error(`Simple workflow failed: ${simpleResult.message}`);
        }
        
        console.log(`🎬 [Step 1] Đã tạo JSON với ${simpleResult.result.veo3JSON.length} segments`);
        
        // Step 2: Lấy prompt tốt nhất từ JSON
        console.log('🔍 [Step 2] Tìm prompt tốt nhất từ JSON...');
        let bestPrompt = null;
        
        for (const segment of simpleResult.result.veo3JSON) {
            if (segment.action && 
                !segment.action.includes('Professional technology scene') &&
                !segment.action.includes('Create a professional video') &&
                segment.action.length > 50) {
                bestPrompt = segment.action;
                console.log(`🔍 [Step 2] Tìm thấy prompt tốt: ${bestPrompt.substring(0, 100)}...`);
                break;
            }
        }
        
        if (!bestPrompt) {
            // Fallback to first action
            bestPrompt = simpleResult.result.veo3JSON[0]?.action || 'Professional video scene with clean composition';
            console.log(`⚠️ [Step 2] Sử dụng prompt fallback: ${bestPrompt.substring(0, 100)}...`);
        }
        
        // Step 3: Tạo video Veo3 với prompt
        console.log('🎬 [Step 3] Tạo video Veo3 với prompt...');
        console.log(`🎬 [Step 3] Prompt: ${bestPrompt}`);
        
        const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: bestPrompt,
                prompt: bestPrompt
            })
        });
        
        const veo3Result = await veo3Response.json();
        console.log('🎬 [Step 3] Veo3 result:', veo3Result.success ? '✅ Success' : '❌ Failed');
        
        if (veo3Result.success) {
            console.log(`🎬 [Step 3] Video Veo3 đã được tạo: ${veo3Result.operationName}`);
            console.log(`🎬 [Step 3] Status: ${veo3Result.videoStatus}`);
            
            if (veo3Result.videoUrl) {
                console.log(`🎬 [Step 3] Video URL: ${veo3Result.videoUrl}`);
            }
        } else {
            console.log(`❌ [Step 3] Tạo video Veo3 thất bại: ${veo3Result.message}`);
        }
        
        // Step 4: Tóm tắt kết quả
        console.log('📊 [Step 4] Tóm tắt kết quả:');
        console.log(`📊 [Step 4] - Video gốc: test.mp4`);
        console.log(`📊 [Step 4] - JSON segments: ${simpleResult.result.veo3JSON.length}`);
        console.log(`📊 [Step 4] - Prompt được sử dụng: ${bestPrompt.substring(0, 100)}...`);
        console.log(`📊 [Step 4] - Video Veo3: ${veo3Result.success ? '✅ Thành công' : '❌ Thất bại'}`);
        
        if (veo3Result.success) {
            console.log(`📊 [Step 4] - Operation ID: ${veo3Result.operationName}`);
            console.log(`📊 [Step 4] - Status: ${veo3Result.videoStatus}`);
        }
        
        console.log('🎉 [Test] Hoàn thành test Veo3 Complete Workflow!');
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Bắt đầu test Veo3 Complete Workflow...');
testVeo3CompleteWorkflow();
