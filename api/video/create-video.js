const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const LabsProfileManager = require('../../labs-profile-manager');

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

// Hàm tạo video
async function createVideo(req, res, storageData) {
    try {
        const rawInput = (req.body && (req.body.input !== undefined ? req.body.input : req.body.prompt)) ?? 'cat';
        const prompt = normalizeInputToPrompt(rawInput, 'cat');

        const aspectRatio = 'VIDEO_ASPECT_RATIO_PORTRAIT';
        
        // Tự động lấy cookies mới từ Chrome Labs
        console.log(`🔄 Tự động lấy cookies mới từ Chrome Labs...`);
        const labsProfileManager = LabsProfileManager;
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
        storageData.currentCookies = labsCookies;
        storageData.tokenExpiryTime = Date.now() + (1.5 * 60 * 60 * 1000); // 1.5 giờ
        saveStorageData(storageData);
        
        // Lưu cookies vào file riêng
        labsProfileManager.saveLabsCookies(labsCookies);

        console.log(`🎬 Tạo video với prompt: "${prompt}"`);
        console.log(`🍪 Sử dụng Labs cookies: ${labsCookies.substring(0, 100)}...`);

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
                ...GOOGLE_LABS_CONFIG.headers,
                'content-type': 'text/plain;charset=UTF-8', // Content-type từ F12
                'x-client-data': 'CLnnygE=', // Client data từ F12
                'Cookie': labsCookies,
                ...(authToken && { 'Authorization': authToken }) // Conditionally add Authorization header
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Labs API error:', response.status, errorText);
            return res.status(500).json({
                success: false,
                message: `Labs API error: ${response.status}`,
                error: errorText
            });
        }

        const data = await response.json();
        console.log('🧾 Create response (raw from Labs):', JSON.stringify(data, null, 2));

        // Lưu response vào file logs
        const timestamp = Date.now();
        const operationName = data.operations?.[0]?.operation?.name || 'unknown_operation';
        const logFileName = `create-response-${timestamp}-${operationName}.json`;
        const logFilePath = path.join(__dirname, '../../logs', logFileName);
        
        // Tạo thư mục logs nếu chưa có
        const logsDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        fs.writeFileSync(logFilePath, JSON.stringify(data, null, 2));
        console.log(`📝 Saved create response to logs/${logFileName}`);

        // Lưu operation name để check status sau
        if (data.operations && data.operations.length > 0) {
            storageData.currentOperationName = data.operations[0].operation.name;
            console.log(`🔑 Operation name saved: ${storageData.currentOperationName}`);
            saveStorageData(storageData);
        }

        // Lưu request vào history
        const requestId = timestamp.toString();
        const historyEntry = {
            requestId,
            timestamp: new Date().toISOString(),
            prompt,
            videoModel: 'veo_3_1_t2v_fast_portrait_ultra',
            aspectRatio,
            status: 'PENDING',
            operationName: storageData.currentOperationName
        };
        
        storageData.requestHistory = storageData.requestHistory || [];
        storageData.requestHistory.push(historyEntry);
        saveStorageData(storageData);

        console.log(`✅ Video generation request sent for: "${prompt}"`);
        console.log(`📊 Response status: ${response.status}`);

        res.json({
            success: true,
            message: `Video generation request sent for: "${prompt}"`,
            data: data,
            requestId: requestId,
            operationName: storageData.currentOperationName
        });

    } catch (error) {
        console.error('❌ Create video error:', error);
        res.status(500).json({
            success: false,
            message: 'Video creation failed',
            error: error.message
        });
    }
}

// Hàm normalize input
function normalizeInputToPrompt(input, fallback = 'cat') {
    if (!input || typeof input !== 'string') return fallback;
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

// Hàm lưu storage data
function saveStorageData(storageData) {
    try {
        const fs = require('fs');
        const path = require('path');
        const storageFile = path.join(__dirname, '../../server-storage.json');
        fs.writeFileSync(storageFile, JSON.stringify(storageData, null, 2));
        console.log('💾 Storage data saved to file');
    } catch (error) {
        console.error('❌ Error saving storage data:', error);
    }
}

module.exports = { createVideo };
