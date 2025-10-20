const axios = require('axios');

async function testUnifiedDownload() {
    try {
        console.log('🚀 Test endpoint thống nhất với tự động tải về...');
        
        const response = await axios.post('http://localhost:8888/api/tts', {
            input_text: 'Test tự động tải về file MP3 từ Vbee TTS.',
            voice_code: 'hn_female_ngochuyen_full_48k-fhg',
            waitForCompletion: true,
            download: true,
            maxWaitMs: 60000, // 1 phút
            pollIntervalMs: 5000 // 5 giây
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('✅ Kết quả endpoint thống nhất:');
        console.log(JSON.stringify(response.data, null, 2));
        
        if (response.data.downloaded) {
            console.log('\n🎉 File đã được tải về thành công!');
            console.log(`📁 File: ${response.data.downloaded.filename}`);
            console.log(`📂 Đường dẫn: ${response.data.downloaded.path}`);
            console.log(`🌐 URL công khai: ${response.data.downloaded.publicPath}`);
            console.log(`📊 Kích thước: ${response.data.downloaded.size} bytes`);
        }
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testUnifiedDownload();
