const fetch = require('node-fetch');

async function testVeo3CompleteWorkflow() {
    try {
        console.log('🚀 [Test] Test Veo3 Complete Workflow - Từ đầu đến cuối...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Test complete workflow
        console.log('🎬 [Step 1] Gọi API complete workflow...');
        const response = await fetch(`${serverUrl}/api/veo3-complete-workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                startSecond: 0,
                duration: 8,
                frameInterval: 1,
                maxFrames: 8,
                outputDir: './temp/veo3-complete-test'
            })
        });
        
        const result = await response.json();
        console.log('🎬 [Step 1] Complete workflow result:', result.success ? '✅ Success' : '❌ Failed');
        
        if (result.success) {
            console.log(`🎬 [Step 1] Workflow hoàn thành!`);
            console.log(`🎬 [Step 1] - Video gốc: ${result.result.originalVideo}`);
            console.log(`🎬 [Step 1] - Segment: ${result.result.segmentPath}`);
            console.log(`🎬 [Step 1] - Frames: ${result.result.frames.length}`);
            console.log(`🎬 [Step 1] - Analysis: ${result.result.detailedAnalysis.length} frames`);
            console.log(`🎬 [Step 1] - Timeline: ${result.result.timeline.length} segments`);
            console.log(`🎬 [Step 1] - Veo3 Operation: ${result.result.veo3Operation}`);
            console.log(`🎬 [Step 1] - Veo3 Status: ${result.result.veo3Status}`);
            console.log(`🎬 [Step 1] - Output Dir: ${result.result.outputDir}`);
            
            // Kiểm tra file kết quả
            const fs = require('fs');
            const resultPath = `${result.result.outputDir}/veo3-complete-result.json`;
            if (fs.existsSync(resultPath)) {
                console.log(`📊 [Step 1] File kết quả: ${resultPath}`);
            }
            
            console.log('🎉 [Test] Workflow hoàn chỉnh đã thành công!');
            console.log('🎉 [Test] Từ video gốc → Phân tích → ChatGPT → Veo3 → Kết quả!');
            
        } else {
            console.log(`❌ [Step 1] Workflow thất bại: ${result.message}`);
        }
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Test Veo3 Complete Workflow...');
testVeo3CompleteWorkflow();
