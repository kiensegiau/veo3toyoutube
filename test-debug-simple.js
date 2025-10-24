const fetch = require('node-fetch');

async function testDebugSimple() {
    try {
        console.log('🔍 [testDebugSimple] Test debug simple workflow...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Test phân tích video trước
        console.log('\n🔍 [Step 1] Test phân tích video...');
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
            console.log('🔍 [Step 1] Detailed analysis length:', analyzeResult.detailedAnalysis.length);
            
            // Tìm prompt tốt nhất
            let bestPrompt = null;
            console.log('🔍 [Step 1] Debug - Tất cả prompts có sẵn:');
            for (let i = 0; i < analyzeResult.detailedAnalysis.length; i++) {
                const analysis = analyzeResult.detailedAnalysis[i];
                if (analysis.analysis && analysis.analysis.veo3_prompt) {
                    console.log(`🔍 [Step 1] Giây ${analysis.second}: ${analysis.analysis.veo3_prompt.substring(0, 100)}...`);
                    
                    if (!bestPrompt && 
                        !analysis.analysis.veo3_prompt.includes('Create a professional video scene') &&
                        !analysis.analysis.veo3_prompt.includes('technology and AI concepts') &&
                        analysis.analysis.veo3_prompt.length > 50) {
                        bestPrompt = analysis.analysis.veo3_prompt;
                        console.log(`✅ [Step 1] Tìm thấy prompt tốt từ giây ${analysis.second}`);
                    }
                }
            }
            
            if (bestPrompt) {
                console.log(`🎬 [Step 1] Prompt tốt nhất: ${bestPrompt.substring(0, 100)}...`);
            } else {
                console.log(`⚠️ [Step 1] Không tìm thấy prompt tốt`);
            }
        }
        
    } catch (error) {
        console.error('\n❌ [EXCEPTION] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Bắt đầu debug simple workflow...');
testDebugSimple();
