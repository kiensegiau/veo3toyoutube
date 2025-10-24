const fetch = require('node-fetch');

async function testSimple32sWorkflow() {
    try {
        console.log('🚀 [Test] Test Simple 32s Workflow - Debug...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Test chỉ tạo 1 segment trước
        console.log('🎬 [Step 1] Test tạo 1 segment đơn giản...');
        const response = await fetch(`${serverUrl}/api/veo3-complete-workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                startSecond: 0,
                duration: 8,
                frameInterval: 1,
                maxFrames: 4, // Giảm số frames để test nhanh hơn
                outputDir: './temp/test-simple-8s'
            })
        });
        
        const result = await response.json();
        console.log('🎬 [Step 1] Simple workflow result:', result.success ? '✅ Success' : '❌ Failed');
        
        if (result.success) {
            console.log(`🎬 [Step 1] Workflow đơn giản hoàn thành!`);
            console.log(`🎬 [Step 1] - Video gốc: ${result.result.originalVideo}`);
            console.log(`🎬 [Step 1] - Segment: ${result.result.segmentPath}`);
            console.log(`🎬 [Step 1] - Frames: ${result.result.frames.length}`);
            console.log(`🎬 [Step 1] - Veo3 Operation: ${result.result.veo3Operation}`);
            
            console.log('🎉 [Test] Test đơn giản thành công!');
            
        } else {
            console.log(`❌ [Step 1] Workflow thất bại: ${result.message}`);
        }
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Test Simple 32s Workflow...');
testSimple32sWorkflow();
