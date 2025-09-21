const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Google Labs API configuration
const GOOGLE_LABS_CONFIG = {
    baseUrl: 'https://aisandbox-pa.googleapis.com/v1',
    headers: {
        'accept': '*/*',
        'accept-language': 'vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6',
        'content-type': 'text/plain;charset=UTF-8',
        'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'x-client-data': 'CLnnygE=',
        'Referer': 'https://labs.google/'
    }
};

// Store for tracking requests
let requestHistory = [];
let currentOperationName = null;

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint để tạo video từ text
app.post('/api/create-video', async (req, res) => {
    try {
        const { 
            prompt = 'cat', 
            aspectRatio = 'VIDEO_ASPECT_RATIO_PORTRAIT',
            videoModel = 'veo_3_0_t2v_fast_portrait',
            authorization = 'Bearer ya29.a0AQQ_BDQScX75jq1Y430fmcvVvQU-tforXT5ChnkYfRVPawiDzNrzEfWbrfDerVm17niKPezE4TS8rQ0hf7B60ZUxYpLu0wSuwRPM_RCbgyvoqXYA8oq00cH-u5gv0OORY5q-UFbxJEXvVF4QhMy34UtXPHWLjnWUmjN5Ru6XQFQMf2IhVC39glYSUJ-tmAa-qINzZoPDmuyIkVR3vkaKriebmcqpR95vMtGQtuQrnkdeLtgDeNJFe1RF_EW-2XtX1WQz93OtfjYssp99jnQKKDRiIAC6W_EcnS8O-biT-CxeGURUYUn0tleeWl1USWpsNFBxTGkHC6dX9uX77Kd54D03TOTmInKAbhzOz2wvXPcaCgYKAcASARYSFQHGX2MiUBJtgW8hZvVttsjTgTzSEQ0370'
        } = req.body;

        console.log(`🎬 Tạo video với prompt: "${prompt}"`);
        console.log('📝 Received form data:', { 
            prompt, 
            aspectRatio, 
            videoModel, 
            authorization: authorization ? 'Bearer token provided' : 'No token' 
        });

        // Tạo request body
        const requestBody = {
            clientContext: {
                projectId: "f6dc28c9-5dda-480d-a363-6114365e1a6a",
                tool: "PINHOLE",
                userPaygateTier: "PAYGATE_TIER_ONE"
            },
            requests: [{
                aspectRatio: aspectRatio,
                seed: Math.floor(Math.random() * 100000),
                textInput: {
                    prompt: prompt
                },
                videoModelKey: videoModel,
                metadata: {
                    sceneId: "21ea2896-9983-4283-b90a-7de0bf5422af"
                }
            }]
        };

        // Gọi Google Labs API
        const response = await fetch(`${GOOGLE_LABS_CONFIG.baseUrl}/video:batchAsyncGenerateVideoText`, {
            method: 'POST',
            headers: {
                ...GOOGLE_LABS_CONFIG.headers,
                'authorization': authorization
            },
            body: JSON.stringify(requestBody)
        });

        const responseData = await response.json();

        // Lưu operation name từ response
        if (responseData.operations && responseData.operations[0]) {
            currentOperationName = responseData.operations[0].operation.name;
            console.log(`🔑 Operation name saved: ${currentOperationName}`);
        }

        // Lưu request vào history
        const requestRecord = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            prompt: prompt,
            aspectRatio: aspectRatio,
            videoModel: videoModel,
            requestBody: requestBody,
            response: responseData,
            status: response.status,
            operationName: currentOperationName
        };

        requestHistory.push(requestRecord);

        console.log(`✅ Video generation request sent for: "${prompt}"`);
        console.log(`📊 Response status: ${response.status}`);

        res.json({
            success: true,
            message: `Video generation request sent for: "${prompt}"`,
            data: responseData,
            requestId: requestRecord.id,
            operationName: currentOperationName
        });

    } catch (error) {
        console.error('❌ Error creating video:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating video',
            error: error.message
        });
    }
});

