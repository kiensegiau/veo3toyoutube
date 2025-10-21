const fetch = require('node-fetch');

async function testCompleteWorkflow() {
    console.log('🧪 Testing complete workflow with long text...');
    
    try {
        const response = await fetch('http://localhost:8888/api/create-video-from-youtube', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Test URL
                filename: 'test_long_workflow.mp4'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Complete workflow test successful!');
            console.log(`📁 Final video: ${result.finalVideo?.path || 'N/A'}`);
            console.log(`🔗 Public path: ${result.finalVideo?.publicPath || 'N/A'}`);
            console.log(`📊 Steps completed:`, result.workflow?.steps || 'N/A');
            console.log(`📝 Full result:`, JSON.stringify(result, null, 2));
        } else {
            console.log('❌ Complete workflow test failed!');
            console.log(`Error: ${result.message}`);
            if (result.error) {
                console.log(`Details: ${result.error}`);
            }
        }
    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

testCompleteWorkflow();
