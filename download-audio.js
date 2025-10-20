const axios = require('axios');

async function downloadAudio() {
    try {
        console.log('📥 Tải file MP3 về máy chủ...');
        
        const downloadRes = await axios.post('http://localhost:8888/api/tts/download', {
            audioUrl: 'https://vbee.vn/s/1aad2bc8-fd77-46aa-8461-712d0d471e74/059dc5d4-f748-4368-9b8d-9583156f9f5c'
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('✅ Tải file thành công:');
        console.log(JSON.stringify(downloadRes.data, null, 2));
        
        console.log('\n📁 Liệt kê các file audio đã lưu...');
        const listRes = await axios.get('http://localhost:8888/api/tts/list-audio');
        console.log('📂 Danh sách file audio:');
        console.log(JSON.stringify(listRes.data, null, 2));
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

downloadAudio();
