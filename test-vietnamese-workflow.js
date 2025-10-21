const fetch = require('node-fetch');

async function testVietnameseWorkflow() {
    console.log('🧪 Testing complete workflow with Vietnamese video...');
    
    try {
        const response = await fetch('http://localhost:8888/api/create-video-from-youtube', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                youtubeUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0', // PSY - GANGNAM STYLE (có phụ đề tiếng Việt)
                filename: 'test_vietnamese_workflow.mp4'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Vietnamese workflow test successful!');
            console.log(`📁 Final video: ${result.finalVideo?.path || 'N/A'}`);
            console.log(`🔗 Public path: ${result.finalVideo?.publicPath || 'N/A'}`);
            console.log(`📊 Steps completed:`, result.workflow?.steps || 'N/A');
            console.log(`📝 Text length: ${result.workflow?.files?.rewritten?.length || 'N/A'} characters`);
        } else {
            console.log('❌ Vietnamese workflow test failed!');
            console.log(`Error: ${result.message}`);
            if (result.error) {
                console.log(`Details: ${result.error}`);
            }
        }
    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

testVietnameseWorkflow();
