const axios = require('axios');

async function vbeeTTS(req, res) {
    try {
        const {
            app_id = '3907419d-0d78-46d8-857c-5a6fe6b17b89',
            response_type = 'direct',
            callback_url = 'https://mydomain/callback',
            input_text = 'Chào mừng đén với website của chúng tôi! Đây là trang web cung cấp một giải pháp văn bản thành giọng nói, trên cơ sở, nó hỗ trợ các doanh nghiệp xây dựng các hệ thống trung tâm cuộc gọi tự động, hệ thống thông báo công khai, trợ lý ảo, tin tức âm thanh, podcast, sách âm thanh và tường thuật phim.',
            voice_code = 'hn_female_ngochuyen_full_48k-fhg',
            audio_type = 'mp3',
            bitrate = 128,
            speed_rate = '1.0'
        } = req.body || {};

        const data = {
            app_id,
            response_type,
            callback_url,
            input_text,
            voice_code,
            audio_type,
            bitrate,
            speed_rate
        };

        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://vbee.vn/api/v1/tts',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjA4NjgwOTV9.hYH_gbcJWbT2RCnk1omaLI5dzCZ46DOnZnnO62wirao'
            },
            data
        };

        const response = await axios(config);
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('❌ Vbee TTS error:', error?.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Gọi API Vbee TTS thất bại',
            error: error?.response?.data || error.message
        });
    }
}

module.exports = { vbeeTTS };
