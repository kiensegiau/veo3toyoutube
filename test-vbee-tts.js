const axios = require('axios');

async function main() {
    try {
        const payload = {
            input_text: 'Xin chào! Đây là bản test chuyển văn bản thành giọng nói.',
            voice_code: 'hn_female_ngochuyen_full_48k-fhg',
            audio_type: 'mp3',
            bitrate: 128,
            speed_rate: '1.0'
        };

        const res = await axios.post('http://localhost:8888/api/vbee-tts', payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('Response:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        if (err.response) {
            console.error('Error status:', err.response.status);
            console.error('Error data:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.error('Error:', err.message);
        }
        process.exit(1);
    }
}

main();
