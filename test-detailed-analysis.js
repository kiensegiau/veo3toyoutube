const fetch = require('node-fetch');

async function testDetailedAnalysis() {
    try {
        console.log('🔍 [testDetailedAnalysis] Test phân tích CHI TIẾT từng giây');
        
        const videoPath = './test.mp4';
        const serverUrl = 'http://localhost:8888';
        
        // Test phân tích 3 giây đầu với mô tả chi tiết
        console.log('\n🔍 [Test] Phân tích CHI TIẾT 3 giây đầu (0-3s)...');
        const response = await fetch(`${serverUrl}/api/analyze-second-by-second`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: videoPath,
                startSecond: 0,
                duration: 3 // Chỉ test 3 giây để xem chi tiết
            })
        });
        
        const result = await response.json();
        console.log('🔍 [Test] Detailed analysis result:', result.success ? '✅ Success' : '❌ Failed');
        
        if (result.success) {
            console.log(`🔍 [Test] Đã phân tích ${result.detailedAnalysis.length} giây`);
            
            // Hiển thị chi tiết từng giây
            console.log('\n📊 [Details] Chi tiết từng giây:');
            result.detailedAnalysis.forEach((item, index) => {
                const analysis = item.analysis;
                console.log(`\n⏰ [Giây ${analysis.second}] ${analysis.description}`);
                
                // Visual elements
                if (analysis.visual_elements) {
                    console.log(`   🎨 Visual elements:`);
                    analysis.visual_elements.forEach(element => {
                        console.log(`      - ${element}`);
                    });
                }
                
                // Colors
                if (analysis.colors) {
                    console.log(`   🌈 Colors:`);
                    analysis.colors.forEach(color => {
                        console.log(`      - ${color}`);
                    });
                }
                
                // Textures
                if (analysis.textures) {
                    console.log(`   🎭 Textures:`);
                    analysis.textures.forEach(texture => {
                        console.log(`      - ${texture}`);
                    });
                }
                
                // Lighting
                if (analysis.lighting) {
                    console.log(`   💡 Lighting: ${analysis.lighting}`);
                }
                
                // Shadows
                if (analysis.shadows) {
                    console.log(`   🌑 Shadows: ${analysis.shadows}`);
                }
                
                // Composition
                if (analysis.composition) {
                    console.log(`   📐 Composition: ${analysis.composition}`);
                }
                
                // Perspective
                if (analysis.perspective) {
                    console.log(`   👁️ Perspective: ${analysis.perspective}`);
                }
                
                // Depth
                if (analysis.depth) {
                    console.log(`   📏 Depth: ${analysis.depth}`);
                }
                
                // Camera
                if (analysis.camera_angle) {
                    console.log(`   📹 Camera angle: ${analysis.camera_angle}`);
                }
                if (analysis.camera_movement) {
                    console.log(`   🎬 Camera movement: ${analysis.camera_movement}`);
                }
                if (analysis.focus) {
                    console.log(`   🎯 Focus: ${analysis.focus}`);
                }
                
                // Mood & Emotion
                if (analysis.mood) {
                    console.log(`   😊 Mood: ${analysis.mood}`);
                }
                if (analysis.emotion) {
                    console.log(`   💭 Emotion: ${analysis.emotion}`);
                }
                if (analysis.atmosphere) {
                    console.log(`   🌫️ Atmosphere: ${analysis.atmosphere}`);
                }
                
                // Veo3 prompt
                if (analysis.veo3_prompt) {
                    console.log(`   🎬 Veo3 prompt: ${analysis.veo3_prompt.substring(0, 200)}...`);
                }
                
                // Continuity
                if (analysis.continuity) {
                    console.log(`   🔗 Continuity: ${analysis.continuity}`);
                }
            });
            
        } else {
            console.log('❌ [Test] Error:', result.message);
        }
        
    } catch (error) {
        console.error('❌ [testDetailedAnalysis] Lỗi:', error);
    }
}

testDetailedAnalysis();
