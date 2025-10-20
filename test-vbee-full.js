const axios = require('axios');

async function testVbeeFull() {
    console.log('🧪 Bắt đầu test đầy đủ chức năng Vbee TTS...\n');
    
    try {
        // 1. Tạo job TTS
        console.log('1️⃣ Tạo job TTS...');
        const createPayload = {
            input_text: 'Xin chào! Đây là bản test đầy đủ chức năng chuyển văn bản thành giọng nói. Hệ thống đang hoạt động tốt.',
            voice_code: 'hn_female_ngochuyen_full_48k-fhg',
            audio_type: 'mp3',
            bitrate: 128,
            speed_rate: '1.0'
        };

        const createRes = await axios.post('http://localhost:8888/api/vbee-tts', createPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('✅ Tạo job thành công:');
        console.log(JSON.stringify(createRes.data, null, 2));
        
        const requestId = createRes.data.data.result.request_id;
        console.log(`📋 Request ID: ${requestId}\n`);

        // 2. Kiểm tra trạng thái job
        console.log('2️⃣ Kiểm tra trạng thái job...');
        let status = 'IN_PROGRESS';
        let attempts = 0;
        const maxAttempts = 30; // 30 lần * 2 giây = 1 phút

        while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
            attempts++;
            console.log(`⏳ Lần thử ${attempts}/${maxAttempts} - Đang chờ job hoàn thành...`);
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // Chờ 2 giây
            
            try {
                const statusRes = await axios.post('http://localhost:8888/api/tts/status', {
                    request_id: requestId
                }, {
                    headers: { 'Content-Type': 'application/json' }
                });

                console.log('📊 Response từ /api/tts/status:');
                console.log(JSON.stringify(statusRes.data, null, 2));
                
                status = statusRes.data.status;
                console.log(`📊 Trạng thái: ${status}`);
                
                if (status === 'COMPLETED') {
                    console.log('✅ Job hoàn thành!');
                    
                    // 3. Lấy audio URL
                    console.log('\n3️⃣ Lấy audio URL...');
                    const audioUrl = statusRes.data.audioUrl;
                    console.log(`🔗 Audio URL: ${audioUrl}`);
                    
                    // 4. Tải file về máy chủ
                    console.log('\n4️⃣ Tải file MP3 về máy chủ...');
                    const downloadRes = await axios.post('http://localhost:8888/api/tts/download', {
                        request_id: requestId
                    }, {
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    console.log('✅ Tải file thành công:');
                    console.log(JSON.stringify(downloadRes.data, null, 2));
                    
                    // 5. Liệt kê các file audio đã lưu
                    console.log('\n5️⃣ Liệt kê các file audio đã lưu...');
                    const listRes = await axios.get('http://localhost:8888/api/tts/list-audio');
                    console.log('📁 Danh sách file audio:');
                    console.log(JSON.stringify(listRes.data, null, 2));
                    
                    break;
                } else if (status === 'FAILED') {
                    console.log('❌ Job thất bại!');
                    console.log(JSON.stringify(statusRes.data, null, 2));
                    break;
                }
            } catch (error) {
                console.log(`⚠️ Lỗi kiểm tra trạng thái: ${error.message}`);
            }
        }

        if (status === 'IN_PROGRESS' && attempts >= maxAttempts) {
            console.log('⏰ Timeout: Job chưa hoàn thành sau 1 phút');
        }

        // 6. Test endpoint thống nhất
        console.log('\n6️⃣ Test endpoint thống nhất /api/tts...');
        const unifiedRes = await axios.post('http://localhost:8888/api/tts', {
            input_text: 'Test endpoint thống nhất - tạo, chờ và tải tự động.',
            voice_code: 'hn_female_ngochuyen_full_48k-fhg'
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('✅ Endpoint thống nhất hoạt động:');
        console.log(JSON.stringify(unifiedRes.data, null, 2));

    } catch (error) {
        console.error('❌ Lỗi trong quá trình test:', error.message);
        if (error.response) {
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testVbeeFull();
