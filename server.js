const express = require('express');
const compression = require('compression');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const url = require('url');
const { uploadToYouTube } = require('./youtube-upload');
const ChromeProfileManager = require('./chrome-profile-manager');
const ChromeProfileUtils = require('./chrome-profile-utils');
const LabsProfileManager = require('./labs-profile-manager');

const app = express();
const PORT = Number(process.env.PORT || 8888);

// Load environment variables from env.local (simple parser)
try {
    const envLocalPath = path.join(__dirname, 'env.local');
    if (fs.existsSync(envLocalPath)) {
        const lines = fs.readFileSync(envLocalPath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
            if (!line || line.trim().startsWith('#')) continue;
            const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
            if (match) {
                const key = match[1];
                const value = match[2];
                if (typeof process.env[key] === 'undefined' || process.env[key] === '') {
                    process.env[key] = value;
                }
            }
        }
        console.log('🔧 Loaded environment from env.local');
    }
} catch (e) {
    console.error('❌ Failed to load env.local:', e);
}

// Middleware
app.use(cors());
app.use(compression({ level: 6 }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static cache controls
const staticOptions = {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (/(?:\.js|\.css|\.png|\.jpg|\.jpeg|\.gif|\.svg|\.webp|\.ico|\.woff2?|\.ttf)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        }
    }
};
app.use(express.static('public', staticOptions));

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
const AUTO_BATCH_QUIET_MODE = process.env.AUTO_BATCH_QUIET_MODE === 'true';
let isBatchPolling = false;

// File paths for persistent storage
const STORAGE_FILE = path.join(__dirname, 'server-storage.json');

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

// Hàm lấy Labs cookies
async function getLabsCookies() {
    try {
        // Đọc từ file labs-cookies.txt
        const fs = require('fs');
        const path = require('path');
        const labsCookiesFile = path.join(__dirname, 'labs-cookies.txt');
        
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

// Optimized ranged streaming for large video files in /public/videos
app.get('/videos/:file', (req, res) => {
    try {
        const fileName = req.params.file;
        const videoPath = path.join(__dirname, 'public', 'videos', path.basename(fileName));

        if (!fs.existsSync(videoPath)) {
            return res.status(404).end();
        }

        const stat = fs.statSync(videoPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Type', 'video/mp4');

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = (end - start) + 1;

            if (start >= fileSize || end >= fileSize || start > end) {
                res.setHeader('Content-Range', `bytes */${fileSize}`);
                return res.status(416).end();
            }

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Content-Length': chunkSize
            });
            const stream = fs.createReadStream(videoPath, { start, end });
            stream.pipe(res);
        } else {
            res.writeHead(200, { 'Content-Length': fileSize });
            const stream = fs.createReadStream(videoPath);
            stream.pipe(res);
        }
    } catch (e) {
        console.error('❌ Video stream error:', e);
        res.status(500).end();
    }
});

// API endpoint để tạo video từ text (chỉ nhận prompt, còn lại mặc định)
app.post('/api/create-video', async (req, res) => {
    try {
        // Cho phép client gửi "input" là JSON hoặc text; chuyển thành text prompt
        const rawInput = (req.body && (req.body.input !== undefined ? req.body.input : req.body.prompt)) ?? 'cat';
        const prompt = normalizeInputToPrompt(rawInput, 'cat');

        const aspectRatio = 'VIDEO_ASPECT_RATIO_PORTRAIT';
        const videoModel = 'veo_3_0_t2v_fast_portrait_ultra';
        // Tự động lấy cookies mới từ Chrome Labs
        console.log(`🔄 Tự động lấy cookies mới từ Chrome Labs...`);
        const extractResult = await labsProfileManager.extractLabsCookies();
        
        if (!extractResult.success) {
            return res.status(400).json({
                success: false,
                message: `Không thể lấy cookies từ Chrome Labs: ${extractResult.error}`
            });
        }
        
        const labsCookies = extractResult.cookies;
        console.log(`🍪 Labs cookies mới:`, labsCookies ? 'Found' : 'Not found');
        console.log(`🍪 Số lượng cookies: ${extractResult.cookieCount}`);
        
        // Cập nhật thời gian lấy cookies
        labsProfileManager.lastExtractTime = new Date().toISOString();
        
        // Cập nhật currentCookies và lưu file
        currentCookies = labsCookies;
        tokenExpiryTime = Date.now() + (1.5 * 60 * 60 * 1000); // 1.5 giờ
        saveStorageData();
        
        // Lưu cookies vào file riêng
        labsProfileManager.saveLabsCookies(labsCookies);

        console.log(`🎬 Tạo video với prompt: "${prompt}"`);
        console.log(`🍪 Sử dụng Labs cookies: ${labsCookies.substring(0, 100)}...`);

        // Tạo request body (mặc định cho mọi thông số ngoài prompt)
        const requestBody = {
            clientContext: {
                projectId: "3ff8dd21-100f-444d-ba29-952225ae0d28", // Project ID mới từ F12
                tool: "PINHOLE",
                userPaygateTier: "PAYGATE_TIER_TWO"
            },
            requests: [{
                aspectRatio: aspectRatio,
                seed: Math.floor(Math.random() * 100000),
                textInput: {
                    prompt: prompt
                },
                videoModelKey: "veo_3_1_t2v_fast_portrait_ultra", // Veo 3.1 thay vì 3.0
                metadata: {
                    sceneId: crypto.randomUUID()
                }
            }]
        };

        console.log('🧾 Create request body (sent to Labs):', JSON.stringify(requestBody, null, 2));

        // Thử lấy token thực sự từ session endpoint
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
            
            // Tìm token trong session data
            if (sessionData && sessionData.user && sessionData.user.accessToken) {
                authToken = `Bearer ${sessionData.user.accessToken}`;
            } else if (sessionData && sessionData.access_token) {
                authToken = `Bearer ${sessionData.access_token}`;
            }
        }
        
        // Gọi Google Labs API với token hoặc cookies
        const response = await fetch(`${GOOGLE_LABS_CONFIG.baseUrl}/video:batchAsyncGenerateVideoText`, {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'accept-language': 'vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6',
                'content-type': 'text/plain;charset=UTF-8', // Content-type từ F12
                'priority': 'u=1, i',
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'x-client-data': 'CLnnygE=', // Client data từ F12
                'Cookie': labsCookies,
                ...(authToken && { 'Authorization': authToken })
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
        // Sử dụng Labs cookies thay vì token cũ
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
        const operationName = opFromClient || currentOperationName || null;
        if (!operationName) {
            return res.status(400).json({
                success: false,
                message: 'operationName is required',
            });
        }
        const sceneId = '361d647b-e22b-4477-acc1-fe3aa18b5b68';

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
                'Cookie': labsCookies,
                ...(authToken && { 'Authorization': authToken })
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
        // Sử dụng Labs cookies thay vì token cũ
        const labsCookies = await getLabsCookies();
        if (!labsCookies) {
            return res.status(400).json({
                success: false,
                message: 'Chưa có Labs cookies. Vui lòng mở Chrome Labs và lấy cookies trước.'
            });
        }

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

        const sceneId = '361d647b-e22b-4477-acc1-fe3aa18b5b68';

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
            headers: { ...GOOGLE_LABS_CONFIG.headers, 'Cookie': labsCookies },
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
    console.log(`   POST /api/upload-youtube - Upload video lên YouTube`);
    console.log(`   POST /api/create-profile - Tạo Chrome profile mới`);
    console.log(`   GET  /api/list-profiles - Liệt kê Chrome profiles`);
    console.log(`   POST /api/check-youtube-login - Kiểm tra đăng nhập YouTube`);
    console.log(`   POST /api/check-labs-login - Kiểm tra đăng nhập Google Labs`);
    console.log(`   POST /api/open-profile-login - Mở profile để đăng nhập`);
    console.log(`   POST /api/delete-profile - Xóa Chrome profile`);
    console.log(`   GET  /api/list-videos - Liệt kê video files`);
    console.log(`   GET  /api/history - Xem lịch sử requests`);
    console.log(`   DELETE /api/history - Xóa lịch sử`);
    console.log(`   GET  /api/token-status - Kiểm tra trạng thái token`);
    console.log(`   POST /api/extract-cookies - Tự động lấy cookies từ profile`);
    console.log(`   POST /api/extract-cookies-all - Lấy cookies từ tất cả profiles`);
    console.log(`   POST /api/open-labs-browser - Mở Chrome Labs riêng biệt`);
    console.log(`   POST /api/extract-labs-cookies - Lấy cookies từ Labs browser`);
    console.log(`   POST /api/test-labs-cookies - Test Labs cookies`);
    console.log(`   POST /api/close-labs-browser - Đóng Labs browser`);
    console.log(`   GET  /api/labs-profile-info - Thông tin Labs profile`);
    
    // Load storage data on startup
    loadStorageData();

    // Auto background batch poll unfinished operations
    if (AUTO_BATCH_POLL) {
        console.log(`⏱️ Auto batch polling enabled (interval ${AUTO_BATCH_INTERVAL_MS} ms)`);
        if (AUTO_BATCH_QUIET_MODE) {
            console.log(`🔇 Quiet mode enabled - reduced logging`);
        }
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

                // Chỉ log khi không ở chế độ quiet hoặc lần đầu
                if (!AUTO_BATCH_QUIET_MODE && (!global.lastPollingLog || Date.now() - global.lastPollingLog > 60000)) {
                    console.log(`⏱️ Auto batch polling ${pending.length} operations...`);
                    global.lastPollingLog = Date.now();
                }

                const sceneId = '361d647b-e22b-4477-acc1-fe3aa18b5b68';
                
                // Sử dụng Labs cookies thay vì token cũ
                const labsCookies = await getLabsCookies();
                if (!labsCookies) {
                    console.log('⚠️ Không có Labs cookies, bỏ qua auto polling');
                    return;
                }

                const requestBody = {
                    operations: pending.map(name => ({
                        operation: { name },
                        sceneId: sceneId,
                        status: 'MEDIA_GENERATION_STATUS_PENDING'
                    }))
                };

                const response = await fetch(`${GOOGLE_LABS_CONFIG.baseUrl}/video:batchCheckAsyncVideoGenerationStatus`, {
                    method: 'POST',
                    headers: { ...GOOGLE_LABS_CONFIG.headers, 'Cookie': labsCookies },
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
                                console.log(`📥 Auto-downloading video: ${name}`);
                                await downloadVideo(videoUrl, name);
                                downloadedOperations.add(name);
                                saveStorageData();
                                console.log(`✅ Auto-download completed: ${name}`);
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
        }, AUTO_BATCH_INTERVAL_MS).unref();
    } else {
        console.log('⏱️ Auto batch polling disabled');
    }
});

// API: Upload video lên YouTube bằng Puppeteer
app.post('/api/upload-youtube', async (req, res) => {
    try {
        const { 
            videoPath, 
            title, 
            description, 
            visibility, 
            debug, 
            profileName,
            customUserAgent,
            customViewport 
        } = req.body || {};
        
        if (!videoPath) {
            return res.status(400).json({ success: false, message: 'videoPath is required' });
        }
        
        const absPath = path.isAbsolute(videoPath) ? videoPath : path.join(__dirname, videoPath);
        const result = await uploadToYouTube({
            videoPath: absPath,
            title,
            description,
            visibility: visibility || 'UNLISTED',
            debugMode: Boolean(debug),
            profileName: profileName || 'Default',
            customUserAgent,
            customViewport
        });
        
        if (result.success) {
            return res.json({ 
                success: true, 
                videoId: result.videoId, 
                url: result.url, 
                status: result.status,
                logs: result.logs 
            });
        }
        
        return res.status(500).json({ success: false, error: result.error, logs: result.logs });
    } catch (e) {
        console.error('❌ Upload YouTube error:', e);
        res.status(500).json({ success: false, message: 'Upload failed', error: e.message });
    }
});

// ===== CHROME PROFILE MANAGEMENT APIs =====

// Khởi tạo Chrome Profile Utils
const profileUtils = new ChromeProfileUtils();

// Khởi tạo Labs Profile Manager
const labsProfileManager = new LabsProfileManager();

// API: Tạo Chrome profile mới
app.post('/api/create-profile', async (req, res) => {
    try {
        const { profileName } = req.body || {};
        if (!profileName) {
            return res.status(400).json({ success: false, message: 'profileName is required' });
        }
        
        const profilePath = profileUtils.createYouTubeProfile(profileName);
        res.json({ success: true, message: `Profile ${profileName} created`, profilePath });
    } catch (error) {
        console.error('❌ Create profile error:', error);
        res.status(500).json({ success: false, message: 'Error creating profile', error: error.message });
    }
});

// API: Liệt kê Chrome profiles
app.get('/api/list-profiles', async (req, res) => {
    try {
        const profiles = profileUtils.listAllProfiles();
        res.json({ success: true, profiles });
    } catch (error) {
        console.error('❌ List profiles error:', error);
        res.status(500).json({ success: false, message: 'Error listing profiles', error: error.message });
    }
});

// API: Kiểm tra đăng nhập YouTube
app.post('/api/check-youtube-login', async (req, res) => {
    try {
        const { profileName = 'Default' } = req.body || {};
        const isLoggedIn = await profileUtils.checkYouTubeLogin(profileName);
        res.json({ success: true, isLoggedIn, profileName });
    } catch (error) {
        console.error('❌ Check YouTube login error:', error);
        res.status(500).json({ success: false, message: 'Error checking YouTube login', error: error.message });
    }
});

// API: Kiểm tra đăng nhập Google Labs
app.post('/api/check-labs-login', async (req, res) => {
    try {
        const { profileName = 'Default' } = req.body || {};
        const isLoggedIn = await profileUtils.checkLabsLogin(profileName);
        res.json({ success: true, isLoggedIn, profileName });
    } catch (error) {
        console.error('❌ Check Labs login error:', error);
        res.status(500).json({ success: false, message: 'Error checking Labs login', error: error.message });
    }
});

// API: Mở profile để đăng nhập thủ công
app.post('/api/open-profile-login', async (req, res) => {
    try {
        const { profileName = 'Default', url = 'https://www.youtube.com' } = req.body || {};
        const success = await profileUtils.openProfileForLogin(profileName, url);
        res.json({ success, message: `Profile ${profileName} opened for login` });
    } catch (error) {
        console.error('❌ Open profile login error:', error);
        res.status(500).json({ success: false, message: 'Error opening profile', error: error.message });
    }
});

// ===== LABS PROFILE MANAGEMENT APIs =====

// API: Mở Chrome Labs riêng biệt
app.post('/api/open-labs-browser', async (req, res) => {
    try {
        console.log('🚀 Opening Labs browser...');
        
        const success = await labsProfileManager.openLabsBrowser();
        
        if (success) {
            res.json({
                success: true,
                message: 'Labs browser opened successfully',
                profileInfo: labsProfileManager.getLabsProfileInfo()
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to open Labs browser'
            });
        }
        
    } catch (error) {
        console.error('❌ Open Labs browser error:', error);
        res.status(500).json({
            success: false,
            message: 'Error opening Labs browser',
            error: error.message
        });
    }
});

// API: Lấy cookies từ Labs browser
app.post('/api/extract-labs-cookies', async (req, res) => {
    try {
        console.log('🍪 Extracting cookies from Labs browser...');
        
        if (!labsProfileManager.isLabsBrowserOpen()) {
            return res.status(400).json({
                success: false,
                message: 'Labs browser is not open. Please open it first.'
            });
        }
        
        const result = await labsProfileManager.extractLabsCookies();
        
        if (result.success) {
            // Cập nhật currentCookies
            currentCookies = result.cookies;
            tokenExpiryTime = Date.now() + (1.5 * 60 * 60 * 1000); // 1.5 giờ
            
            // Cập nhật thời gian lấy cookies
            labsProfileManager.lastExtractTime = new Date().toISOString();
            
            // Lưu vào file
            saveStorageData();
            
            // Cập nhật cookies.json
            labsProfileManager.updateCookiesJsonWithLabs(result.cookies);
            
            // Lưu cookies vào file riêng
            labsProfileManager.saveLabsCookies(result.cookies);
            
            res.json({
                success: true,
                message: 'Labs cookies extracted successfully',
                cookies: result.cookies,
                cookieCount: result.cookieCount,
                isLoggedIn: result.isLoggedIn,
                profileName: result.profileName
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to extract Labs cookies',
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('❌ Extract Labs cookies error:', error);
        res.status(500).json({
            success: false,
            message: 'Error extracting Labs cookies',
            error: error.message
        });
    }
});

// API: Test Labs cookies
app.post('/api/test-labs-cookies', async (req, res) => {
    try {
        const { cookies } = req.body || {};
        
        if (!cookies) {
            return res.status(400).json({
                success: false,
                message: 'Cookies required to test'
            });
        }
        
        console.log('🧪 Testing Labs cookies...');
        
        const result = await labsProfileManager.testLabsCookies(cookies);
        
        res.json({
            success: result.success,
            message: result.success ? 'Labs cookies are valid' : 'Labs cookies are invalid',
            status: result.status,
            sessionData: result.sessionData,
            error: result.error
        });
        
    } catch (error) {
        console.error('❌ Test Labs cookies error:', error);
        res.status(500).json({
            success: false,
            message: 'Error testing Labs cookies',
            error: error.message
        });
    }
});

// API: Đóng Labs browser
app.post('/api/close-labs-browser', async (req, res) => {
    try {
        console.log('🔒 Closing Labs browser...');
        
        await labsProfileManager.closeLabsBrowser();
        
        res.json({
            success: true,
            message: 'Labs browser closed successfully'
        });
        
    } catch (error) {
        console.error('❌ Close Labs browser error:', error);
        res.status(500).json({
            success: false,
            message: 'Error closing Labs browser',
            error: error.message
        });
    }
});

// API: Lấy thông tin Labs profile
app.get('/api/labs-profile-info', (req, res) => {
    try {
        const profileInfo = labsProfileManager.getLabsProfileInfo();
        
        res.json({
            success: true,
            profileInfo: profileInfo
        });
        
    } catch (error) {
        console.error('❌ Get Labs profile info error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting Labs profile info',
            error: error.message
        });
    }
});


// API: Xóa Chrome profile
app.post('/api/delete-profile', async (req, res) => {
    try {
        const { profileName } = req.body || {};
        if (!profileName) {
            return res.status(400).json({ success: false, message: 'profileName is required' });
        }
        
        const success = profileUtils.deleteProfile(profileName);
        res.json({ success, message: `Profile ${profileName} ${success ? 'deleted' : 'not found'}` });
    } catch (error) {
        console.error('❌ Delete profile error:', error);
        res.status(500).json({ success: false, message: 'Error deleting profile', error: error.message });
    }
});

// API: Liệt kê video files
app.get('/api/list-videos', async (req, res) => {
    try {
        const videosDir = path.join(__dirname, 'public', 'videos');
        if (!fs.existsSync(videosDir)) {
            return res.json({ success: true, videos: [] });
        }
        
        const files = fs.readdirSync(videosDir)
            .filter(file => file.toLowerCase().endsWith('.mp4'))
            .sort((a, b) => fs.statSync(path.join(videosDir, b)).mtime - fs.statSync(path.join(videosDir, a)).mtime);
        
        res.json({ success: true, videos: files });
    } catch (error) {
        console.error('❌ List videos error:', error);
        res.status(500).json({ success: false, message: 'Error listing videos', error: error.message });
    }
});

// API: Tự động lấy cookies từ Chrome profile
app.post('/api/extract-cookies', async (req, res) => {
    try {
        const { profileName = 'Default' } = req.body || {};
        
        console.log(`🍪 Extracting cookies from profile: ${profileName}`);
        
        const result = await profileUtils.extractCookiesFromProfile(profileName);
        
        if (result.success) {
            // Cập nhật currentCookies
            currentCookies = result.cookies;
            tokenExpiryTime = Date.now() + (1.5 * 60 * 60 * 1000); // 1.5 giờ
            
            // Lưu vào file
            saveStorageData();
            
            // Cập nhật cookies.json
            updateCookiesJsonFile(result.cookies);
            
            res.json({
                success: true,
                message: 'Cookies extracted successfully',
                cookies: result.cookies,
                cookieCount: result.cookieCount,
                isLoggedIn: result.isLoggedIn,
                profileName: result.profileName
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to extract cookies',
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('❌ Extract cookies error:', error);
        res.status(500).json({
            success: false,
            message: 'Error extracting cookies',
            error: error.message
        });
    }
});

// API: Lấy cookies từ tất cả profiles
app.post('/api/extract-cookies-all', async (req, res) => {
    try {
        console.log('🍪 Extracting cookies from all profiles...');
        
        const result = await profileUtils.extractCookiesFromAllProfiles();
        
        if (result.success) {
            // Cập nhật currentCookies
            currentCookies = result.cookies;
            tokenExpiryTime = Date.now() + (1.5 * 60 * 60 * 1000); // 1.5 giờ
            
            // Lưu vào file
            saveStorageData();
            
            // Cập nhật cookies.json
            updateCookiesJsonFile(result.cookies);
            
            res.json({
                success: true,
                message: 'Cookies extracted successfully',
                cookies: result.cookies,
                cookieCount: result.cookieCount,
                isLoggedIn: result.isLoggedIn,
                profileName: result.profileName
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message || 'Failed to extract cookies from any profile',
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('❌ Extract cookies all error:', error);
        res.status(500).json({
            success: false,
            message: 'Error extracting cookies from all profiles',
            error: error.message
        });
    }
});

// API: Kiểm tra profile đã được lưu chưa
app.get('/api/check-profile/:profileName', async (req, res) => {
    try {
        const { profileName } = req.params;
        const profilePath = path.join(__dirname, 'chrome-profile', profileName);
        
        if (!fs.existsSync(profilePath)) {
            return res.json({ 
                success: false, 
                exists: false, 
                message: `Profile ${profileName} chưa tồn tại` 
            });
        }
        
        // Kiểm tra các file quan trọng trong profile
        const importantFiles = [
            'Default/Cookies',
            'Default/Local Storage',
            'Default/Session Storage',
            'Default/Preferences',
            'Default/Login Data'
        ];
        
        const existingFiles = importantFiles.filter(file => 
            fs.existsSync(path.join(profilePath, file))
        );
        
        const profileSize = getDirectorySize(profilePath);
        
        res.json({ 
            success: true, 
            exists: true,
            profileName,
            profilePath,
            profileSize: `${(profileSize / 1024 / 1024).toFixed(2)} MB`,
            importantFiles: existingFiles,
            message: `Profile ${profileName} đã được lưu với ${existingFiles.length}/${importantFiles.length} file quan trọng`
        });
    } catch (error) {
        console.error('❌ Check profile error:', error);
        res.status(500).json({ success: false, message: 'Error checking profile', error: error.message });
    }
});

// Helper function để tính kích thước thư mục
function getDirectorySize(dirPath) {
    let totalSize = 0;
    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                totalSize += getDirectorySize(filePath);
            } else {
                totalSize += stats.size;
            }
        }
    } catch (error) {
        // Ignore errors
    }
    return totalSize;
}

module.exports = app;
