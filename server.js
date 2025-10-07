const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const url = require('url');

const app = express();
const PORT = 8888;

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
// Track downloaded operations to prevent duplicate downloads
let downloadedOperations = new Set();
// Map operation -> prompt for traceability
const operationToPrompt = new Map();
// Map operation -> last logged status to reduce log noise
const operationLastStatus = new Map();

// Helper: normalize any input (string/object/array/number) to a text prompt
function normalizeInputToPrompt(input, defaultValue = 'cat') {
    if (input === undefined || input === null) {
        return defaultValue;
    }
    if (typeof input === 'string') {
        return input.trim() || defaultValue;
    }
    try {
        // Compact JSON to a single-line string for use as text prompt
        return JSON.stringify(input);
    } catch (_) {
        return String(input);
    }
}

// Auto batch poll config
const AUTO_BATCH_POLL = process.env.AUTO_BATCH_POLL !== 'false';
const AUTO_BATCH_INTERVAL_MS = Number(process.env.AUTO_BATCH_INTERVAL_MS || 15000);
let isBatchPolling = false;

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
            downloadedOperations = new Set(data.downloadedOperations || []);
            
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
            downloadedOperations: Array.from(downloadedOperations),
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
                    'if-none-match': '"4342okzyx0hz"',
                    'priority': 'u=1, i',
                    'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'cookie': currentCookies
                },
                referrer: 'https://labs.google/fx/tools/flow/project/42bd5064-e313-4f9e-9a0c-40865bf79b88',
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

