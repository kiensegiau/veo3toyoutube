const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const LabsProfileManager = require('../../labs-profile-manager');
// Load environment variables from .env if present
try { require('dotenv').config(); } catch (_) {}

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

        const aspectRatio = 'VIDEO_ASPECT_RATIO_LANDSCAPE';
        
        // Determine run mode (unified behavior):
        // 1) If client sends cookies -> ALWAYS use them
        // 2) Else if default mode -> auto-extract then fallback to file
        // 3) Else if vps mode -> error (require client cookies)
        const runMode = (process.env.RUN_MODE || 'default').toLowerCase();
        const sanitizeCookieHeader = (val) => {
            if (!val || typeof val !== 'string') return '';
            // Remove potential "Cookie:" prefix, remove comments lines, collapse newlines/spaces
            let s = String(val).replace(/^Cookie:\s*/i, '');
            s = s.split(/\r?\n/).filter(line => line && !/^\s*#/.test(line)).join('; ');
            s = s.replace(/\r|\n/g, '').trim();
            return s;
        };
        console.log(`🎯 [create-video] incoming prompt="${prompt}"`);
        console.log(`⚙️  [create-video] runMode=${runMode}`);
        let labsCookies = sanitizeCookieHeader((req.body && (req.body.labsCookies || req.body.cookies || req.body.cookie)) || req.headers['x-labs-cookie'] || '');
        if (!labsCookies) {
            if (runMode === 'vps') {
                return res.status(400).json({
                    success: false,
                    message: 'VPS mode: Thiếu Labs cookies. Gửi labsCookies trong body hoặc header x-labs-cookie.'
                });
            }
            // Default mode fallback
            const labsProfileManager = LabsProfileManager;
            const extractResult = await labsProfileManager.extractLabsCookies();
            if (extractResult.success) {
                labsCookies = sanitizeCookieHeader(extractResult.cookies);
                labsProfileManager.lastExtractTime = new Date().toISOString();
                if (!extractResult.fromFile) { labsProfileManager.saveLabsCookies(labsCookies); }
                console.log(`🍪 [create-video] cookie source=auto-extract length=${labsCookies.length}`);
            } else {
                labsCookies = sanitizeCookieHeader(await getLabsCookies());
                if (!labsCookies) {
                    return res.status(400).json({
                        success: false,
                        message: `Không thể lấy cookies tự động hoặc từ file: ${extractResult.error}`
                    });
                }
                console.log(`🍪 [create-video] cookie source=file length=${labsCookies.length}`);
            }
        } else {
            console.log(`🍪 [create-video] cookie source=client length=${labsCookies.length}`);
        }

        

        const VEO_PROJECT_ID = (req.body && req.body.projectId) || (req.headers && (req.headers['x-veo-project-id'] || req.headers['X-Veo-Project-Id'])) || process.env.VEO_PROJECT_ID || '69a71e65-d70b-41dc-a540-fc8964582233';
        console.log(`🆔 [create-video] projectId=${VEO_PROJECT_ID}`);
        const requestBody = {
            clientContext: {
                projectId: VEO_PROJECT_ID, // from env VEO_PROJECT_ID
                tool: "PINHOLE",
                userPaygateTier: "PAYGATE_TIER_TWO"
            },
            requests: [{
                aspectRatio: aspectRatio,
                seed: Math.floor(Math.random() * 100000),
                textInput: {
                    prompt: prompt
                },
                videoModelKey: "veo_3_1_t2v_fast_ultra", // Veo 3.1 cho khổ ngang
                metadata: {
                    sceneId: crypto.randomUUID()
                }
            }]
        };

        

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
            console.log(`🔑 [create-video] session token=${authToken ? 'present' : 'absent'}`);
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
            console.error('❌ Labs API error:', response.status);
            return res.status(500).json({
                success: false,
                message: `Labs API error: ${response.status}`,
                error: errorText
            });
        }

        const data = await response.json();
        

        // Lưu response vào file logs
        const timestamp = Date.now();
        const operationName = data.operations?.[0]?.operation?.name || 'unknown_operation';
        console.log(`📦 [create-video] operationName=${operationName}`);
        const logFileName = `create-response-${timestamp}-${operationName}.json`;
        const logFilePath = path.join(__dirname, '../../logs', logFileName);
        
        // Tạo thư mục logs nếu chưa có
        const logsDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        fs.writeFileSync(logFilePath, JSON.stringify(data, null, 2));
        

        // Lưu operation name để check status sau
        // Không lưu currentOperationName vào storage nữa (tránh tạo lịch sử)

        // Bỏ lưu lịch sử yêu cầu (requestHistory)

        

        res.json({
            success: true,
            message: `Video generation request sent for: "${prompt}"`,
            data: data,
            requestId: timestamp.toString(),
            operationName
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
        // silent: no log to console
    } catch (error) {
        console.error('❌ Error saving storage data:', error);
    }
}

module.exports = { createVideo };
