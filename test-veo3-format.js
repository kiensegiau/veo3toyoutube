const fetch = require('node-fetch');

async function testVeo3Format() {
    try {
        console.log('🎬 [testVeo3Format] Test tạo format JSON hoàn chỉnh cho Veo3');
        
        const serverUrl = 'http://localhost:8888';
        
        // Step 1: Phân tích chi tiết 8 giây
        console.log('\n🔍 [Step 1] Phân tích chi tiết 8 giây...');
        const analysisResponse = await fetch(`${serverUrl}/api/analyze-second-by-second`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                startSecond: 0,
                duration: 8
            })
        });
        
        const analysisResult = await analysisResponse.json();
        console.log('🔍 [Step 1] Analysis result:', analysisResult.success ? '✅ Success' : '❌ Failed');
        
        if (!analysisResult.success) {
            console.log('❌ [Step 1] Error:', analysisResult.message);
            return;
        }
        
        // Step 2: Tạo format JSON cho Veo3
        console.log('\n🎬 [Step 2] Tạo format JSON cho Veo3...');
        const formatResponse = await fetch(`${serverUrl}/api/generate-veo3-format`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                detailedAnalysis: analysisResult.detailedAnalysis,
                videoInfo: analysisResult.videoInfo
            })
        });
        
        const formatResult = await formatResponse.json();
        console.log('🎬 [Step 2] Format result:', formatResult.success ? '✅ Success' : '❌ Failed');
        
        if (formatResult.success) {
            console.log('🎬 [Step 2] Format JSON created successfully');
            
            // Hiển thị format JSON
            console.log('\n📋 [Veo3 Format] JSON format hoàn chỉnh:');
            console.log(JSON.stringify(formatResult.veo3Format, null, 2));
            
            // Hiển thị chi tiết từng request
            console.log('\n🎬 [Requests] Chi tiết từng request:');
            formatResult.veo3Format.requests.forEach((request, index) => {
                console.log(`\n🎬 Request ${index + 1}:`);
                console.log(`   📝 Prompt: ${request.textInput.prompt.substring(0, 100)}...`);
                console.log(`   🎲 Seed: ${request.seed}`);
                console.log(`   🆔 SceneId: ${request.metadata.sceneId}`);
                console.log(`   📐 Aspect: ${request.aspectRatio}`);
                console.log(`   🤖 Model: ${request.videoModelKey}`);
            });
            
            // Hiển thị client context
            console.log('\n🔧 [Client Context]');
            console.log(`   🆔 Project ID: ${formatResult.veo3Format.clientContext.projectId}`);
            console.log(`   🛠️ Tool: ${formatResult.veo3Format.clientContext.tool}`);
            console.log(`   💳 Tier: ${formatResult.veo3Format.clientContext.userPaygateTier}`);
            
            console.log('\n✅ [Success] Format JSON hoàn chỉnh cho Veo3 API đã sẵn sàng!');
            console.log('💡 [Next] Có thể sử dụng format này để gọi Veo3 API trực tiếp');
            
        } else {
            console.log('❌ [Step 2] Error:', formatResult.message);
        }
        
    } catch (error) {
        console.error('❌ [testVeo3Format] Lỗi:', error);
    }
}

testVeo3Format();
