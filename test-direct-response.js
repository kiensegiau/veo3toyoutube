const axios = require('axios');

async function testDirectResponse() {
    try {
        console.log('🔄 Test với response_type: "direct"...');
        
        const response = await axios.post('http://localhost:8888/api/vbee-tts', {
            input_text: 'Test response trực tiếp từ Vbee TTS.',
            voice_code: 'hn_female_ngochuyen_full_48k-fhg',
            response_type: 'direct', // Thay đổi từ 'indirect' sang 'direct'
            audio_type: 'mp3',
            bitrate: 128,
            speed_rate: '1.0'
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('✅ Kết quả với response_type direct:');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testDirectResponse();
