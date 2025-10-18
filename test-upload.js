const fetch = require('node-fetch');

async function testUpload() {
    try {
        console.log('Testing YouTube upload API...');
        
        const response = await fetch('http://localhost:8888/api/upload-youtube', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoPath: 'public/videos/002257ffa938979e5396b3a745054488.mp4',
                title: 'Test Video Upload',
                description: 'Test upload from API',
                visibility: 'UNLISTED',
                profileName: 'Default'
            })
        });
        
        const result = await response.json();
        console.log('Response:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testUpload();
