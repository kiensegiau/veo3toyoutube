const fetch = require('node-fetch');

const base = 'http://localhost:8888';

async function createVietnameseTTS(text, filename = null) {
    try {
        console.log('🎵 Creating Vietnamese TTS...');
        console.log('Text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
        console.log('Length:', text.length, 'characters');
        
        const payload = {
            response_type: 'indirect',
            callback_url: 'https://example.com/callback',
            input_text: text,
            voice_code: 'hn_female_ngochuyen_full_48k-fhg',
            audio_type: 'mp3',
            bitrate: 128,
            speed_rate: '1.0'
        };

        // Create job
        const result = await fetch(`${base}/api/tts/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify(payload)
        });

        const data = await result.json();
        if (!data.success) {
            console.error('❌ Failed to create job:', data);
            return;
        }

        console.log('✅ Job created:', data.requestId);
        
        // Wait and poll for completion
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 10000));
            attempts++;
            
            console.log(`⏳ Checking status (${attempts}/${maxAttempts})...`);
            
            const statusResult = await fetch(`${base}/api/tts/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: data.requestId })
            });
            
            const statusData = await statusResult.json();
            
            if (statusData.audioUrl) {
                console.log('🎉 Audio ready! Downloading...');
                
                const downloadResult = await fetch(`${base}/api/tts/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audioUrl: statusData.audioUrl,
                        filename: filename || `vietnamese_${Date.now()}.mp3`
                    })
                });
                
                const downloadData = await downloadResult.json();
                console.log('✅ Download complete:', downloadData);
                return downloadData;
            }
            
            if (statusData.status === 'FAILED') {
                console.error('❌ Job failed');
                return;
            }
        }
        
        console.log('⏰ Timeout waiting for completion');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Test with different Vietnamese texts
async function runTests() {
    console.log('🚀 Starting Vietnamese TTS Tests\n');
    
    // Test 1: Short text
    console.log('📝 Test 1: Short Vietnamese text');
    await createVietnameseTTS(
        'Xin chào, đây là test tiếng Việt với dấu thanh điệu.',
        'test_short.mp3'
    );
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Ken Ken Audio story
    console.log('📝 Test 2: Ken Ken Audio story');
    await createVietnameseTTS(
        'Xin cảm ơn mọi người đã lắng nghe truyện trên Ken Ken Audio. Chúc mọi người có những giây phút thú vị khi nghe truyện. Khi Phó Tây Tẫn bị mù cả hai mắt, tôi đã dẫn anh về nhà. Anh thích đùa giỡn, nói rằng mình là chú cún ngoan của tôi và thích khám phá cơ thể tôi trong bóng tối để ghi nhớ hình dáng của tôi.',
        'kenken_story_final.mp3'
    );
    
    console.log('\n🎵 All tests completed!');
    
    // List all audio files
    try {
        const listResult = await fetch(`${base}/api/tts/list-audio`);
        const listData = await listResult.json();
        console.log('\n📁 All audio files:');
        console.log(JSON.stringify(listData, null, 2));
    } catch (e) {
        console.error('Error listing files:', e);
    }
}

// Run if called directly
if (require.main === module) {
    runTests();
}

module.exports = { createVietnameseTTS };
