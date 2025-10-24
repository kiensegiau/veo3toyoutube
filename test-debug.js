const fetch = require('node-fetch');

async function testDebug() {
    try {
        console.log('🔍 [Debug] Testing analyze video API...');
        
        const response = await fetch('http://localhost:8888/api/analyze-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4'
            })
        });
        
        const result = await response.json();
        console.log('🔍 [Debug] Analyze result:', result.success ? '✅ Success' : '❌ Failed');
        
        if (result.success) {
            console.log('🔍 [Debug] Analysis structure:');
            console.log('- Has analysis:', !!result.analysis);
            console.log('- Has scenes:', !!result.analysis?.scenes);
            console.log('- Scenes count:', result.analysis?.scenes?.length || 0);
            console.log('- Raw response length:', result.rawResponse?.length || 0);
            
            if (result.analysis && result.analysis.scenes) {
                console.log('🔍 [Debug] First scene:', JSON.stringify(result.analysis.scenes[0], null, 2));
            } else {
                console.log('🔍 [Debug] Analysis content:', JSON.stringify(result.analysis, null, 2));
            }
        } else {
            console.log('❌ [Debug] Error:', result.message);
        }
        
    } catch (error) {
        console.error('❌ [Debug] Error:', error);
    }
}

testDebug();
