const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

// Hàm phân tích từng giây chi tiết
async function analyzeSecondBySecond(frames, transcript, videoInfo) {
    try {
        console.log(`🔍 [analyzeSecondBySecond] Phân tích chi tiết ${frames.length} frames (từng giây)`);
        
        const detailedAnalysis = [];
        
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const second = i + 1;
            
            console.log(`🔍 [analyzeSecondBySecond] Phân tích giây ${second}/${frames.length}`);
            
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
            
            // Tạo prompt chi tiết cho từng giây
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
                "continuity": "mô tả chi tiết cách kết nối với giây trước/sau"
            }`;

            const userPrompt = `Phân tích CHI TIẾT frame này (giây ${second}):
            
            Context: Video ${videoInfo.duration}s, ${videoInfo.width}x${videoInfo.height}
            Transcript: ${transcript}
            
            Hãy mô tả CHI TIẾT từng element trong frame:
            1. Mô tả từng object, màu sắc cụ thể, texture, material
            2. Phân tích ánh sáng: hướng, cường độ, màu sắc, bóng đổ
            3. Mô tả composition: vị trí objects, balance, symmetry
            4. Phân tích perspective: góc nhìn, depth, scale
            5. Mô tả camera: angle, movement, focus, depth of field
            6. Phân tích mood: atmosphere, emotion, feeling
            7. Tạo prompt Veo3 CỰC KỲ CHI TIẾT với từng element cụ thể
            
            Prompt Veo3 phải:
            - Mô tả từng object cụ thể với màu sắc, texture, size
            - Mô tả ánh sáng chi tiết: hướng, cường độ, màu sắc
            - Mô tả camera movement cụ thể: pan, zoom, tilt, dolly
            - Mô tả composition chi tiết: framing, rule of thirds
            - Mô tả mood và atmosphere cụ thể
            - Tạo video 8 giây thú vị và liền mạch`;

            // Gọi ChatGPT Vision API
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: userPrompt
                                },
                                ...(imageContent ? [imageContent] : [])
                            ]
                        }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`ChatGPT API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const analysisText = data.choices[0].message.content;
            
            // Parse JSON response
            try {
                const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const analysis = JSON.parse(jsonMatch[0]);
                    detailedAnalysis.push({
                        second: second,
                        frame: frame,
                        analysis: analysis,
                        rawResponse: analysisText
                    });
                    console.log(`✅ [analyzeSecondBySecond] Giây ${second} phân tích thành công`);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseError) {
                console.warn(`⚠️ [analyzeSecondBySecond] Không thể parse JSON cho giây ${second}, tạo mock analysis`);
                
                // Tạo mock analysis cho giây này
                const mockAnalysis = {
                    second: second,
                    description: `Frame at second ${second}`,
                    visual_elements: ["visual element 1", "visual element 2"],
                    mood: "professional",
                    camera_movement: "static",
                    lighting: "bright",
                    colors: ["#ffffff", "#000000"],
                    composition: "medium-shot",
                    veo3_prompt: `Create a professional video scene for second ${second}, with clean composition and bright lighting, showing technology and AI concepts`,
                    continuity: `Connects to previous seconds and leads to next seconds`
                };
                
                detailedAnalysis.push({
                    second: second,
                    frame: frame,
                    analysis: mockAnalysis,
                    rawResponse: analysisText
                });
            }
            
            // Delay để tránh rate limit
            if (i < frames.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return {
            success: true,
            detailedAnalysis,
            totalSeconds: frames.length
        };
        
    } catch (error) {
        console.error('❌ [analyzeSecondBySecond] Lỗi:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// API endpoint
async function analyzeSecondBySecondAPI(req, res) {
    try {
        const { videoPath, startSecond = 0, duration = 8 } = req.body;
        
        if (!videoPath) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu videoPath'
            });
        }
        
        // Kiểm tra file tồn tại
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({
                success: false,
                message: 'Video file không tồn tại'
            });
        }
        
        console.log(`🔍 [analyzeSecondBySecondAPI] Phân tích từ giây ${startSecond} trong ${duration} giây`);
        
        // Extract frames cho duration giây
        const { extractFramesFromVideo, getVideoInfo } = require('./extract-frames');
        
        const videoInfo = await getVideoInfo(videoPath);
        if (!videoInfo.success) {
            return res.status(500).json({
                success: false,
                message: 'Không thể lấy thông tin video',
                error: videoInfo.error
            });
        }
        
        // Extract frames cho duration giây
        const framesResult = await extractFramesFromVideo(videoPath, {
            count: duration,
            interval: 1, // Mỗi 1 giây 1 frame
            startTime: startSecond
        });
        
        if (!framesResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Không thể extract frames',
                error: framesResult.error
            });
        }
        
        // Tạo transcript
        const { generateMockTranscript } = require('./analyze-video-chatgpt');
        const transcript = await generateMockTranscript(videoInfo);
        
        // Phân tích chi tiết từng giây
        const analysis = await analyzeSecondBySecond(framesResult.frames, transcript, videoInfo);
        
        if (!analysis.success) {
            return res.status(500).json({
                success: false,
                message: 'Không thể phân tích chi tiết',
                error: analysis.error
            });
        }
        
        return res.json({
            success: true,
            message: `Đã phân tích chi tiết ${analysis.totalSeconds} giây`,
            videoInfo,
            frames: framesResult.frames,
            transcript,
            detailedAnalysis: analysis.detailedAnalysis
        });
        
    } catch (error) {
        console.error('❌ [analyzeSecondBySecondAPI] Lỗi:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi phân tích chi tiết',
            error: error.message
        });
    }
}

module.exports = {
    analyzeSecondBySecond,
    analyzeSecondBySecondAPI
};
