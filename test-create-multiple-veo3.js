const fetch = require('node-fetch');
const fs = require('fs');

async function createMultipleVeo3Videos() {
    try {
        console.log('🎬 [Test] Tạo nhiều video Veo3 từ các prompt khác nhau...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Đọc kết quả có sẵn
        console.log('📖 [Step 1] Đọc kết quả phân tích...');
        const resultPath = './temp/veo3-simple/veo3-simple-result.json';
        const resultData = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
        
        console.log(`📖 [Step 1] Đã đọc ${resultData.veo3JSON.length} segments`);
        
        // Tạo danh sách prompts tốt
        console.log('🔍 [Step 2] Tìm các prompt tốt...');
        const goodPrompts = [];
        
        for (let i = 0; i < resultData.veo3JSON.length; i++) {
            const segment = resultData.veo3JSON[i];
            if (segment.action && 
                !segment.action.includes('Professional technology scene') &&
                !segment.action.includes('Create a professional video') &&
                segment.action.length > 50) {
                goodPrompts.push({
                    index: i,
                    prompt: segment.action,
                    timeStart: segment.timeStart,
                    timeEnd: segment.timeEnd
                });
                console.log(`🔍 [Step 2] Prompt ${i + 1}: ${segment.action.substring(0, 80)}...`);
            }
        }
        
        console.log(`🔍 [Step 2] Tìm thấy ${goodPrompts.length} prompts tốt`);
        
        // Tạo video cho mỗi prompt
        const videoResults = [];
        
        for (let i = 0; i < Math.min(goodPrompts.length, 3); i++) { // Chỉ tạo 3 video đầu
            const promptData = goodPrompts[i];
            console.log(`🎬 [Step 3] Tạo video ${i + 1}/${Math.min(goodPrompts.length, 3)}...`);
            console.log(`🎬 [Step 3] Prompt: ${promptData.prompt.substring(0, 100)}...`);
            
            const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: promptData.prompt,
                    prompt: promptData.prompt
                })
            });
            
            const veo3Result = await veo3Response.json();
            console.log(`🎬 [Step 3] Video ${i + 1} result:`, veo3Result.success ? '✅ Success' : '❌ Failed');
            
            if (veo3Result.success) {
                videoResults.push({
                    index: i + 1,
                    operationName: veo3Result.operationName,
                    prompt: promptData.prompt,
                    timeRange: `${promptData.timeStart}s-${promptData.timeEnd}s`
                });
                console.log(`🎬 [Step 3] Video ${i + 1} Operation: ${veo3Result.operationName}`);
            } else {
                console.log(`❌ [Step 3] Video ${i + 1} thất bại: ${veo3Result.message}`);
            }
            
            // Chờ 2 giây giữa các request
            if (i < Math.min(goodPrompts.length, 3) - 1) {
                console.log('⏳ [Step 3] Chờ 2 giây...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Tóm tắt kết quả
        console.log('📊 [Step 4] Tóm tắt kết quả:');
        console.log(`📊 [Step 4] - Tổng prompts: ${goodPrompts.length}`);
        console.log(`📊 [Step 4] - Video đã tạo: ${videoResults.length}`);
        
        for (const video of videoResults) {
            console.log(`📊 [Step 4] - Video ${video.index}: ${video.operationName} (${video.timeRange})`);
        }
        
        // Lưu kết quả
        const resultsPath = './temp/veo3-multiple-results.json';
        fs.writeFileSync(resultsPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            totalPrompts: goodPrompts.length,
            videosCreated: videoResults.length,
            videos: videoResults
        }, null, 2));
        
        console.log(`📊 [Step 4] Đã lưu kết quả vào: ${resultsPath}`);
        console.log('🎉 [Test] Hoàn thành tạo nhiều video Veo3!');
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Tạo nhiều video Veo3...');
createMultipleVeo3Videos();