// API endpoint để kiểm tra trạng thái video
app.post('/api/check-status', async (req, res) => {
    try {
        // Sử dụng operation name từ request gần nhất
        const operationName = currentOperationName || 'c55a3b418cf00edfa62d09b58e521b74';
        const sceneId = '21ea2896-9983-4283-b90a-7de0bf5422af';
        const authorization = 'Bearer ya29.a0AQQ_BDQScX75jq1Y430fmcvVvQU-tforXT5ChnkYfRVPawiDzNrzEfWbrfDerVm17niKPezE4TS8rQ0hf7B60ZUxYpLu0wSuwRPM_RCbgyvoqXYA8oq00cH-u5gv0OORY5q-UFbxJEXvVF4QhMy34UtXPHWLjnWUmjN5Ru6XQFQMf2IhVC39glYSUJ-tmAa-qINzZoPDmuyIkVR3vkaKriebmcqpR95vMtGQtuQrnkdeLtgDeNJFe1RF_EW-2XtX1WQz93OtfjYssp99jnQKKDRiIAC6W_EcnS8O-biT-CxeGURUYUn0tleeWl1USWpsNFBxTGkHC6dX9uX77Kd54D03TOTmInKAbhzOz2wvXPcaCgYKAcASARYSFQHGX2MiUBJtgW8hZvVttsjTgTzSEQ0370';

        console.log(`🔍 Checking status with operation: ${operationName}`);

        const requestBody = {
            operations: [{
                operation: {
                    name: operationName
                },
                sceneId: sceneId,
                status: "MEDIA_GENERATION_STATUS_PENDING"
            }]
        };

        const response = await fetch(`${GOOGLE_LABS_CONFIG.baseUrl}/video:batchCheckAsyncVideoGenerationStatus`, {
            method: 'POST',
            headers: {
                ...GOOGLE_LABS_CONFIG.headers,
                'authorization': authorization
            },
            body: JSON.stringify(requestBody)
        });

        const responseData = await response.json();

        // Kiểm tra xem video đã sẵn sàng chưa
        let videoUrl = null;
        let status = 'PENDING';
        let errorMessage = null;
        
        if (responseData.responses && responseData.responses.length > 0) {
            const videoResponse = responseData.responses[0];
            if (videoResponse.status === 'MEDIA_GENERATION_STATUS_COMPLETED') {
                status = 'COMPLETED';
                // Tìm video URL trong response
                if (videoResponse.videoUrl) {
                    videoUrl = videoResponse.videoUrl;
                } else if (videoResponse.video && videoResponse.video.url) {
                    videoUrl = videoResponse.video.url;
                } else if (videoResponse.mediaUrl) {
                    videoUrl = videoResponse.mediaUrl;
                }
            } else if (videoResponse.status === 'MEDIA_GENERATION_STATUS_FAILED') {
                status = 'FAILED';
                if (videoResponse.error) {
                    errorMessage = videoResponse.error.message;
                }
            }
        }

        console.log(`📊 Video status: ${status}, URL: ${videoUrl ? 'Found' : 'Not found'}`);

        res.json({
            success: true,
            data: responseData,
            status: response.status,
            videoStatus: status,
            videoUrl: videoUrl,
            errorMessage: errorMessage,
            message: status === 'COMPLETED' ? 'Video đã sẵn sàng!' : 
                    status === 'FAILED' ? `Video generation failed: ${errorMessage}` : 
                    'Video đang được tạo...'
        });

    } catch (error) {
        console.error('❌ Error checking status:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking video status',
            error: error.message
        });
    }
});

// API endpoint để xem lịch sử requests
app.get('/api/history', (req, res) => {
    res.json({
        success: true,
        totalRequests: requestHistory.length,
        requests: requestHistory
    });
});

// API endpoint để xóa lịch sử
app.delete('/api/history', (req, res) => {
    requestHistory = [];
    currentOperationName = null;
    res.json({
        success: true,
        message: 'History cleared'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`📝 API endpoints:`);
    console.log(`   POST /api/create-video - Tạo video từ text`);
    console.log(`   POST /api/check-status - Kiểm tra trạng thái video`);
    console.log(`   GET  /api/history - Xem lịch sử requests`);
    console.log(`   DELETE /api/history - Xóa lịch sử`);
});

module.exports = app;
