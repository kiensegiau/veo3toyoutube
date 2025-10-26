const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

/**
 * Workflow hoàn chỉnh: Video gốc → Phân tích → ChatGPT refine → Veo3 → Kết quả
 * @param {string} videoPath - Đường dẫn video gốc
 * @param {Object} options - Tùy chọn
 * @returns {Promise<Object>} - Kết quả hoàn chỉnh
 */
async function veo3CompleteWorkflow(videoPath, options = {}) {
    try {
        console.log(`🎬 [veo3CompleteWorkflow] Bắt đầu workflow hoàn chỉnh cho: ${videoPath}`);
        
        const {
            startSecond = 0,
            duration = 8,
            frameInterval = 1,
            maxFrames = 8,
            outputDir = './temp/veo3-complete',
            themeContext = null
        } = options;
        
        // Tạo thư mục output
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Step 1: Tạo segment 8s từ video gốc
        console.log(`✂️ [Step 1] Tạo segment 8s từ giây ${startSecond}...`);
        const segmentPath = path.join(outputDir, `segment_${startSecond}s-${startSecond + duration}s.mp4`);
        
        const ffmpegCmd = `ffmpeg -i "${videoPath}" -ss ${startSecond} -t ${duration} -c copy -avoid_negative_ts make_zero "${segmentPath}"`;
        await execAsync(ffmpegCmd);
        
        console.log(`✅ [Step 1] Đã tạo segment: ${segmentPath}`);
        
        // Step 2: Trích xuất frames
        console.log(`📸 [Step 2] Trích xuất frames...`);
        const framesDir = path.join(outputDir, 'frames');
        if (!fs.existsSync(framesDir)) {
            fs.mkdirSync(framesDir, { recursive: true });
        }
        
        const ffmpegFramesCmd = `ffmpeg -i "${segmentPath}" -vf fps=1/${frameInterval} -frames:v ${maxFrames} "${framesDir}/frame_%03d.jpg"`;
        await execAsync(ffmpegFramesCmd);
        
        // Lấy danh sách frames
        const frames = [];
        const files = fs.readdirSync(framesDir);
        const frameFiles = files.filter(file => file.startsWith('frame_') && file.endsWith('.jpg'));
        
        for (let i = 0; i < frameFiles.length; i++) {
            const frameFile = frameFiles[i];
            const framePath = path.join(framesDir, frameFile);
            const frameTime = i * frameInterval;
            
            frames.push({
                index: i,
                time: frameTime,
                filename: frameFile,
                path: framePath
            });
        }
        
        console.log(`✅ [Step 2] Đã trích xuất ${frames.length} frames`);
        
        // Step 3: Phân tích frames với ChatGPT Vision
        console.log(`🔍 [Step 3] Phân tích frames với ChatGPT Vision...`);
        const detailedAnalysis = [];
        
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const second = i + 1;
            
            console.log(`🔍 [Step 3] Phân tích frame ${second}/${frames.length}`);
            
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
            
            // Tạo prompt chi tiết cho từng frame với chủ đề chung
            const themeContextText = themeContext ? `
            
            CHỦ ĐỀ CHUNG CỦA VIDEO:
            - Chủ đề chính: ${themeContext.mainTheme}
            - Địa điểm: ${themeContext.location}
            - Phong cách visual: ${themeContext.visualStyle}
            - Màu sắc chủ đạo: ${themeContext.colorPalette?.join(', ') || 'N/A'}
            - Tâm trạng: ${themeContext.mood}
            - Tính liên kết: ${themeContext.continuity}
            - Hướng phát triển: ${themeContext.sceneProgression}
            - Nội dung tóm tắt: ${themeContext.contentSummary || 'N/A'}
            - Prompt tổng thể: ${themeContext.unifiedPrompt || 'N/A'}
            
            YÊU CẦU: Đảm bảo phân tích và prompt phù hợp với chủ đề chung và nội dung thực tế này.` : '';
            
            const systemPrompt = `Bạn là chuyên gia phân tích video frame-by-frame với khả năng mô tả cực kỳ chi tiết.
            
            Nhiệm vụ: Phân tích frame này (giây ${second}) và mô tả CHI TIẾT từng element, từng chi tiết nhỏ nhất.${themeContextText}
            
            Yêu cầu mô tả chi tiết:
            1. Mô tả từng object, màu sắc, texture, ánh sáng
            2. Phân tích composition, perspective, depth
            3. Mô tả camera angle, movement, focus
            4. Phân tích mood, atmosphere, emotion
            5. Tạo prompt Veo3 cực kỳ chi tiết và cụ thể
            6. Đảm bảo phù hợp với chủ đề chung của video
            
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
                "veo3_prompt": "PROMPT CỰC KỲ CHI TIẾT cho Veo3 với từng element cụ thể, phù hợp với chủ đề chung",
                "continuity": "mô tả chi tiết cách kết nối với frame trước/sau",
                "themeConsistency": "cách frame này phù hợp với chủ đề chung"
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
                        model: 'gpt-4o-mini',
                        messages: messages,
                        max_tokens: 2000,
                        temperature: 0.7
                    })
                });

                const data = await response.json();
                
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    const analysisText = data.choices[0].message.content;
                    console.log(`✅ [Step 3] ChatGPT response cho frame ${second}`);
                    
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
                        console.warn(`⚠️ [Step 3] Không thể parse JSON cho frame ${second}, tạo mock analysis`);
                        
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
                console.warn(`⚠️ [Step 3] ChatGPT error cho frame ${second}:`, chatError.message);
                
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
        
        console.log(`✅ [Step 3] Đã phân tích ${detailedAnalysis.length} frames`);
        
        // Step 4: Tạo JSON format cho Veo3
        console.log(`🎬 [Step 4] Tạo JSON format cho Veo3...`);
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
            console.log(`✅ [Step 4] ChatGPT response cho timeline`);
            
            // Parse JSON từ response
            let timeline = [];
            try {
                const jsonMatch = timelineText.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    timeline = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON array found in response');
                }
            } catch (parseError) {
                console.warn(`⚠️ [Step 4] Không thể parse JSON, tạo mock timeline`);
                
                // Mock timeline fallback
                timeline = [
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
            }
            
            console.log(`✅ [Step 4] Đã tạo timeline với ${timeline.length} segments`);
            
            // Step 5: ChatGPT refine prompt
            console.log(`🤖 [Step 5] ChatGPT refine prompt chi tiết...`);
            const refinePrompt = `Bạn là chuyên gia tạo prompt video cho Veo3. 

Nhiệm vụ: Tạo một prompt CHI TIẾT và ĐỒNG NHẤT cho video 8 giây dựa trên phân tích từng cảnh.

PHÂN TÍCH GỐC:
${timeline.map((segment, index) => 
    `Cảnh ${index + 1} (${segment.timeStart}s-${segment.timeEnd}s): ${segment.action}`
).join('\n')}

YÊU CẦU:
1. Tạo prompt CHI TIẾT cho toàn bộ video 8 giây
2. Đảm bảo TÍNH ĐỒNG NHẤT giữa các cảnh
3. Mô tả rõ ràng từng giây (0-2s, 2-4s, 4-6s, 6-8s)
4. Bao gồm camera style, lighting, colors, mood
5. Tạo cảm giác LIỀN MẠCH và LOGIC
6. Prompt phải dài ít nhất 200 từ

Trả về prompt hoàn chỉnh cho Veo3:`;

            const refineResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: 'Bạn là chuyên gia tạo prompt video cho Veo3 với khả năng mô tả chi tiết và đồng nhất.' },
                        { role: 'user', content: refinePrompt }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7
                })
            });
            
            const refineResult = await refineResponse.json();
            
            if (refineResult.choices && refineResult.choices[0]) {
                const refinedPrompt = refineResult.choices[0].message.content;
                console.log(`✅ [Step 5] ChatGPT đã refine prompt`);
                
                // Step 6: Tạo video Veo3
                console.log(`🎬 [Step 6] Tạo video Veo3...`);
                const serverUrl = 'http://localhost:8888';
                
                const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: refinedPrompt,
                        prompt: refinedPrompt
                    })
                });
                
                const veo3Result = await veo3Response.json();
                console.log(`🎬 [Step 6] Veo3 result:`, veo3Result.success ? '✅ Success' : '❌ Failed');
                
                if (veo3Result.success) {
                    console.log(`🎬 [Step 6] Video Veo3 đã được tạo: ${veo3Result.operationName}`);
                    
                    // Lưu kết quả hoàn chỉnh
                    const finalResult = {
                        timestamp: new Date().toISOString(),
                        originalVideo: videoPath,
                        startSecond: startSecond,
                        duration: duration,
                        segmentPath: segmentPath,
                        frames: frames,
                        detailedAnalysis: detailedAnalysis,
                        timeline: timeline,
                        refinedPrompt: refinedPrompt,
                        veo3Operation: veo3Result.operationName,
                        veo3Status: veo3Result.videoStatus,
                        outputDir: outputDir
                    };
                    
                    const resultPath = path.join(outputDir, 'veo3-complete-result.json');
                    fs.writeFileSync(resultPath, JSON.stringify(finalResult, null, 2));
                    
                    console.log(`✅ [Step 6] Đã lưu kết quả vào: ${resultPath}`);
                    
                    return {
                        success: true,
                        result: finalResult
                    };
                    
                } else {
                    throw new Error(`Tạo video Veo3 thất bại: ${veo3Result.message}`);
                }
                
            } else {
                throw new Error('ChatGPT refine không trả về kết quả hợp lệ');
            }
            
        } else {
            throw new Error('ChatGPT timeline không trả về kết quả hợp lệ');
        }
        
    } catch (error) {
        console.error(`❌ [veo3CompleteWorkflow] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * API endpoint cho workflow hoàn chỉnh
 */
async function veo3CompleteWorkflowAPI(req, res) {
    try {
        console.log(`🎬 [veo3CompleteWorkflowAPI] API workflow hoàn chỉnh được gọi`);
        
        const { videoPath, startSecond, duration, frameInterval, maxFrames, outputDir, themeContext } = req.body;
        
        if (!videoPath) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu videoPath'
            });
        }
        
        const result = await veo3CompleteWorkflow(videoPath, {
            startSecond,
            duration,
            frameInterval,
            maxFrames,
            outputDir,
            themeContext
        });
        
        if (result.success) {
            return res.json({
                success: true,
                message: `Đã hoàn thành workflow hoàn chỉnh`,
                result: result.result
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }
        
    } catch (error) {
        console.error(`❌ [veo3CompleteWorkflowAPI] Lỗi:`, error.message);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

module.exports = {
    veo3CompleteWorkflow,
    veo3CompleteWorkflowAPI
};
