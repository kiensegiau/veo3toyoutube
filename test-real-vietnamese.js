const fetch = require('node-fetch');

async function testRealVietnameseWorkflow() {
    console.log('🧪 Testing complete workflow with REAL Vietnamese video...');
    
    try {
        const response = await fetch('http://localhost:8888/api/create-video-from-youtube', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                youtubeUrl: 'https://www.youtube.com/watch?v=8jPQjjsBbIc', // Video tiếng Việt thực sự
                filename: 'test_real_vietnamese_workflow.mp4'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Real Vietnamese workflow test successful!');
            console.log(`📁 Final video: ${result.finalVideo?.path || 'N/A'}`);
            console.log(`🔗 Public path: ${result.finalVideo?.publicPath || 'N/A'}`);
            console.log(`📊 Steps completed:`, result.workflow?.steps || 'N/A');
            console.log(`📝 Text length: ${result.workflow?.files?.rewritten?.length || 'N/A'} characters`);
            console.log(`📝 Text preview: ${result.workflow?.files?.rewritten?.substring(0, 200) || 'N/A'}...`);
        } else {
            console.log('❌ Real Vietnamese workflow test failed!');
            console.log(`Error: ${result.message}`);
            if (result.error) {
                console.log(`Details: ${result.error}`);
            }
        }
    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

testRealVietnameseWorkflow();
