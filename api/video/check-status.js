const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { removeOperation } = require('../utils/storage');

// Google Labs Configuration
const GOOGLE_LABS_CONFIG = {
    baseUrl: 'https://aisandbox-pa.googleapis.com/v1',
    headers: {
        'accept': '*/*',
        'accept-language': 'vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site'
    }
};

// Hàm lấy Labs cookies
async function getLabsCookies() {
    try {
        const fs = require('fs');
        const path = require('path');
        const labsCookiesFile = path.join(__dirname, '../../labs-cookies.txt');
        
        if (!fs.existsSync(labsCookiesFile)) {
            console.log('❌ File labs-cookies.txt không tồn tại');
            return null;
        }
        
        const content = fs.readFileSync(labsCookiesFile, 'utf8');
        const lines = content.split('\n');
        
        // Tìm dòng chứa cookies (bỏ qua dòng comment)
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() && !line.startsWith('#')) {
                return line.trim();
            }
        }
        
        console.log('❌ Không tìm thấy cookies trong file');
        return null;
    } catch (error) {
        console.error('❌ Lỗi đọc Labs cookies:', error);
        return null;
    }
}

// Hàm tải video về máy
function downloadVideo(videoUrl, operationName) {
    return new Promise((resolve, reject) => {
        try {
            // Tạo tên file với đuôi .mp4
            const fileName = `${operationName}.mp4`;
            const filePath = path.join(__dirname, '../../public', 'videos', fileName);
            
            // Tạo thư mục videos nếu chưa có
            const videosDir = path.join(__dirname, '../../public', 'videos');
            if (!fs.existsSync(videosDir)) {
                fs.mkdirSync(videosDir, { recursive: true });
            }
            
            console.log(`📥 Đang tải video: ${videoUrl}`);
            console.log(`💾 Lưu tại: ${filePath}`);
            
            const file = fs.createWriteStream(filePath);
            
            https.get(videoUrl, (response) => {
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    console.log(`✅ Video đã được tải về: ${fileName}`);
                    resolve({
                        success: true,
                        fileName: fileName,
                        filePath: `/videos/${fileName}`,
                        fullPath: filePath
                    });
                });
            }).on('error', (err) => {
                console.error('❌ Lỗi tải video:', err);
                reject(err);
            });
            
        } catch (error) {
            console.error('❌ Lỗi tải video:', error);
            reject(error);
        }
    });
}

