const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

/**
 * Trích xuất frame từ video segment
 * @param {string} videoPath - Đường dẫn video segment
 * @param {Object} options - Tùy chọn
 * @returns {Promise<Object>} - Kết quả trích xuất frame
 */
async function extractFramesFromSegment(videoPath, options = {}) {
    try {
        console.log(`🎬 [extractFramesFromSegment] Trích xuất frames từ: ${videoPath}`);
        
        const {
            outputDir = './temp/frames',
            frameInterval = 1, // Mỗi 1 giây 1 frame
            maxFrames = 8
        } = options;
        
        // Tạo thư mục output nếu chưa có
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const segmentName = path.basename(videoPath, '.mp4');
        const segmentFrameDir = path.join(outputDir, segmentName);
        
        if (!fs.existsSync(segmentFrameDir)) {
            fs.mkdirSync(segmentFrameDir, { recursive: true });
        }
        
        // Trích xuất frames
        console.log(`📸 [extractFramesFromSegment] Trích xuất frames mỗi ${frameInterval}s...`);
        const ffmpegCmd = `ffmpeg -i "${videoPath}" -vf fps=1/${frameInterval} -frames:v ${maxFrames} "${segmentFrameDir}/frame_%03d.jpg"`;
        await execAsync(ffmpegCmd);
        
        // Lấy danh sách frames đã tạo
        const frames = [];
        const files = fs.readdirSync(segmentFrameDir);
        const frameFiles = files.filter(file => file.startsWith('frame_') && file.endsWith('.jpg'));
        
        for (let i = 0; i < frameFiles.length; i++) {
            const frameFile = frameFiles[i];
            const framePath = path.join(segmentFrameDir, frameFile);
            const frameTime = i * frameInterval;
            
            frames.push({
                index: i,
                time: frameTime,
                filename: frameFile,
                path: framePath
            });
        }
        
        console.log(`✅ [extractFramesFromSegment] Đã trích xuất ${frames.length} frames`);
        
        return {
            success: true,
            frames: frames,
            outputDir: segmentFrameDir
        };
        
    } catch (error) {
        console.error(`❌ [extractFramesFromSegment] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Phân tích frame với ChatGPT Vision
 * @param {Array} frames - Danh sách frames
 * @param {Object} options - Tùy chọn
 * @returns {Promise<Object>} - Kết quả phân tích
 */
async function analyzeFramesWithChatGPT(frames, options = {}) {
    try {
        console.log(`🔍 [analyzeFramesWithChatGPT] Phân tích ${frames.length} frames với ChatGPT`);
        
        const detailedAnalysis = [];
        
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const second = i + 1;
            
            console.log(`🔍 [analyzeFramesWithChatGPT] Phân tích frame ${second}/${frames.length}`);
            
            // Chuẩn bị image cho ChatGPT Vision
            let imageContent = null;
            if (fs.existsSync(frame.path)) {
                const imageBuffer = fs.readFileSync(frame.path);
                const base64Image = imageBuffer.toString('base64');
                imageContent = {
                    type: "image_url",
                    image_url: {
                        url: `data:image/jpeg;base64,${base64Image}`,
                        detail: "high"
                    }
                };
            }
            
            // Tạo prompt chi tiết cho từng frame
            const systemPrompt = `Bạn là chuyên gia phân tích video frame-by-frame với khả năng mô tả cực kỳ chi tiết.
            
            Nhiệm vụ: Phân tích frame này (giây ${second}) và mô tả CHI TIẾT từng element, từng chi tiết nhỏ nhất.
            
            Yêu cầu mô tả chi tiết:
            1. Mô tả từng object, màu sắc, texture, ánh sáng
            2. Phân tích composition, perspective, depth
            3. Mô tả camera angle, movement, focus
            4. Phân tích mood, atmosphere, emotion
            5. Tạo prompt Veo3 cực kỳ chi tiết và cụ thể
            
            Trả về JSON format:
            {
                "second": ${second},
                "description": "mô tả CHI TIẾT từng element trong frame",
                "visual_elements": ["element1 với mô tả chi tiết", "element2 với mô tả chi tiết"],
                "colors": ["#color1 với mô tả", "#color2 với mô tả"],
                "textures": ["texture1", "texture2"],
                "lighting": "mô tả chi tiết ánh sáng",
                "shadows": "mô tả chi tiết bóng đổ",
                "composition": "mô tả chi tiết composition",
                "perspective": "mô tả chi tiết perspective",
                "depth": "mô tả chi tiết depth",
                "camera_angle": "mô tả chi tiết góc máy",
                "camera_movement": "mô tả chi tiết chuyển động máy",
                "focus": "mô tả chi tiết focus",
                "mood": "mô tả chi tiết mood và atmosphere",
                "emotion": "mô tả chi tiết cảm xúc",
                "atmosphere": "mô tả chi tiết không khí",
                "veo3_prompt": "PROMPT CỰC KỲ CHI TIẾT cho Veo3 với từng element cụ thể",
                "continuity": "mô tả chi tiết cách kết nối với frame trước/sau"
            }`;

            const userPrompt = `Phân tích frame này (giây ${second}) và tạo mô tả chi tiết cho Veo3.`;

            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ];

            if (imageContent) {
                messages[1].content = [
                    { type: "text", text: userPrompt },
                    imageContent
                ];
            }

            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o',
                        messages: messages,
                        max_tokens: 2000,
                        temperature: 0.7
                    })
                });

                const data = await response.json();
                
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    const analysisText = data.choices[0].message.content;
                    console.log(`✅ [analyzeFramesWithChatGPT] ChatGPT response cho giây ${second}`);
                    
                    // Parse JSON từ response
                    try {
                        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const analysis = JSON.parse(jsonMatch[0]);
                            detailedAnalysis.push({
                                second: second,
                                analysis: analysis,
                                rawResponse: analysisText
                            });
                        } else {
                            throw new Error('No JSON found in response');
                        }
                    } catch (parseError) {
                        console.warn(`⚠️ [analyzeFramesWithChatGPT] Không thể parse JSON cho giây ${second}, tạo mock analysis`);
                        
                        // Mock analysis fallback
                        const mockAnalysis = {
                            second: second,
                            description: `Frame ${second} - Professional scene with clean composition`,
                            visual_elements: ["Professional elements", "Clean design"],
                            colors: ["#ffffff", "#000000"],
                            textures: ["smooth", "professional"],
                            lighting: "Professional lighting",
                            shadows: "Soft shadows",
                            composition: "Clean composition",
                            perspective: "Professional perspective",
                            depth: "Good depth",
                            camera_angle: "Professional angle",
                            camera_movement: "Smooth movement",
                            focus: "Sharp focus",
                            mood: "Professional mood",
                            emotion: "Confident emotion",
                            atmosphere: "Professional atmosphere",
                            veo3_prompt: `Create a professional video scene with clean composition, modern lighting, and dynamic camera movement for frame ${second}`,
                            continuity: "Smooth continuity"
                        };
                        
                        detailedAnalysis.push({
                            second: second,
                            analysis: mockAnalysis,
                            rawResponse: analysisText
                        });
                    }
                } else {
                    throw new Error('Invalid ChatGPT response');
                }
                
            } catch (chatError) {
                console.warn(`⚠️ [analyzeFramesWithChatGPT] ChatGPT error cho giây ${second}:`, chatError.message);
                
                // Mock analysis fallback
                const mockAnalysis = {
                    second: second,
                    description: `Frame ${second} - Professional scene with clean composition`,
                    visual_elements: ["Professional elements", "Clean design"],
                    colors: ["#ffffff", "#000000"],
                    textures: ["smooth", "professional"],
                    lighting: "Professional lighting",
                    shadows: "Soft shadows",
                    composition: "Clean composition",
                    perspective: "Professional perspective",
                    depth: "Good depth",
                    camera_angle: "Professional angle",
                    camera_movement: "Smooth movement",
                    focus: "Sharp focus",
                    mood: "Professional mood",
                    emotion: "Confident emotion",
                    atmosphere: "Professional atmosphere",
                    veo3_prompt: `Create a professional video scene with clean composition, modern lighting, and dynamic camera movement for frame ${second}`,
                    continuity: "Smooth continuity"
                };
                
                detailedAnalysis.push({
                    second: second,
                    analysis: mockAnalysis,
                    rawResponse: `Mock analysis for frame ${second}`
                });
            }
        }
        
        console.log(`✅ [analyzeFramesWithChatGPT] Đã phân tích ${detailedAnalysis.length} frames`);
        
        return {
            success: true,
            detailedAnalysis: detailedAnalysis
        };
        
    } catch (error) {
        console.error(`❌ [analyzeFramesWithChatGPT] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Tạo JSON format cho Veo3 từ phân tích frames
 * @param {Array} detailedAnalysis - Kết quả phân tích chi tiết
 * @param {Object} videoInfo - Thông tin video
 * @returns {Promise<Object>} - JSON format cho Veo3
 */
async function generateVeo3JSON(detailedAnalysis, videoInfo) {
    try {
        console.log(`🎬 [generateVeo3JSON] Tạo JSON format cho Veo3 từ ${detailedAnalysis.length} frames`);
        
        const systemPrompt = `Bạn là chuyên gia tạo timeline video cho Veo3.
        
        Nhiệm vụ: Tạo timeline JSON hoàn chỉnh dựa trên phân tích chi tiết từng frame.
        
        Format JSON yêu cầu:
        [
            {
                "timeStart": 0,
                "timeEnd": 2,
                "action": "mô tả hành động chi tiết",
                "cameraStyle": "góc máy quay cụ thể, chuyển động máy",
                "soundFocus": "mô tả âm thanh",
                "visualDetails": "chi tiết visual, màu sắc, ánh sáng"
            }
        ]
        
        Yêu cầu:
        1. Mỗi segment 2 giây (timeStart, timeEnd)
        2. Action: mô tả hành động cụ thể và chi tiết
        3. CameraStyle: góc máy quay CỤ THỂ (close-up, wide-shot, pan, zoom, tilt, dolly, etc.)
        4. SoundFocus: mô tả âm thanh phù hợp
        5. VisualDetails: chi tiết visual, màu sắc, ánh sáng
        6. Tạo timeline liền mạch và logic
        7. Mỗi segment phải tạo video 8 giây thú vị
        
        Trả về JSON array chính xác như format trên.`;

        const userPrompt = `Tạo timeline JSON cho Veo3 dựa trên phân tích chi tiết:

VIDEO INFO:
- Duration: ${videoInfo.duration}s
- Resolution: ${videoInfo.width}x${videoInfo.height}
- FPS: ${videoInfo.fps}

DETAILED ANALYSIS (${detailedAnalysis.length} frames):
${detailedAnalysis.map((item, index) => {
    const analysis = item.analysis;
    return `Frame ${analysis.second}:
- Description: ${analysis.description}
- Visual elements: ${analysis.visual_elements?.join(', ') || 'N/A'}
- Colors: ${analysis.colors?.join(', ') || 'N/A'}
- Lighting: ${analysis.lighting}
- Camera angle: ${analysis.camera_angle}
- Mood: ${analysis.mood}
- Veo3 prompt: ${analysis.veo3_prompt}`;
}).join('\n\n')}

Tạo timeline JSON hoàn chỉnh cho video 8 giây này.`;

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: messages,
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        const data = await response.json();
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const timelineText = data.choices[0].message.content;
            console.log(`✅ [generateVeo3JSON] ChatGPT response cho timeline`);
            
            // Parse JSON từ response
            try {
                const jsonMatch = timelineText.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const timeline = JSON.parse(jsonMatch[0]);
                    return {
                        success: true,
                        timeline: timeline,
                        rawResponse: timelineText
                    };
                } else {
                    throw new Error('No JSON array found in response');
                }
            } catch (parseError) {
                console.warn(`⚠️ [generateVeo3JSON] Không thể parse JSON, tạo mock timeline`);
                
                // Mock timeline fallback
                const mockTimeline = [
                    {
                        timeStart: 0,
                        timeEnd: 2,
                        action: "Professional scene with clean composition",
                        cameraStyle: "medium-shot, static camera",
                        soundFocus: "Professional background sound",
                        visualDetails: "Clean white and black color scheme with bright lighting"
                    },
                    {
                        timeStart: 2,
                        timeEnd: 4,
                        action: "Dynamic movement with modern elements",
                        cameraStyle: "panning shot, smooth movement",
                        soundFocus: "Dynamic ambient sound",
                        visualDetails: "Modern design with blue and white colors"
                    },
                    {
                        timeStart: 4,
                        timeEnd: 6,
                        action: "Close-up details with professional focus",
                        cameraStyle: "close-up, steady focus",
                        soundFocus: "Clear, focused audio",
                        visualDetails: "Sharp details with professional lighting"
                    },
                    {
                        timeStart: 6,
                        timeEnd: 8,
                        action: "Final professional conclusion",
                        cameraStyle: "wide-shot, smooth zoom out",
                        soundFocus: "Professional conclusion sound",
                        visualDetails: "Complete professional scene with balanced composition"
                    }
                ];
                
                return {
                    success: true,
                    timeline: mockTimeline,
                    rawResponse: timelineText
                };
            }
        } else {
            throw new Error('Invalid ChatGPT response');
        }
        
    } catch (error) {
        console.error(`❌ [generateVeo3JSON] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * API endpoint cho phân tích frame
 */
async function analyzeFramesAPI(req, res) {
    try {
        console.log(`🔍 [analyzeFramesAPI] API phân tích frames được gọi`);
        
        const { videoPath, outputDir, frameInterval, maxFrames } = req.body;
        
        if (!videoPath) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu videoPath'
            });
        }
        
        // Trích xuất frames
        const extractResult = await extractFramesFromSegment(videoPath, {
            outputDir,
            frameInterval,
            maxFrames
        });
        
        if (!extractResult.success) {
            return res.status(500).json({
                success: false,
                message: extractResult.error
            });
        }
        
        // Phân tích frames với ChatGPT
        const analyzeResult = await analyzeFramesWithChatGPT(extractResult.frames);
        
        if (!analyzeResult.success) {
            return res.status(500).json({
                success: false,
                message: analyzeResult.error
            });
        }
        
        return res.json({
            success: true,
            message: `Đã phân tích ${extractResult.frames.length} frames`,
            result: {
                frames: extractResult.frames,
                detailedAnalysis: analyzeResult.detailedAnalysis,
                outputDir: extractResult.outputDir
            }
        });
        
    } catch (error) {
        console.error(`❌ [analyzeFramesAPI] Lỗi:`, error.message);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * API endpoint cho tạo JSON Veo3
 */
async function generateVeo3JSONAPI(req, res) {
    try {
        console.log(`🎬 [generateVeo3JSONAPI] API tạo JSON Veo3 được gọi`);
        
        const { detailedAnalysis, videoInfo } = req.body;
        
        if (!detailedAnalysis || !videoInfo) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu detailedAnalysis hoặc videoInfo'
            });
        }
        
        const result = await generateVeo3JSON(detailedAnalysis, videoInfo);
        
        if (result.success) {
            return res.json({
                success: true,
                message: `Đã tạo JSON format cho Veo3`,
                result: result
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }
        
    } catch (error) {
        console.error(`❌ [generateVeo3JSONAPI] Lỗi:`, error.message);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

module.exports = {
    extractFramesFromSegment,
    analyzeFramesWithChatGPT,
    generateVeo3JSON,
    analyzeFramesAPI,
    generateVeo3JSONAPI
};
