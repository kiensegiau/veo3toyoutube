const fetch = require('node-fetch');

async function testVeo3Sequential32sWorkflow() {
    try {
        console.log('🚀 [Test] Test Veo3 Sequential 32s Workflow - Xử lý TUẦN TỰ...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Test sequential 32s workflow
        console.log('🎬 [Step 1] Gọi API sequential 32s workflow...');
        const response = await fetch(`${serverUrl}/api/veo3-sequential-32s-workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                startSecond: 0,
                totalDuration: 32,
                segmentDuration: 8,
                outputDir: './temp/veo3-32s-sequential-test'
            })
        });
        
        const result = await response.json();
        console.log('🎬 [Step 1] Sequential 32s workflow result:', result.success ? '✅ Success' : '❌ Failed');
        
        if (result.success) {
            console.log(`🎬 [Step 1] Workflow 32s TUẦN TỰ hoàn thành!`);
            console.log(`🎬 [Step 1] - Video gốc: ${result.result.originalVideo}`);
            console.log(`🎬 [Step 1] - Tổng thời gian: ${result.result.totalDuration}s`);
            console.log(`🎬 [Step 1] - Chủ đề chung: ${result.result.overallTheme?.mainTheme || 'N/A'}`);
            console.log(`🎬 [Step 1] - Segments tạo: ${result.result.segmentsCreated}`);
            console.log(`🎬 [Step 1] - Segments xử lý: ${result.result.segmentsProcessed}`);
            console.log(`🎬 [Step 1] - Videos tải về: ${result.result.videosDownloaded}`);
            console.log(`🎬 [Step 1] - Video kết quả: ${result.result.finalVideo}`);
            console.log(`🎬 [Step 1] - Output Dir: ${result.result.outputDir}`);
            
            // Kiểm tra file kết quả
            const fs = require('fs');
            const resultPath = `${result.result.outputDir}/veo3-32s-sequential-result.json`;
            if (fs.existsSync(resultPath)) {
                console.log(`📊 [Step 1] File kết quả: ${resultPath}`);
            }
            
            // Kiểm tra video kết quả
            if (fs.existsSync(result.result.finalVideo)) {
                console.log(`🎬 [Step 1] Video kết quả đã tạo: ${result.result.finalVideo}`);
            }
            
            console.log('🎉 [Test] Workflow 32s TUẦN TỰ đã thành công!');
            console.log('🎉 [Test] Video gốc → Phân tích chủ đề → 4 đoạn 8s TUẦN TỰ → Ghép lại → Video kết quả!');
            
        } else {
            console.log(`❌ [Step 1] Workflow thất bại: ${result.message}`);
        }
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Test Veo3 Sequential 32s Workflow...');
testVeo3Sequential32sWorkflow();
