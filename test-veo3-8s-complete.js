const fetch = require('node-fetch');
const fs = require('fs');

async function createVeo3From8sAnalysis() {
    try {
        console.log('🎬 [Test] Tạo video Veo3 8s từ phân tích chi tiết...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Đọc kết quả phân tích có sẵn
        console.log('📖 [Step 1] Đọc kết quả phân tích 8s...');
        const resultPath = './temp/veo3-simple/veo3-simple-result.json';
        const resultData = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
        
        console.log(`📖 [Step 1] Đã đọc ${resultData.veo3JSON.length} segments từ video 8s`);
        
        // Tạo format duy nhất cho toàn bộ 8s
        console.log('🎬 [Step 2] Tạo format duy nhất cho 8s...');
        let completeFormat = `Tạo video 8 giây mô tả: `;
        
        for (let i = 0; i < resultData.veo3JSON.length; i++) {
            const segment = resultData.veo3JSON[i];
            completeFormat += `Từ ${segment.timeStart}s đến ${segment.timeEnd}s: ${segment.action}. `;
        }
        
        // Thêm thông tin camera và visual
        const firstSegment = resultData.veo3JSON[0];
        completeFormat += `Camera style: ${firstSegment.cameraStyle}. `;
        completeFormat += `Visual details: ${firstSegment.visualDetails}. `;
        completeFormat += `Sound focus: ${firstSegment.soundFocus}.`;
        
        console.log('🎬 [Step 2] Format hoàn chỉnh:');
        console.log(`🎬 [Step 2] ${completeFormat}`);
        
        // Tạo video Veo3 với format hoàn chỉnh
        console.log('🎬 [Step 3] Tạo video Veo3 8s...');
        const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: completeFormat,
                prompt: completeFormat
            })
        });
        
        const veo3Result = await veo3Response.json();
        console.log('🎬 [Step 3] Veo3 result:', veo3Result.success ? '✅ Success' : '❌ Failed');
        
        if (veo3Result.success) {
            console.log(`🎬 [Step 3] Video Veo3 8s đã được tạo: ${veo3Result.operationName}`);
            console.log(`🎬 [Step 3] Status: ${veo3Result.videoStatus}`);
            
            // Lưu kết quả
            const finalResult = {
                timestamp: new Date().toISOString(),
                originalVideo: 'test.mp4 (8s)',
                analysisSegments: resultData.veo3JSON.length,
                completeFormat: completeFormat,
                veo3Operation: veo3Result.operationName,
                veo3Status: veo3Result.videoStatus
            };
            
            const finalPath = './temp/veo3-8s-final-result.json';
            fs.writeFileSync(finalPath, JSON.stringify(finalResult, null, 2));
            
            console.log(`📊 [Step 3] Đã lưu kết quả vào: ${finalPath}`);
        } else {
            console.log(`❌ [Step 3] Tạo video Veo3 thất bại: ${veo3Result.message}`);
        }
        
        // Tóm tắt
        console.log('📊 [Step 4] Tóm tắt:');
        console.log(`📊 [Step 4] - Video gốc: test.mp4 (8s)`);
        console.log(`📊 [Step 4] - Phân tích: ${resultData.veo3JSON.length} segments`);
        console.log(`📊 [Step 4] - Format: ${completeFormat.substring(0, 100)}...`);
        console.log(`📊 [Step 4] - Video Veo3: ${veo3Result.success ? '✅ Thành công' : '❌ Thất bại'}`);
        
        if (veo3Result.success) {
            console.log(`📊 [Step 4] - Operation ID: ${veo3Result.operationName}`);
        }
        
        console.log('🎉 [Test] Hoàn thành tạo video Veo3 8s!');
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Tạo video Veo3 8s từ phân tích chi tiết...');
createVeo3From8sAnalysis();
