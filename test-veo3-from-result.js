const fetch = require('node-fetch');
const fs = require('fs');

async function testVeo3FromExistingResult() {
    try {
        console.log('🚀 [Test] Sử dụng kết quả có sẵn để tạo video Veo3...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Đọc kết quả có sẵn
        console.log('📖 [Step 1] Đọc kết quả có sẵn...');
        const resultPath = './temp/veo3-simple/veo3-simple-result.json';
        
        if (!fs.existsSync(resultPath)) {
            throw new Error('Không tìm thấy file kết quả. Hãy chạy simple workflow trước.');
        }
        
        const resultData = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
        console.log(`📖 [Step 1] Đã đọc kết quả với ${resultData.veo3JSON.length} segments`);
        
        // Tìm prompt tốt nhất
        console.log('🔍 [Step 2] Tìm prompt tốt nhất từ JSON...');
        let bestPrompt = null;
        
        for (const segment of resultData.veo3JSON) {
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
            bestPrompt = resultData.veo3JSON[0]?.action || 'Professional video scene with clean composition';
            console.log(`⚠️ [Step 2] Sử dụng prompt fallback: ${bestPrompt.substring(0, 100)}...`);
        }
        
        // Tạo video Veo3
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
        
        // Tóm tắt kết quả
        console.log('📊 [Step 4] Tóm tắt kết quả:');
        console.log(`📊 [Step 4] - Video gốc: test.mp4`);
        console.log(`📊 [Step 4] - JSON segments: ${resultData.veo3JSON.length}`);
        console.log(`📊 [Step 4] - Prompt được sử dụng: ${bestPrompt.substring(0, 100)}...`);
        console.log(`📊 [Step 4] - Video Veo3: ${veo3Result.success ? '✅ Thành công' : '❌ Thất bại'}`);
        
        if (veo3Result.success) {
            console.log(`📊 [Step 4] - Operation ID: ${veo3Result.operationName}`);
            console.log(`📊 [Step 4] - Status: ${veo3Result.videoStatus}`);
        }
        
        console.log('🎉 [Test] Hoàn thành test Veo3 từ kết quả có sẵn!');
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Bắt đầu test Veo3 từ kết quả có sẵn...');
testVeo3FromExistingResult();