// API endpoint để tạo video từ text (chỉ nhận prompt, còn lại mặc định)
app.post('/api/create-video', async (req, res) => {
    try {
        // Cho phép client gửi "input" là JSON hoặc text; chuyển thành text prompt
        const rawInput = (req.body && (req.body.input !== undefined ? req.body.input : req.body.prompt)) ?? 'cat';
        const prompt = normalizeInputToPrompt(rawInput, 'cat');

        const aspectRatio = 'VIDEO_ASPECT_RATIO_PORTRAIT';
        const videoModel = 'veo_3_0_t2v_portrait';
        const authorization = process.env.LABS_AUTH || 'Bearer ya29.a0AQQ_BDSnBX7lJ4bxR-J3fc9-iXuwJd1NKbx1qdOUG6_Fw0j8h65RMxSd5pjjYqupyAcjY0xieKFByxiTIUtxYh8RnM_6tVf8UdHKeoSkhdrAClhNdO_CBa94faAQo_Rq2Y66mIu7YVavsoutsn7UvpTTNfVaXfwbaI6JnJn-TyOb5w8pP_TULOP8uxWNaH7ojKdLwVbAqcBe0Vd3J51hpz4Wp1E2oYvRaxxh7qMIna5ve2tJ3AiJIhBEEvDUjbiksBr3c1Vtun1GaViob2AL-gOxyuAIxW9SrWz4gHxbqL9TFcF1taS5qg42GKjKq5b86VkmSjXC3Le4P80e8FoXZTzZK6ZLrfxC6j9F2XnbnxeJaCgYKAY8SARYSFQHGX2MiwvuTZP7Xac8hSylpUmwIqQ0371';

        console.log(`🎬 Tạo video với prompt: "${prompt}"`);

        // Tạo request body (mặc định cho mọi thông số ngoài prompt)
        const requestBody = {
            clientContext: {
                projectId: "42bd5064-e313-4f9e-9a0c-40865bf79b88",
                tool: "PINHOLE",
                userPaygateTier: "PAYGATE_TIER_TWO"
            },
            requests: [{
                aspectRatio: aspectRatio,
                seed: Math.floor(Math.random() * 100000),
                textInput: {
                    prompt: prompt
                },
                videoModelKey: videoModel,
                metadata: {
                    sceneId: crypto.randomUUID()
                }
            }]
        };

        console.log('🧾 Create request body (sent to Labs):', JSON.stringify(requestBody, null, 2));

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
        // Log đầy đủ phản hồi gốc từ Google Labs cho request tạo video
        try {
            console.log('🧾 Create response (raw from Labs):');
            console.log(JSON.stringify(responseData, null, 2));
            // Đồng thời lưu ra file để dễ xem nếu console bị cắt bớt
            const logsDir = path.join(__dirname, 'logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
            const opName = (responseData.operations && responseData.operations[0] && responseData.operations[0].operation && responseData.operations[0].operation.name) || 'unknown_operation';
            const fileName = `create-response-${Date.now()}-${opName}.json`;
            fs.writeFileSync(path.join(logsDir, fileName), JSON.stringify(responseData, null, 2));
            console.log(`📝 Saved create response to logs/${fileName}`);
        } catch (logError) {
            console.error('❌ Error saving logs:', logError);
        }

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
            // Map operation -> prompt để đối chiếu
            operationToPrompt.set(currentOperationName, prompt);
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
        // Persist history immediately so auto-poll survives restarts
        saveStorageData();

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

        // Cho phép truyền operationName để hỗ trợ nhiều yêu cầu song song
        const { operationName: opFromClient } = req.body || {};
        // Sử dụng operation name từ client nếu có, nếu không dùng cái đang lưu gần nhất
        const operationName = opFromClient || currentOperationName || null;
        if (!operationName) {
            return res.status(400).json({
                success: false,
                message: 'operationName is required',
            });
        }
        const sceneId = 'de9f5b99-d622-4082-86ee-6328493bf4f3';
        const authorization = process.env.LABS_AUTH || 'Bearer ya29.a0AQQ_BDSnBX7lJ4bxR-J3fc9-iXuwJd1NKbx1qdOUG6_Fw0j8h65RMxSd5pjjYqupyAcjY0xieKFByxiTIUtxYh8RnM_6tVf8UdHKeoSkhdrAClhNdO_CBa94faAQo_Rq2Y66mIu7YVavsoutsn7UvpTTNfVaXfwbaI6JnJn-TyOb5w8pP_TULOP8uxWNaH7ojKdLwVbAqcBe0Vd3J51hpz4Wp1E2oYvRaxxh7qMIna5ve2tJ3AiJIhBEEvDUjbiksBr3c1Vtun1GaViob2AL-gOxyuAIxW9SrWz4gHxbqL9TFcF1taS5qg42GKjKq5b86VkmSjXC3Le4P80e8FoXZTzZK6ZLrfxC6j9F2XnbnxeJaCgYKAY8SARYSFQHGX2MiwvuTZP7Xac8hSylpUmwIqQ0371';

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
        // no-op: will log selectively below
        } else if (responseData.operations && responseData.operations.length > 0) {
            videoResponse = responseData.operations[0];
            // no-op: will log selectively below
        }
        
        // Debug: Log toàn bộ response để kiểm tra
        console.log(`🔍 Full response for operation ${operationName}:`, JSON.stringify(responseData, null, 2));
        
        // Tìm đúng operation trong response dựa trên operationName
        if (responseData.operations && responseData.operations.length > 0) {
            console.log(`🔍 Looking for operation: ${operationName}`);
            console.log(`🔍 Available operations:`, responseData.operations.map(op => op.operation?.name));
            
            const targetOperation = responseData.operations.find(op => 
                op.operation && op.operation.name === operationName
            );
            
            if (targetOperation) {
                videoResponse = targetOperation;
                console.log(`✅ Found target operation ${operationName}:`, targetOperation.status);
            } else {
                console.log(`❌ Operation ${operationName} not found in response!`);
                console.log(`📋 Available operations:`, responseData.operations.map(op => ({
                    name: op.operation?.name,
                    status: op.status
                })));
                // Không dùng operation khác, trả về PENDING
                videoResponse = null;
            }
        }
        
        if (videoResponse) {
            const last = operationLastStatus.get(operationName);
            if (last !== videoResponse.status) {
                console.log(`🎬 ${operationName} -> ${videoResponse.status}`);
                operationLastStatus.set(operationName, videoResponse.status);
            }
            
            if (videoResponse.status === 'MEDIA_GENERATION_STATUS_COMPLETED' || 
                videoResponse.status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL') {
                status = 'COMPLETED';
                
                // Tìm video URL trong response
                if (videoResponse.videoUrl) {
                    videoUrl = videoResponse.videoUrl;
                    console.log(`🎥 Found video URL directly: ${videoUrl}`);
                } else if (videoResponse.video && videoResponse.video.url) {
                    videoUrl = videoResponse.video.url;
                    console.log(`🎥 Found video URL in video.url: ${videoUrl}`);
                } else if (videoResponse.mediaUrl) {
                    videoUrl = videoResponse.mediaUrl;
                    console.log(`🎥 Found video URL in mediaUrl: ${videoUrl}`);
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
                
                if (videoUrl) {
                    console.log(`✅ Video ready for operation ${operationName}: ${videoUrl}`);
                } else {
                    console.log(`⚠️ No video URL found for operation ${operationName}`);
                }
            } else if (videoResponse.status === 'MEDIA_GENERATION_STATUS_FAILED') {
                status = 'FAILED';
                if (videoResponse.error) {
                    errorMessage = videoResponse.error.message;
                }
                console.log(`❌ Video failed for operation ${operationName}: ${errorMessage}`);
            } else {
                console.log(`⏳ Video still processing for operation ${operationName}: ${videoResponse.status}`);
            }
        } else {
            console.log(`⚠️ No video response found for operation ${operationName}`);
        }

        console.log(`📊 Final status: ${status}, URL: ${videoUrl ? 'Found' : 'Not found'}`);

        // Nếu client truyền operationName thì không can thiệp biến toàn cục
        // Giữ nguyên currentOperationName để không ảnh hưởng các request khác đang chạy

        // Nếu video hoàn thành, tải video về máy
        let downloadInfo = null;
            if (status === 'COMPLETED' && videoUrl && operationName) {
            if (downloadedOperations.has(operationName)) {
                console.log(`⚠️ Video for operation ${operationName} already downloaded, skipping.`);
            } else {
            try {
                downloadInfo = await downloadVideo(videoUrl, operationName);
                downloadedOperations.add(operationName);
                // Persist state so we don't redownload after restart
                saveStorageData();
            } catch (error) {
                console.error('❌ Lỗi tải video:', error);
                downloadInfo = { success: false, error: error.message };
            }
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
            operationName: operationName,
            prompt: operationToPrompt.get(operationName) || null,
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

// API endpoint batch: kiểm tra nhiều operation cùng lúc và tải về nếu hoàn tất
app.post('/api/check-status-batch', async (req, res) => {
    try {
        await checkAndRefreshTokenIfNeeded();

        const { operationNames } = req.body || {};

        // Nếu không truyền, tự gom tất cả operation đã từng tạo nhưng chưa tải về
        let targets = Array.isArray(operationNames) && operationNames.length > 0
            ? operationNames
            : Array.from(new Set(
                (requestHistory || [])
                    .map(r => r.operationName)
                    .filter(Boolean)
                    .filter(name => !downloadedOperations.has(name))
              ));

        if (!targets || targets.length === 0) {
            return res.json({
                success: true,
                message: 'No operations to check',
                items: []
            });
        }

        const sceneId = 'de9f5b99-d622-4082-86ee-6328493bf4f3';
        const authorization = process.env.LABS_AUTH || 'Bearer ya29.a0AQQ_BDSnBX7lJ4bxR-J3fc9-iXuwJd1NKbx1qdOUG6_Fw0j8h65RMxSd5pjjYqupyAcjY0xieKFByxiTIUtxYh8RnM_6tVf8UdHKeoSkhdrAClhNdO_CBa94faAQo_Rq2Y66mIu7YVavsoutsn7UvpTTNfVaXfwbaI6JnJn-TyOb5w8pP_TULOP8uxWNaH7ojKdLwVbAqcBe0Vd3J51hpz4Wp1E2oYvRaxxh7qMIna5ve2tJ3AiJIhBEEvDUjbiksBr3c1Vtun1GaViob2AL-gOxyuAIxW9SrWz4gHxbqL9TFcF1taS5qg42GKjKq5b86VkmSjXC3Le4P80e8FoXZTzZK6ZLrfxC6j9F2XnbnxeJaCgYKAY8SARYSFQHGX2MiwvuTZP7Xac8hSylpUmwIqQ0371';

        console.log(`🔍 Batch checking ${targets.length} operations`);

        const requestBody = {
            operations: targets.map(name => ({
                operation: { name },
                sceneId: sceneId,
                status: 'MEDIA_GENERATION_STATUS_PENDING'
            }))
        };

        const response = await fetch(`${GOOGLE_LABS_CONFIG.baseUrl}/video:batchCheckAsyncVideoGenerationStatus`, {
            method: 'POST',
            headers: { ...GOOGLE_LABS_CONFIG.headers, 'authorization': authorization },
            body: JSON.stringify(requestBody)
        });

        const responseData = await response.json();

        if (response.status === 401 || (responseData.error && responseData.error.message && responseData.error.message.includes('token'))) {
            return res.status(401).json({
                success: false,
                message: 'Authorization token expired. Please update your token in the form.',
                error: 'TOKEN_EXPIRED',
                needsNewToken: true
            });
        }

        const operations = Array.isArray(responseData.operations) ? responseData.operations : [];
        const byName = new Map();
        for (const op of operations) {
            const name = op && op.operation && op.operation.name;
            if (name) byName.set(name, op);
        }

        const results = [];
        for (const name of targets) {
            const op = byName.get(name);
            let status = 'PENDING';
            let videoUrl = null;
            let errorMessage = null;

            if (op) {
                const last = operationLastStatus.get(name);
                if (last !== op.status) {
                    console.log(`🎬 ${name} -> ${op.status}`);
                    operationLastStatus.set(name, op.status);
                }

                if (op.status === 'MEDIA_GENERATION_STATUS_COMPLETED' || op.status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL') {
                    status = 'COMPLETED';
                    // Tìm url
                    if (op.videoUrl) videoUrl = op.videoUrl;
                    else if (op.video && op.video.url) videoUrl = op.video.url;
                    else if (op.mediaUrl) videoUrl = op.mediaUrl;
                    else if (op.operation && op.operation.metadata && op.operation.metadata.video) {
                        const videoData = op.operation.metadata.video;
                        if (videoData.fifeUrl) videoUrl = videoData.fifeUrl;
                        else if (videoData.servingBaseUri) videoUrl = videoData.servingBaseUri;
                    }
                } else if (op.status === 'MEDIA_GENERATION_STATUS_FAILED') {
                    status = 'FAILED';
                    errorMessage = op.error ? op.error.message : null;
                }
            }

            let downloadInfo = null;
            if (status === 'COMPLETED' && videoUrl && name) {
                if (downloadedOperations.has(name)) {
                    console.log(`⚠️ Video for operation ${name} already downloaded, skipping.`);
                } else {
                    try {
                        downloadInfo = await downloadVideo(videoUrl, name);
                        downloadedOperations.add(name);
                        // Persist to avoid redownloads after restart
                        saveStorageData();
                    } catch (e) {
                        console.error('❌ Lỗi tải video:', e);
                        downloadInfo = { success: false, error: e.message };
                    }
                }
            }

            results.push({
                operationName: name,
                videoStatus: status,
                videoUrl,
                errorMessage,
                downloadInfo,
                prompt: operationToPrompt.get(name) || null
            });
        }

        res.json({
            success: true,
            status: response.status,
            items: results
        });
    } catch (error) {
        console.error('❌ Error batch checking status:', error);
        res.status(500).json({
            success: false,
            message: 'Error batch checking video status',
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
            referrer: 'https://labs.google/fx/tools/flow/project/42bd5064-e313-4f9e-9a0c-40865bf79b88',
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
            referrer: 'https://labs.google/fx/tools/flow/project/42bd5064-e313-4f9e-9a0c-40865bf79b88',
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

    // Auto background batch poll unfinished operations
    if (AUTO_BATCH_POLL) {
        console.log(`⏱️ Auto batch polling enabled (interval ${AUTO_BATCH_INTERVAL_MS} ms)`);
        setInterval(async () => {
            if (isBatchPolling) return; // avoid overlap
            isBatchPolling = true;
            try {
                // Tập các operation chưa tải về trong history
                const pending = Array.from(new Set(
                    (requestHistory || [])
                        .map(r => r.operationName)
                        .filter(Boolean)
                        .filter(name => !downloadedOperations.has(name))
                ));

                if (pending.length === 0) {
                    isBatchPolling = false;
                    return;
                }

                console.log(`⏱️ Auto batch polling ${pending.length} operations...`);

                const sceneId = 'de9f5b99-d622-4082-86ee-6328493bf4f3';
                const authorization = process.env.LABS_AUTH || 'Bearer ya29.a0AQQ_BDSnBX7lJ4bxR-J3fc9-iXuwJd1NKbx1qdOUG6_Fw0j8h65RMxSd5pjjYqupyAcjY0xieKFByxiTIUtxYh8RnM_6tVf8UdHKeoSkhdrAClhNdO_CBa94faAQo_Rq2Y66mIu7YVavsoutsn7UvpTTNfVaXfwbaI6JnJn-TyOb5w8pP_TULOP8uxWNaH7ojKdLwVbAqcBe0Vd3J51hpz4Wp1E2oYvRaxxh7qMIna5ve2tJ3AiJIhBEEvDUjbiksBr3c1Vtun1GaViob2AL-gOxyuAIxW9SrWz4gHxbqL9TFcF1taS5qg42GKjKq5b86VkmSjXC3Le4P80e8FoXZTzZK6ZLrfxC6j9F2XnbnxeJaCgYKAY8SARYSFQHGX2MiwvuTZP7Xac8hSylpUmwIqQ0371';

                // Best-effort refresh before polling
                try { await checkAndRefreshTokenIfNeeded(); } catch (_) {}

                const requestBody = {
                    operations: pending.map(name => ({
                        operation: { name },
                        sceneId: sceneId,
                        status: 'MEDIA_GENERATION_STATUS_PENDING'
                    }))
                };

                const response = await fetch(`${GOOGLE_LABS_CONFIG.baseUrl}/video:batchCheckAsyncVideoGenerationStatus`, {
                    method: 'POST',
                    headers: { ...GOOGLE_LABS_CONFIG.headers, 'authorization': authorization },
                    body: JSON.stringify(requestBody)
                });

                const responseData = await response.json();
                const operations = Array.isArray(responseData.operations) ? responseData.operations : [];
                const byName = new Map();
                for (const op of operations) {
                    const name = op && op.operation && op.operation.name;
                    if (name) byName.set(name, op);
                }

                for (const name of pending) {
                    const op = byName.get(name);
                    if (!op) continue;

                    if (op.status === 'MEDIA_GENERATION_STATUS_COMPLETED' || op.status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL') {
                        let videoUrl = null;
                        if (op.videoUrl) videoUrl = op.videoUrl;
                        else if (op.video && op.video.url) videoUrl = op.video.url;
                        else if (op.mediaUrl) videoUrl = op.mediaUrl;
                        else if (op.operation && op.operation.metadata && op.operation.metadata.video) {
                            const videoData = op.operation.metadata.video;
                            if (videoData.fifeUrl) videoUrl = videoData.fifeUrl;
                            else if (videoData.servingBaseUri) videoUrl = videoData.servingBaseUri;
                        }

                        if (videoUrl && !downloadedOperations.has(name)) {
                            try {
                                await downloadVideo(videoUrl, name);
                                downloadedOperations.add(name);
                                saveStorageData();
                            } catch (e) {
                                console.error('❌ Auto-poll download error:', e);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('❌ Auto batch poll error:', e);
            } finally {
                isBatchPolling = false;
            }
        }, AUTO_BATCH_INTERVAL_MS);
    } else {
        console.log('⏱️ Auto batch polling disabled');
    }
});

module.exports = app;
