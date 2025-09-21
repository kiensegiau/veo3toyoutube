const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const https = require('https');
const url = require('url');

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
let currentCookies = null;
let tokenExpiryTime = null;

// File paths for persistent storage
const STORAGE_FILE = 'server-storage.json';

// Load data from file on startup
function loadStorageData() {
    try {
        if (fs.existsSync(STORAGE_FILE)) {
            const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
            currentCookies = data.currentCookies || null;
            tokenExpiryTime = data.tokenExpiryTime || null;
            currentOperationName = data.currentOperationName || null;
            requestHistory = data.requestHistory || [];
            
            console.log('📁 Storage data loaded from file');
            if (currentCookies) {
                console.log('🍪 Cookies loaded from storage');
            }
            if (tokenExpiryTime) {
                console.log(`⏰ Token expiry loaded: ${new Date(tokenExpiryTime).toLocaleString('vi-VN')}`);
            }
        }
    } catch (error) {
        console.error('❌ Error loading storage data:', error);
    }
}

// Save data to file
function saveStorageData() {
    try {
        const data = {
            currentCookies,
            tokenExpiryTime,
            currentOperationName,
            requestHistory,
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
        console.log('💾 Storage data saved to file');
    } catch (error) {
        console.error('❌ Error saving storage data:', error);
    }
}

// Function để cập nhật file cookies.json gốc
function updateCookiesJsonFile(cookieString) {
    try {
        // Đọc file cookies.json hiện tại
        let cookiesData = [];
        if (fs.existsSync('cookies.json')) {
            const fileContent = fs.readFileSync('cookies.json', 'utf8');
            cookiesData = JSON.parse(fileContent);
        }
        
        // Parse cookie string thành array
        const cookiePairs = cookieString.split(';');
        const newCookies = cookiePairs.map(pair => {
            const [name, value] = pair.trim().split('=');
            return {
                domain: "labs.google",
                name: name,
                value: value,
                expirationDate: Date.now() + (24 * 60 * 60 * 1000), // 24 giờ
                hostOnly: true,
                httpOnly: false,
                path: "/",
                sameSite: "lax",
                secure: true,
                session: false,
                storeId: "0"
            };
        });
        
        // Lọc bỏ cookies cũ từ labs.google và thêm cookies mới
        const filteredCookies = cookiesData.filter(cookie => 
            !cookie.domain.includes('labs.google')
        );
        
        const updatedCookies = [...filteredCookies, ...newCookies];
        
        // Ghi lại file cookies.json
        fs.writeFileSync('cookies.json', JSON.stringify(updatedCookies, null, 2));
        console.log('🍪 Updated cookies.json file with new cookies');
        
    } catch (error) {
        console.error('❌ Error updating cookies.json:', error);
    }
}

// Function để tải video về máy
function downloadVideo(videoUrl, operationName) {
    return new Promise((resolve, reject) => {
        try {
            // Tạo tên file với đuôi .mp4
            const fileName = `${operationName}.mp4`;
            const filePath = path.join(__dirname, 'public', 'videos', fileName);
            
            // Tạo thư mục videos nếu chưa có
            const videosDir = path.join(__dirname, 'public', 'videos');
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
                        localPath: filePath
                    });
                });
                
                file.on('error', (err) => {
                    fs.unlink(filePath, () => {}); // Xóa file nếu có lỗi
                    console.error('❌ Lỗi tải video:', err);
                    reject(err);
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

// Hàm kiểm tra và tự động làm mới token
async function checkAndRefreshTokenIfNeeded() {
    if (!currentCookies || !tokenExpiryTime) {
        return false;
    }

    const now = Date.now();
    const timeUntilExpiry = tokenExpiryTime - now;
    const refreshThreshold = 30 * 60 * 1000; // 30 phút trước khi hết hạn

    if (timeUntilExpiry <= refreshThreshold) {
        console.log('🔄 Token sắp hết hạn, tự động làm mới...');
        
        try {
            const response = await fetch('https://labs.google/fx/api/auth/session', {
                method: 'GET',
                headers: {
                    'accept': '*/*',
                    'accept-language': 'vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6',
                    'content-type': 'application/json',
                    'if-none-match': '"1yz198yxsxhs"',
                    'priority': 'u=1, i',
                    'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'cookie': currentCookies
                },
                referrer: 'https://labs.google/fx/tools/flow/project/f6dc28c9-5dda-480d-a363-6114365e1a6a',
                credentials: 'include'
            });

            if (response.ok) {
                const sessionData = await response.json();
                console.log('✅ Token tự động làm mới thành công');
                
                // Cập nhật thời gian hết hạn mới
                tokenExpiryTime = Date.now() + (1.5 * 60 * 60 * 1000);
                console.log(`⏰ Token expiry updated to: ${new Date(tokenExpiryTime).toLocaleString('vi-VN')}`);
                
                // Lưu vào file
                saveStorageData();
                
                return true;
            } else {
                console.log('❌ Không thể tự động làm mới token');
                return false;
            }
        } catch (error) {
            console.error('❌ Lỗi khi tự động làm mới token:', error);
            return false;
        }
    }

    return false;
}

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
            authorization = 'Bearer ya29.a0AQQ_BDQScX75jq1Y430fmcvVvQU-tforXT5ChnkYfRVPawiDzNrzEfWbrfDerVm17niKPezE4TS8rQ0hf7B60ZUxYpLu0wSuwRPM_RCbgyvoqXYA8oq00cH-u5gv0OORY5q-UFbxJEXvVF4QhMy34UtXPHWLjnWUmjN5Ru6XQFQMf2IhVC39glYSUJ-tmAa-qINzZoPDmuyIkVR3vkaKriebmcqpR95vMtGQtuQrnkdeLtgDeNJFe1RF_EW-2XtX1WQz93OtfjYssp99jnQKKDRiIAC6W_EcnS8O-biT-CxeGURUYUn0tleeWl1USWpsNFBxTGkHC6dX9uX77Kd54D03TOTmInKAbhzOz2wvXPcaCgYKAcASARYSFQHGX2MiUBJtgW8hZvVttsjTgTzSEQ0370',
            cookies = null
        } = req.body;

        console.log(`🎬 Tạo video với prompt: "${prompt}"`);
        console.log('📝 Received form data:', { 
            prompt, 
            aspectRatio, 
            videoModel, 
            authorization: authorization ? 'Bearer token provided' : 'No token',
            cookies: cookies ? 'Cookies provided' : 'No cookies'
        });

        // Lưu cookies nếu có
        if (cookies) {
            currentCookies = cookies;
            console.log('🍪 Cookies saved for auto-refresh');
        }

        // Lưu thời gian hết hạn token (ước tính 1.5 giờ từ bây giờ)
        tokenExpiryTime = Date.now() + (1.5 * 60 * 60 * 1000); // 1.5 giờ
        console.log(`⏰ Token expiry set to: ${new Date(tokenExpiryTime).toLocaleString('vi-VN')}`);
        
        // Lưu vào file
        saveStorageData();

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

        // Kiểm tra token hết hạn
        if (response.status === 401 || (responseData.error && responseData.error.message && responseData.error.message.includes('token'))) {
            console.log('🔑 Token expired, please update authorization token');
            return res.status(401).json({
                success: false,
                message: 'Authorization token expired. Please update your token in the form.',
                error: 'TOKEN_EXPIRED',
                needsNewToken: true
            });
        }

        // Lưu operation name từ response
        if (responseData.operations && responseData.operations[0]) {
            currentOperationName = responseData.operations[0].operation.name;
            console.log(`🔑 Operation name saved: ${currentOperationName}`);
            
            // Lưu vào file
            saveStorageData();
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
        // Kiểm tra và tự động làm mới token nếu cần
        await checkAndRefreshTokenIfNeeded();

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

        // Kiểm tra token hết hạn
        if (response.status === 401 || (responseData.error && responseData.error.message && responseData.error.message.includes('token'))) {
            console.log('🔑 Token expired during status check');
            return res.status(401).json({
                success: false,
                message: 'Authorization token expired. Please update your token in the form.',
                error: 'TOKEN_EXPIRED',
                needsNewToken: true
            });
        }

        // Kiểm tra xem video đã sẵn sàng chưa
        let videoUrl = null;
        let status = 'PENDING';
        let errorMessage = null;
        
        // Kiểm tra cả responses và operations
        let videoResponse = null;
        
        if (responseData.responses && responseData.responses.length > 0) {
            videoResponse = responseData.responses[0];
            console.log(`📊 Video response status: ${videoResponse.status}`);
        } else if (responseData.operations && responseData.operations.length > 0) {
            videoResponse = responseData.operations[0];
            console.log(`📊 Operation status: ${videoResponse.status}`);
        }
        
        if (videoResponse) {
            if (videoResponse.status === 'MEDIA_GENERATION_STATUS_COMPLETED' || 
                videoResponse.status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL') {
                status = 'COMPLETED';
                
                // Tìm video URL trong response
                if (videoResponse.videoUrl) {
                    videoUrl = videoResponse.videoUrl;
                } else if (videoResponse.video && videoResponse.video.url) {
                    videoUrl = videoResponse.video.url;
                } else if (videoResponse.mediaUrl) {
                    videoUrl = videoResponse.mediaUrl;
                } else if (videoResponse.operation && videoResponse.operation.metadata && videoResponse.operation.metadata.video) {
                    // Tìm video URL trong metadata
                    const videoData = videoResponse.operation.metadata.video;
                    if (videoData.fifeUrl) {
                        videoUrl = videoData.fifeUrl;
                        console.log(`🎥 Found video URL in fifeUrl: ${videoUrl}`);
                    } else if (videoData.servingBaseUri) {
                        videoUrl = videoData.servingBaseUri;
                        console.log(`🎥 Found video URL in servingBaseUri: ${videoUrl}`);
                    }
                }
            } else if (videoResponse.status === 'MEDIA_GENERATION_STATUS_FAILED') {
                status = 'FAILED';
                if (videoResponse.error) {
                    errorMessage = videoResponse.error.message;
                }
            }
        }

        console.log(`📊 Final status: ${status}, URL: ${videoUrl ? 'Found' : 'Not found'}`);

        // Nếu video đã hoàn thành hoặc thất bại, clear operation name
        if (status === 'COMPLETED' || status === 'FAILED') {
            console.log('✅ Video processing finished, clearing operation name');
            currentOperationName = null;
            saveStorageData();
        }

        // Nếu video hoàn thành, tải video về máy
        let downloadInfo = null;
        if (status === 'COMPLETED' && videoUrl && operationName) {
            try {
                downloadInfo = await downloadVideo(videoUrl, operationName);
            } catch (error) {
                console.error('❌ Lỗi tải video:', error);
                downloadInfo = { success: false, error: error.message };
            }
        }

        res.json({
            success: true,
            data: responseData,
            status: response.status,
            videoStatus: status,
            videoUrl: videoUrl,
            errorMessage: errorMessage,
            downloadInfo: downloadInfo,
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
    currentCookies = null;
    tokenExpiryTime = null;
    
    // Lưu vào file
    saveStorageData();
    
    res.json({
        success: true,
        message: 'History cleared'
    });
});

// API endpoint để kiểm tra thời gian hết hạn token
app.get('/api/token-status', (req, res) => {
    if (!tokenExpiryTime) {
        return res.json({
            success: false,
            message: 'No token expiry time set',
            hasToken: false
        });
    }

    const now = Date.now();
    const timeUntilExpiry = tokenExpiryTime - now;
    const refreshThreshold = 30 * 60 * 1000; // 30 phút
    const isNearExpiry = timeUntilExpiry <= refreshThreshold;
    const isExpired = timeUntilExpiry <= 0;

    res.json({
        success: true,
        hasToken: true,
        expiryTime: new Date(tokenExpiryTime).toISOString(),
        timeUntilExpiry: timeUntilExpiry,
        timeUntilExpiryMinutes: Math.round(timeUntilExpiry / (60 * 1000)),
        isNearExpiry: isNearExpiry,
        isExpired: isExpired,
        hasCookies: !!currentCookies,
        canAutoRefresh: !!currentCookies && !isExpired
    });
});

// API endpoint để tự động làm mới token
app.post('/api/refresh-token', async (req, res) => {
    try {
        if (!currentCookies) {
            return res.status(400).json({
                success: false,
                message: 'No cookies available for token refresh'
            });
        }

        console.log('🔄 Attempting to refresh token with cookies...');

        // Thử lấy token mới từ Google Labs
        const response = await fetch('https://labs.google/fx/api/auth/session', {
            method: 'GET',
            headers: {
                'accept': '*/*',
                'accept-language': 'vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6',
                'content-type': 'application/json',
                'if-none-match': '"1yz198yxsxhs"',
                'priority': 'u=1, i',
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'cookie': currentCookies
            },
            referrer: 'https://labs.google/fx/tools/flow/project/f6dc28c9-5dda-480d-a363-6114365e1a6a',
            credentials: 'include'
        });

        if (response.ok) {
            const sessionData = await response.json();
            console.log('✅ Session refreshed successfully');
            
            // Thử lấy token mới từ session
            if (sessionData && sessionData.user && sessionData.user.accessToken) {
                const newToken = `Bearer ${sessionData.user.accessToken}`;
                console.log('🔑 New token extracted from session');
                
                res.json({
                    success: true,
                    message: 'Token refreshed successfully',
                    authorization: newToken,
                    sessionData: sessionData
                });
            } else {
                // Nếu không có token trong session, thử lấy từ headers
                const authHeader = response.headers.get('authorization');
                if (authHeader) {
                    console.log('🔑 New token extracted from headers');
                    res.json({
                        success: true,
                        message: 'Token refreshed successfully',
                        authorization: authHeader,
                        sessionData: sessionData
                    });
                } else {
                    res.json({
                        success: true,
                        message: 'Session refreshed but no new token found',
                        sessionData: sessionData
                    });
                }
            }
        } else {
            console.log('❌ Failed to refresh session');
            res.status(401).json({
                success: false,
                message: 'Failed to refresh token. Cookies may be expired.',
                needsNewCookies: true
            });
        }

    } catch (error) {
        console.error('❌ Error refreshing token:', error);
        res.status(500).json({
            success: false,
            message: 'Error refreshing token',
            error: error.message
        });
    }
});

// API endpoint để lấy token mới từ Google Labs
app.post('/api/get-new-token', async (req, res) => {
    try {
        const { cookies } = req.body;
        
        if (!cookies) {
            return res.status(400).json({
                success: false,
                message: 'Cookies required to get new token'
            });
        }

        console.log('🔑 Getting new token from Google Labs session...');

        // Sử dụng session endpoint để lấy token mới
        const sessionResponse = await fetch('https://labs.google/fx/api/auth/session', {
            method: 'GET',
            headers: {
                'accept': '*/*',
                'accept-language': 'vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6',
                'content-type': 'application/json',
                'priority': 'u=1, i',
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'cookie': cookies
            },
            referrer: 'https://labs.google/fx/tools/flow/project/f6dc28c9-5dda-480d-a363-6114365e1a6a',
            credentials: 'include'
        });

        console.log(`📊 Session response status: ${sessionResponse.status}`);
        
        if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            console.log('✅ Session data obtained');
            
            // Thử lấy token từ session data
            if (sessionData && sessionData.access_token) {
                const newToken = `Bearer ${sessionData.access_token}`;
                console.log('✅ New token extracted from session');
                
                // Cập nhật cookies và thời gian hết hạn
                currentCookies = cookies;
                tokenExpiryTime = Date.now() + (1.5 * 60 * 60 * 1000); // 1.5 giờ
                
                // Lưu vào file
                saveStorageData();
                
                // Cập nhật file cookies.json gốc
                updateCookiesJsonFile(cookies);
                
                res.json({
                    success: true,
                    message: 'New token obtained successfully',
                    authorization: newToken,
                    sessionData: sessionData
                });
            } else {
                // Nếu không có token trong session, thử lấy từ headers
                const authHeader = sessionResponse.headers.get('authorization');
                if (authHeader) {
                    console.log('✅ New token extracted from headers');
                    
                    // Cập nhật cookies và thời gian hết hạn
                    currentCookies = cookies;
                    tokenExpiryTime = Date.now() + (1.5 * 60 * 60 * 1000); // 1.5 giờ
                    
                    // Lưu vào file
                    saveStorageData();
                    
                    // Cập nhật file cookies.json gốc
                    updateCookiesJsonFile(cookies);
                    
                    res.json({
                        success: true,
                        message: 'New token obtained successfully',
                        authorization: authHeader,
                        sessionData: sessionData
                    });
                } else {
                    res.status(401).json({
                        success: false,
                        message: 'Session obtained but no token found. Cookies may be invalid.',
                        sessionData: sessionData
                    });
                }
            }
        } else if (sessionResponse.status === 304) {
            console.log('⚠️ Session not modified (304) - cookies may be valid but session unchanged');
            res.status(401).json({
                success: false,
                message: 'Session not modified. Cookies may be valid but no new session data available.',
                status: sessionResponse.status
            });
        } else {
            console.log(`❌ Session request failed with status: ${sessionResponse.status}`);
            const errorText = await sessionResponse.text();
            console.log(`❌ Error response: ${errorText}`);
            
            res.status(401).json({
                success: false,
                message: 'Could not obtain session. Cookies may be invalid.',
                status: sessionResponse.status,
                error: errorText
            });
        }

    } catch (error) {
        console.error('❌ Error getting new token:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting new token',
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`📝 API endpoints:`);
    console.log(`   POST /api/create-video - Tạo video từ text`);
    console.log(`   POST /api/check-status - Kiểm tra trạng thái video`);
    console.log(`   GET  /api/history - Xem lịch sử requests`);
    console.log(`   DELETE /api/history - Xóa lịch sử`);
    console.log(`   GET  /api/token-status - Kiểm tra trạng thái token`);
    console.log(`   POST /api/refresh-token - Làm mới token`);
    console.log(`   POST /api/get-new-token - Lấy token mới từ cookies`);
    
    // Load storage data on startup
    loadStorageData();
});

module.exports = app;
