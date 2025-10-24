const fetch = require('node-fetch');

async function testDebugAnalysis() {
    try {
        console.log('🔍 [testDebugAnalysis] Test phân tích video gốc chi tiết');
        
        const serverUrl = 'http://localhost:8888';
        
        // Step 1: Test phân tích video gốc
        console.log('\n🔍 [Step 1] Phân tích video gốc...');
        const analyzeResponse = await fetch(`${serverUrl}/api/analyze-second-by-second`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                startSecond: 0,
                duration: 8
            })
        });
        
        const analyzeResult = await analyzeResponse.json();
        console.log('🔍 [Step 1] Analyze result:', analyzeResult.success ? '✅ Success' : '❌ Failed');
        
        if (analyzeResult.success) {
            console.log('🔍 [Step 1] Detailed analysis:');
            console.log(JSON.stringify(analyzeResult.detailedAnalysis, null, 2));
        } else {
            console.log('❌ [Step 1] Error:', analyzeResult.message);
        }
        
        // Step 2: Test tạo timeline
        if (analyzeResult.success) {
            console.log('\n🎬 [Step 2] Tạo timeline...');
            const timelineResponse = await fetch(`${serverUrl}/api/generate-veo3-timeline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    detailedAnalysis: analyzeResult.detailedAnalysis,
                    videoInfo: analyzeResult.videoInfo
                })
            });
            
            const timelineResult = await timelineResponse.json();
            console.log('🎬 [Step 2] Timeline result:', timelineResult.success ? '✅ Success' : '❌ Failed');
            
            if (timelineResult.success) {
                console.log('🎬 [Step 2] Timeline:');
                console.log(JSON.stringify(timelineResult.timeline, null, 2));
                
                console.log('\n📝 [Step 2] Prompt sẽ dùng cho Veo3:');
                console.log(timelineResult.timeline[0].action);
            } else {
                console.log('❌ [Step 2] Error:', timelineResult.message);
            }
        }
        
    } catch (error) {
        console.error('❌ [testDebugAnalysis] Lỗi:', error);
    }
}

console.log('🚀 [START] Bắt đầu debug phân tích video...');
testDebugAnalysis();
