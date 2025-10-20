const axios = require('axios');

async function downloadDirectAudio() {
    try {
        console.log('📥 Tải file MP3 từ audio_link mới...');
        
        const downloadRes = await axios.post('http://localhost:8888/api/tts/download', {
            audioUrl: 'https://vbee.vn/s/ac956736-716c-4971-97dc-8362ec480646/167f28fd-6a68-475a-b465-94e966746fa5'
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

downloadDirectAudio();
