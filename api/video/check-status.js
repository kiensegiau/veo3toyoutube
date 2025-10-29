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
            
            
            
            const file = fs.createWriteStream(filePath);
            
            https.get(videoUrl, (response) => {
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    
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
        // Unified behavior (same as create):
        // 1) If client sends cookies -> ALWAYS use them
        // 2) Else if default mode -> read from file/auto sources
        // 3) Else if vps mode -> require client cookies
        const runMode = (process.env.RUN_MODE || 'default').toLowerCase();
        const sanitizeCookieHeader = (val) => {
            if (!val || typeof val !== 'string') return '';
            let s = String(val).replace(/^Cookie:\s*/i, '');
            s = s.split(/\r?\n/).filter(line => line && !/^\s*#/.test(line)).join('; ');
            s = s.replace(/\r|\n/g, '').trim();
            return s;
        };
        const hdrs = (req && typeof req === 'object' && req.headers && typeof req.headers === 'object') ? req.headers : {};
        let labsCookies = sanitizeCookieHeader((req.body && (req.body.labsCookies || req.body.cookies || req.body.cookie)) || hdrs['x-labs-cookie'] || hdrs['X-Labs-Cookie'] || '');
        if (!labsCookies) {
            if (runMode === 'vps') {
                return res.status(400).json({
                    success: false,
                    message: 'VPS mode: Thiếu Labs cookies. Gửi labsCookies trong body hoặc header x-labs-cookie.'
                });
            }
            labsCookies = sanitizeCookieHeader(await getLabsCookies());
            if (!labsCookies) {
                return res.status(400).json({
                    success: false,
                    message: 'Chưa có Labs cookies. Vui lòng mở Chrome Labs và lấy cookies trước.'
                });
            }
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
        const { operationName: opFromClient, tenantId: tenantIdRaw } = req.body || {};
        const tenantId = (req.headers['x-tenant-id'] || tenantIdRaw || '').toString().trim() || 'default';
        // Sử dụng operation name từ client nếu có, nếu không dùng cái đang lưu gần nhất
        const operationName = opFromClient || storageData.currentOperationName || null;

        if (!operationName) {
            return res.status(400).json({
                success: false,
                message: 'Không có operation name để kiểm tra. Vui lòng tạo video trước.'
            });
        }

        

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

        // Tìm operation trong response
        let targetOperation = null;
        if (data.operations && data.operations.length > 0) {
            
            targetOperation = data.operations.find(op => op.operation.name === operationName);
            
        }

        if (!targetOperation) {
            return res.status(404).json({
                success: false,
                message: `Operation ${operationName} not found in response`,
                data: data
            });
        }

        const status = targetOperation.status;
        

        let videoUrl = null;
        let downloadInfo = null;
        let finalStatus = 'PENDING';

        // Kiểm tra lỗi cụ thể và xóa khỏi storage nếu là lỗi không thể khắc phục
        if (targetOperation.operation && targetOperation.operation.error) {
            const errorCode = targetOperation.operation.error.code;
            const errorMessage = targetOperation.operation.error.message;
            
            // Danh sách các lỗi cần xóa khỏi storage (không thể retry)
            const unrecoverableErrors = [
                'PUBLIC_ERROR_UNSAFE_GENERATION',  // code 3
                'PUBLIC_ERROR_HIGH_TRAFFIC',       // code 13
                'PUBLIC_ERROR_QUOTA_EXCEEDED',
                'PUBLIC_ERROR_INVALID_REQUEST',
                'UNSAFE_GENERATION',
                'QUOTA_EXCEEDED',
                'INVALID_REQUEST'
            ];
            
            const shouldRemove = 
                unrecoverableErrors.some(err => errorMessage?.includes(err)) ||
                errorCode === 3 ||  // UNSAFE_GENERATION
                errorCode === 13 || // HIGH_TRAFFIC
                errorCode === 8;    // QUOTA_EXCEEDED
            
            if (shouldRemove) {
                
                // Xóa operation khỏi storage
                try {
                    removeOperation(storageData, operationName);
                } catch (removeError) {
                    console.error('❌ Lỗi xóa operation khỏi storage:', removeError);
                }
                
                return res.json({
                    success: true,
                    data: data,
                    status: 200,
                    videoStatus: 'FAILED',
                    videoUrl: null,
                    errorMessage: `Video thất bại do lỗi: ${errorMessage} (code: ${errorCode})`,
                    errorCode: errorCode,
                    downloadInfo: null,
                    operationName: operationName,
                    prompt: storageData.requestHistory?.find(req => req.operationName === operationName)?.prompt || 'Unknown',
                    skipReason: errorMessage,
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
                   
                }
            }

            if (videoUrl) {
                finalStatus = 'COMPLETED';
                
                // Tự động tải video về máy
                try {
                    downloadInfo = await downloadVideo(videoUrl, operationName);
                    
                    // Xóa operation đã hoàn thành khỏi storage (tránh check lại)
                    try {
                        removeOperation(storageData, operationName);
                    } catch (removeError) {
                        console.error('❌ Lỗi xóa operation khỏi storage:', removeError);
                    }
                } catch (downloadError) {
                    console.error('❌ Lỗi tải video:', downloadError);
                    downloadInfo = { success: false, error: downloadError.message };
                }
            } else {
                finalStatus = 'FAILED';
                
                // Xóa operation không có URL khỏi storage
                try {
                    removeOperation(storageData, operationName);
                } catch (removeError) {
                    console.error('❌ Lỗi xóa operation khỏi storage:', removeError);
                }
            }
        } else if (status === 'MEDIA_GENERATION_STATUS_FAILED') {
            finalStatus = 'FAILED';
            
            // Xóa operation thất bại khỏi storage
            try {
                removeOperation(storageData, operationName);
            } catch (removeError) {
                console.error('❌ Lỗi xóa operation khỏi storage:', removeError);
            }
        } else if (status === 'MEDIA_GENERATION_STATUS_ACTIVE') {
            finalStatus = 'PENDING';
        }

        

        res.json({
            success: true,
            data: data,
            status: 200,
            videoStatus: finalStatus,
            videoUrl: videoUrl,
            errorMessage: finalStatus === 'FAILED' ? 'Video generation failed' : null,
            downloadInfo: downloadInfo,
            operationName: operationName,
            prompt: storageData.requestHistory?.find(req => req.operationName === operationName && (!tenantId || req.tenantId === tenantId))?.prompt || 'Unknown'
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