// Hàm kiểm tra trạng thái video
async function checkStatus(req, res, storageData) {
    try {
        const labsCookies = await getLabsCookies();
        if (!labsCookies) {
            return res.status(400).json({
                success: false,
                message: 'Chưa có Labs cookies. Vui lòng mở Chrome Labs và lấy cookies trước.'
            });
        }

        // Lấy access token từ session endpoint
        const sessionResponse = await fetch('https://labs.google/fx/api/auth/session', {
            method: 'GET',
            headers: {
                'accept': '*/*',
                'accept-language': 'vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6',
                'content-type': 'application/json',
                'cookie': labsCookies,
                'referer': 'https://labs.google/fx/tools/flow',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin'
            }
        });
        
        let authToken = null;
        if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            if (sessionData && sessionData.user && sessionData.user.accessToken) {
                authToken = `Bearer ${sessionData.user.accessToken}`;
            } else if (sessionData && sessionData.access_token) {
                authToken = `Bearer ${sessionData.access_token}`;
            }
        }

        // Cho phép truyền operationName để hỗ trợ nhiều yêu cầu song song
        const { operationName: opFromClient } = req.body || {};
        // Sử dụng operation name từ client nếu có, nếu không dùng cái đang lưu gần nhất
        const operationName = opFromClient || storageData.currentOperationName || null;

        if (!operationName) {
            return res.status(400).json({
                success: false,
                message: 'Không có operation name để kiểm tra. Vui lòng tạo video trước.'
            });
        }

        console.log(`🔍 Checking status with operation: ${operationName}`);

        const requestBody = {
            operations: [{
                operation: { name: operationName },
                sceneId: "361d647b-e22b-4477-acc1-fe3aa18b5b68",
                status: "MEDIA_GENERATION_STATUS_PENDING"
            }]
        };

        const response = await fetch(`${GOOGLE_LABS_CONFIG.baseUrl}/video:batchCheckAsyncVideoGenerationStatus`, {
            method: 'POST',
            headers: {
                ...GOOGLE_LABS_CONFIG.headers,
                'Cookie': labsCookies,
                ...(authToken && { 'Authorization': authToken }) // Conditionally add Authorization header
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Status check error:', response.status, errorText);
            return res.status(500).json({
                success: false,
                message: `Status check failed: ${response.status}`,
                error: errorText
            });
        }

        const data = await response.json();
        console.log(`🔍 Full response for operation ${operationName}:`, JSON.stringify(data, null, 2));

        // Tìm operation trong response
        let targetOperation = null;
        if (data.operations && data.operations.length > 0) {
            console.log(`🔍 Looking for operation: ${operationName}`);
            console.log(`🔍 Available operations:`, data.operations.map(op => op.operation.name));
            
            targetOperation = data.operations.find(op => op.operation.name === operationName);
            if (targetOperation) {
                console.log(`✅ Found target operation ${operationName}: ${targetOperation.status}`);
            }
        }

        if (!targetOperation) {
            return res.status(404).json({
                success: false,
                message: `Operation ${operationName} not found in response`,
                data: data
            });
        }

        const status = targetOperation.status;
        console.log(`🎬 ${operationName} -> ${status}`);

        let videoUrl = null;
        let downloadInfo = null;
        let finalStatus = 'PENDING';

        // Kiểm tra lỗi cụ thể và bỏ qua nếu là lỗi không thể xử lý
        if (targetOperation.operation && targetOperation.operation.error) {
            const errorCode = targetOperation.operation.error.code;
            const errorMessage = targetOperation.operation.error.message;
            
            // Bỏ qua các lỗi không thể xử lý được
            if (errorMessage === 'PUBLIC_ERROR_UNSAFE_GENERATION' || 
                errorCode === 3 || 
                errorMessage.includes('UNSAFE_GENERATION')) {
                console.log(`⚠️ Bỏ qua video ${operationName} - Lỗi không thể xử lý: ${errorMessage}`);
                
                // Xóa operation khỏi storage
                try {
                    removeOperation(storageData, operationName);
                    console.log(`🗑️ Đã xóa operation ${operationName} khỏi storage`);
                } catch (removeError) {
                    console.error('❌ Lỗi xóa operation khỏi storage:', removeError);
                }
                
                return res.json({
                    success: true,
                    data: data,
                    status: 200,
                    videoStatus: 'SKIPPED',
                    videoUrl: null,
                    errorMessage: `Video bị bỏ qua do lỗi: ${errorMessage}`,
                    downloadInfo: null,
                    operationName: operationName,
                    prompt: storageData.requestHistory?.find(req => req.operationName === operationName)?.prompt || 'Unknown',
                    skipReason: 'UNSAFE_GENERATION',
                    removedFromStorage: true
                });
            }
        }

        if (status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL') {
            // Tìm video URL trong metadata
            if (targetOperation.operation && targetOperation.operation.metadata) {
                const metadata = targetOperation.operation.metadata;
                if (metadata.video && metadata.video.fifeUrl) {
                    videoUrl = metadata.video.fifeUrl;
                    console.log(`🎥 Found video URL in fifeUrl: ${videoUrl}`);
                }
            }

            if (videoUrl) {
                console.log(`✅ Video ready for operation ${operationName}: ${videoUrl}`);
                finalStatus = 'COMPLETED';
                
                // Tự động tải video về máy
                try {
                    console.log(`📥 Đang tải video: ${videoUrl}`);
                    downloadInfo = await downloadVideo(videoUrl, operationName);
                    console.log(`✅ Video đã được tải về: ${downloadInfo.fileName}`);
                } catch (downloadError) {
                    console.error('❌ Lỗi tải video:', downloadError);
                    downloadInfo = { success: false, error: downloadError.message };
                }
            } else {
                console.log(`❌ Video URL not found for operation ${operationName}`);
                finalStatus = 'FAILED';
            }
        } else if (status === 'MEDIA_GENERATION_STATUS_FAILED') {
            finalStatus = 'FAILED';
        } else if (status === 'MEDIA_GENERATION_STATUS_ACTIVE') {
            console.log(`⏳ Video still processing for operation ${operationName}: ${status}`);
            finalStatus = 'PENDING';
        }

        console.log(`📊 Final status: ${finalStatus}, URL: ${videoUrl ? 'Found' : 'Not found'}`);

        res.json({
            success: true,
            data: data,
            status: 200,
            videoStatus: finalStatus,
            videoUrl: videoUrl,
            errorMessage: finalStatus === 'FAILED' ? 'Video generation failed' : null,
            downloadInfo: downloadInfo,
            operationName: operationName,
            prompt: storageData.requestHistory?.find(req => req.operationName === operationName)?.prompt || 'Unknown'
        });

    } catch (error) {
        console.error('❌ Check status error:', error);
        res.status(500).json({
            success: false,
            message: 'Status check failed',
            error: error.message
        });
    }
}

module.exports = { checkStatus };
