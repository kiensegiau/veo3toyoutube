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

// Hàm tạo 1 video Veo3
async function createVeo3Video(prompt, options = {}) {
    try {
        const {
            aspectRatio = 'VIDEO_ASPECT_RATIO_LANDSCAPE',
            videoModel = 'veo_3_1_t2v_fast_ultra',
            seed = Math.floor(Math.random() * 100000)
        } = options;

        console.log(`🎬 [createVeo3Video] Tạo video Veo3 với prompt: "${prompt.substring(0, 100)}..."`);
        
        // Lấy Labs cookies
        const labsProfileManager = LabsProfileManager;
        const extractResult = await labsProfileManager.extractLabsCookies();
        
        if (!extractResult.success) {
            throw new Error(`Không thể lấy cookies từ Chrome Labs: ${extractResult.error}`);
        }
        
        const labsCookies = extractResult.cookies;
        console.log(`🍪 Labs cookies: ${labsCookies ? 'Found' : 'Not found'}`);
        
        // Tạo request body cho Veo3
        const requestBody = {
            clientContext: {
                projectId: "ccd41cba-0a8f-4777-8ddb-56feee829abd",
                tool: "PINHOLE",
                userPaygateTier: "PAYGATE_TIER_TWO"
            },
            requests: [{
                aspectRatio: aspectRatio,
                seed: seed,
                textInput: {
                    prompt: prompt
                },
                videoModelKey: videoModel,
                metadata: {
                    sceneId: crypto.randomUUID()
                }
            }]
        };

        console.log('🧾 Veo3 request body:', JSON.stringify(requestBody, null, 2));

        // Lấy auth token
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

        // Gọi Google Labs API
        const response = await fetch(`${GOOGLE_LABS_CONFIG.baseUrl}/video:batchAsyncGenerateVideoText`, {
            method: 'POST',
            headers: {
                ...GOOGLE_LABS_CONFIG.headers,
                'content-type': 'text/plain;charset=UTF-8',
                'x-client-data': 'CLnnygE=',
                'Cookie': labsCookies,
                ...(authToken && { 'Authorization': authToken })
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Labs API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('🧾 Veo3 response:', JSON.stringify(data, null, 2));

        // Lưu response vào logs
        const timestamp = Date.now();
        const operationName = data.operations?.[0]?.operation?.name || 'unknown_operation';
        const logFileName = `veo3-response-${timestamp}-${operationName}.json`;
        const logFilePath = path.join(__dirname, '../../logs', logFileName);
        
        const logsDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        fs.writeFileSync(logFilePath, JSON.stringify(data, null, 2));
        console.log(`📝 Saved Veo3 response to logs/${logFileName}`);

        return {
            success: true,
            operationName: data.operations?.[0]?.operation?.name,
            prompt: prompt,
            requestId: timestamp.toString(),
            response: data
        };

    } catch (error) {
        console.error('❌ [createVeo3Video] Lỗi:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Hàm tạo nhiều video Veo3 từ analysis
async function createMultipleVeo3Videos(analysis, options = {}) {
    try {
        console.log(`🎬 [createMultipleVeo3Videos] Tạo ${analysis.scenes.length} video Veo3`);
        
        const veo3Videos = [];
        const delays = [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000]; // Delay giữa các requests
        
        for (let i = 0; i < analysis.scenes.length; i++) {
            const scene = analysis.scenes[i];
            const delay = delays[i] || 0;
            
            console.log(`🎬 [createMultipleVeo3Videos] Tạo video ${i + 1}/${analysis.scenes.length}: "${scene.description}"`);
            
            // Delay để tránh rate limit
            if (delay > 0) {
                console.log(`⏳ [createMultipleVeo3Videos] Chờ ${delay}ms trước khi tạo video ${i + 1}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const veo3Result = await createVeo3Video(scene.veo3_prompt, {
                aspectRatio: 'VIDEO_ASPECT_RATIO_LANDSCAPE',
                videoModel: 'veo_3_1_t2v_fast_ultra',
                seed: Math.floor(Math.random() * 100000)
            });
            
            if (veo3Result.success) {
                veo3Videos.push({
                    sceneId: scene.scene_id,
                    description: scene.description,
                    prompt: scene.veo3_prompt,
                    operationName: veo3Result.operationName,
                    requestId: veo3Result.requestId,
                    status: 'PENDING'
                });
                console.log(`✅ [createMultipleVeo3Videos] Video ${i + 1} tạo thành công`);
            } else {
                console.error(`❌ [createMultipleVeo3Videos] Video ${i + 1} thất bại:`, veo3Result.error);
                veo3Videos.push({
                    sceneId: scene.scene_id,
                    description: scene.description,
                    prompt: scene.veo3_prompt,
                    error: veo3Result.error,
                    status: 'FAILED'
                });
            }
        }
        
        return {
            success: true,
            veo3Videos,
            totalVideos: veo3Videos.length,
            successfulVideos: veo3Videos.filter(v => v.status === 'PENDING').length,
            failedVideos: veo3Videos.filter(v => v.status === 'FAILED').length
        };
        
    } catch (error) {
        console.error('❌ [createMultipleVeo3Videos] Lỗi:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// API endpoint
async function createVeo3VideosAPI(req, res) {
    try {
        const { analysis, options = {} } = req.body;
        
        if (!analysis || !analysis.scenes) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu analysis hoặc scenes'
            });
        }
        
        console.log(`🎬 [createVeo3VideosAPI] Bắt đầu tạo ${analysis.scenes.length} video Veo3`);
        
        const result = await createMultipleVeo3Videos(analysis, options);
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Không thể tạo video Veo3',
                error: result.error
            });
        }
        
        return res.json({
            success: true,
            message: `Đã tạo ${result.successfulVideos}/${result.totalVideos} video Veo3`,
            result: {
                veo3Videos: result.veo3Videos,
                totalVideos: result.totalVideos,
                successfulVideos: result.successfulVideos,
                failedVideos: result.failedVideos
            }
        });
        
    } catch (error) {
        console.error('❌ [createVeo3VideosAPI] Lỗi:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi tạo video Veo3',
            error: error.message
        });
    }
}

module.exports = {
    createVeo3Video,
    createMultipleVeo3Videos,
    createVeo3VideosAPI
};
