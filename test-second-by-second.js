const fetch = require('node-fetch');

async function testSecondBySecond() {
    try {
        console.log('🔍 [testSecondBySecond] Test phân tích chi tiết từng giây');
        
        const videoPath = './test.mp4';
        const serverUrl = 'http://localhost:8888';
        
        // Test phân tích 8 giây đầu (từ giây 0)
        console.log('\n🔍 [Test] Phân tích 8 giây đầu (0-8s)...');
        const response = await fetch(`${serverUrl}/api/analyze-second-by-second`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: videoPath,
                startSecond: 0,
                duration: 8
            })
        });
        
        const result = await response.json();
        console.log('🔍 [Test] Second-by-second analysis result:', result.success ? '✅ Success' : '❌ Failed');
        
        if (result.success) {
            console.log(`🔍 [Test] Đã phân tích ${result.detailedAnalysis.length} giây`);
            console.log(`🔍 [Test] Video info: ${result.videoInfo.duration}s, ${result.videoInfo.width}x${result.videoInfo.height}`);
            console.log(`🔍 [Test] Frames extracted: ${result.frames.length}`);
            console.log(`🔍 [Test] Transcript length: ${result.transcript.length} characters`);
            
            // Hiển thị chi tiết từng giây
            console.log('\n📊 [Details] Chi tiết từng giây:');
            result.detailedAnalysis.forEach((item, index) => {
                const analysis = item.analysis;
                console.log(`\n⏰ [Giây ${analysis.second}] ${analysis.description}`);
                console.log(`   🎨 Visual elements: ${analysis.visual_elements.join(', ')}`);
                console.log(`   😊 Mood: ${analysis.mood}`);
                console.log(`   📹 Camera: ${analysis.camera_movement}`);
                console.log(`   💡 Lighting: ${analysis.lighting}`);
                console.log(`   🎨 Colors: ${analysis.colors.join(', ')}`);
                console.log(`   📐 Composition: ${analysis.composition}`);
                console.log(`   🔗 Continuity: ${analysis.continuity}`);
                console.log(`   🎬 Veo3 prompt: ${analysis.veo3_prompt.substring(0, 100)}...`);
            });
            
            // Tạo summary
            console.log('\n📋 [Summary] Tổng kết:');
            const moods = result.detailedAnalysis.map(item => item.analysis.mood);
            const cameraMovements = result.detailedAnalysis.map(item => item.analysis.camera_movement);
            const lightings = result.detailedAnalysis.map(item => item.analysis.lighting);
            
            console.log(`📋 Moods: ${[...new Set(moods)].join(', ')}`);
            console.log(`📋 Camera movements: ${[...new Set(cameraMovements)].join(', ')}`);
            console.log(`📋 Lightings: ${[...new Set(lightings)].join(', ')}`);
            
        } else {
            console.log('❌ [Test] Error:', result.message);
        }
        
    } catch (error) {
        console.error('❌ [testSecondBySecond] Lỗi:', error);
    }
}

testSecondBySecond();
