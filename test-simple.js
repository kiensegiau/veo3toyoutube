const fetch = require('node-fetch');

async function testSimple() {
    try {
        console.log('🧪 Testing simple API call...');
        
        const response = await fetch('http://localhost:8888/api/extract-frames', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                count: 8,
                interval: 8
            })
        });
        
        console.log('📊 Response status:', response.status);
        console.log('📊 Response headers:', response.headers.raw());
        
        const text = await response.text();
        console.log('📊 Response text (first 500 chars):', text.substring(0, 500));
        
        if (text.startsWith('<!DOCTYPE')) {
            console.log('❌ Server trả về HTML thay vì JSON - có thể server chưa start đúng');
        } else {
            try {
                const json = JSON.parse(text);
                console.log('✅ JSON response:', json);
            } catch (e) {
                console.log('❌ Không thể parse JSON:', e.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testSimple();
