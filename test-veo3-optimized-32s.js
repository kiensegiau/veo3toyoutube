const fetch = require('node-fetch');

async function testVeo3Optimized32sWorkflow() {
    try {
        console.log('🚀 [Test] Test Veo3 Optimized 32s Workflow - TỐI ƯU THỜI GIAN...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Test optimized 32s workflow
        console.log('🎬 [Step 1] Gọi API optimized 32s workflow...');
        const response = await fetch(`${serverUrl}/api/veo3-optimized-32s-workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                startSecond: 0,
                totalDuration: 32,
                segmentDuration: 8,
                outputDir: './temp/veo3-32s-optimized-test'
            })
        });
        
        const result = await response.json();
        console.log('🎬 [Step 1] Optimized 32s workflow result:', result.success ? '✅ Success' : '❌ Failed');
        
        if (result.success) {
            console.log(`🎬 [Step 1] Workflow 32s TỐI ƯU hoàn thành!`);
            console.log(`🎬 [Step 1] - Video gốc: ${result.result.originalVideo}`);
            console.log(`🎬 [Step 1] - Tổng thời gian: ${result.result.totalDuration}s`);
            console.log(`🎬 [Step 1] - Chủ đề chung: ${result.result.overallTheme?.mainTheme || 'N/A'}`);
            console.log(`🎬 [Step 1] - Segments tạo: ${result.result.segmentsCreated}`);
            console.log(`🎬 [Step 1] - Veo3 operations gửi: ${result.result.veo3OperationsSent}`);
            console.log(`🎬 [Step 1] - Videos tải về: ${result.result.videosDownloaded}`);
            console.log(`🎬 [Step 1] - Video kết quả: ${result.result.finalVideo}`);
            console.log(`🎬 [Step 1] - Tối ưu: ${result.result.optimization}`);
            console.log(`🎬 [Step 1] - Output Dir: ${result.result.outputDir}`);
            
            // Kiểm tra file kết quả
            const fs = require('fs');
            const resultPath = `${result.result.outputDir}/veo3-32s-optimized-result.json`;
            if (fs.existsSync(resultPath)) {
                console.log(`📊 [Step 1] File kết quả: ${resultPath}`);
            }
            
            // Kiểm tra video kết quả
            if (fs.existsSync(result.result.finalVideo)) {
                console.log(`🎬 [Step 1] Video kết quả đã tạo: ${result.result.finalVideo}`);
            }
            
            console.log('🎉 [Test] Workflow 32s TỐI ƯU đã thành công!');
            console.log('🎉 [Test] Video gốc → Phân tích chủ đề → Gửi tất cả Veo3 → Chạy ngầm → Ghép lại → Video kết quả!');
            
        } else {
            console.log(`❌ [Step 1] Workflow thất bại: ${result.message}`);
        }
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Test Veo3 Optimized 32s Workflow...');
testVeo3Optimized32sWorkflow();
