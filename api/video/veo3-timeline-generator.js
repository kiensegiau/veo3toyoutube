const fetch = require('node-fetch');

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

// Hàm tạo timeline JSON cho Veo3
async function generateVeo3Timeline(detailedAnalysis, videoInfo) {
    try {
        console.log(`🎬 [generateVeo3Timeline] Tạo timeline JSON cho ${detailedAnalysis.length} giây`);
        
        const systemPrompt = `Bạn là chuyên gia tạo timeline video cho Veo3.
        
        Nhiệm vụ: Tạo timeline JSON hoàn chỉnh dựa trên phân tích chi tiết từng giây.
        
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

DETAILED ANALYSIS (${detailedAnalysis.length} giây):
${detailedAnalysis.map((item, index) => {
    const analysis = item.analysis;
    return `Giây ${analysis.second}:
- Description: ${analysis.description}
- Visual elements: ${analysis.visual_elements?.join(', ') || 'N/A'}
- Colors: ${analysis.colors?.join(', ') || 'N/A'}
- Lighting: ${analysis.lighting || 'N/A'}
- Camera angle: ${analysis.camera_angle || 'N/A'}
- Camera movement: ${analysis.camera_movement || 'N/A'}
- Composition: ${analysis.composition || 'N/A'}
- Mood: ${analysis.mood || 'N/A'}
- Veo3 prompt: ${analysis.veo3_prompt || 'N/A'}`;
}).join('\n\n')}

Tạo timeline JSON với:
- Mỗi segment 2 giây
- CameraStyle phải CỤ THỂ về góc máy quay
- Action mô tả hành động chi tiết
- VisualDetails chi tiết về màu sắc, ánh sáng
- SoundFocus phù hợp với scene
- Timeline liền mạch và logic`;

        // Gọi ChatGPT API
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
                        content: userPrompt
                    }
                ],
                max_tokens: 3000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ChatGPT API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const timelineText = data.choices[0].message.content;
        
        console.log(`✅ [generateVeo3Timeline] ChatGPT tạo timeline thành công`);
        
        // Parse JSON response
        try {
            const jsonMatch = timelineText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const timeline = JSON.parse(jsonMatch[0]);
                return {
                    success: true,
                    timeline,
                    rawResponse: timelineText
                };
            } else {
                throw new Error('No JSON array found in response');
            }
        } catch (parseError) {
            console.warn('⚠️ [generateVeo3Timeline] Không thể parse JSON, tạo mock timeline');
            
            // Tạo mock timeline dựa trên detailedAnalysis
            const mockTimeline = [];
            for (let i = 0; i < detailedAnalysis.length; i += 2) {
                const currentAnalysis = detailedAnalysis[i].analysis;
                const nextAnalysis = detailedAnalysis[i + 1]?.analysis;
                
                const segment = {
                    timeStart: i,
                    timeEnd: Math.min(i + 2, detailedAnalysis.length),
                    action: `${currentAnalysis.description} transitioning to ${nextAnalysis?.description || 'next scene'}`,
                    cameraStyle: `${currentAnalysis.camera_angle || 'medium-shot'}, ${currentAnalysis.camera_movement || 'static'}`,
                    soundFocus: `ambient sound matching ${currentAnalysis.mood || 'professional'} mood`,
                    visualDetails: `${currentAnalysis.lighting || 'bright'} lighting with ${currentAnalysis.colors?.join(', ') || 'neutral'} colors`
                };
                
                mockTimeline.push(segment);
            }
            
            return {
                success: true,
                timeline: mockTimeline,
                rawResponse: timelineText
            };
        }

    } catch (error) {
        console.error('❌ [generateVeo3Timeline] Lỗi:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// API endpoint
async function generateVeo3TimelineAPI(req, res) {
    try {
        const { detailedAnalysis, videoInfo } = req.body;
        
        if (!detailedAnalysis || !videoInfo) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu detailedAnalysis hoặc videoInfo'
            });
        }
        
        console.log(`🎬 [generateVeo3TimelineAPI] Tạo timeline JSON cho ${detailedAnalysis.length} giây`);
        
        const result = await generateVeo3Timeline(detailedAnalysis, videoInfo);
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Không thể tạo timeline JSON',
                error: result.error
            });
        }
        
        return res.json({
            success: true,
            message: `Đã tạo timeline JSON cho ${detailedAnalysis.length} giây`,
            timeline: result.timeline,
            rawResponse: result.rawResponse
        });
        
    } catch (error) {
        console.error('❌ [generateVeo3TimelineAPI] Lỗi:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi tạo timeline JSON',
            error: error.message
        });
    }
}

module.exports = {
    generateVeo3Timeline,
    generateVeo3TimelineAPI
};
