const fetch = require('node-fetch');

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

// Hàm tạo format JSON hoàn chỉnh cho Veo3
async function generateVeo3Format(detailedAnalysis, videoInfo) {
    try {
        console.log(`🎬 [generateVeo3Format] Tạo format JSON cho ${detailedAnalysis.length} giây`);
        
        const systemPrompt = `Bạn là chuyên gia tạo format JSON cho Veo3 API.
        
        Nhiệm vụ: Tạo JSON format hoàn chỉnh cho Veo3 API dựa trên phân tích chi tiết từng giây.
        
        Veo3 API format:
        {
            "clientContext": {
                "projectId": "ccd41cba-0a8f-4777-8ddb-56feee829abd",
                "tool": "PINHOLE",
                "userPaygateTier": "PAYGATE_TIER_TWO"
            },
            "requests": [
                {
                    "aspectRatio": "VIDEO_ASPECT_RATIO_LANDSCAPE",
                    "seed": random_number,
                    "textInput": {
                        "prompt": "detailed prompt for Veo3"
                    },
                    "videoModelKey": "veo_3_1_t2v_fast_ultra",
                    "metadata": {
                        "sceneId": "unique-uuid"
                    }
                }
            ]
        }
        
        Yêu cầu:
        1. Tạo 1 request cho mỗi giây (8 requests cho 8 giây)
        2. Mỗi prompt phải chi tiết và phù hợp với phân tích
        3. Seed phải khác nhau cho mỗi request
        4. SceneId phải unique cho mỗi request
        5. Prompt phải tạo video 8 giây thú vị và liền mạch
        
        Trả về JSON format chính xác như trên.`;

        const userPrompt = `Tạo format JSON cho Veo3 API dựa trên phân tích chi tiết:

VIDEO INFO:
- Duration: ${videoInfo.duration}s
- Resolution: ${videoInfo.width}x${videoInfo.height}
- FPS: ${videoInfo.fps}

DETAILED ANALYSIS (${detailedAnalysis.length} giây):
${detailedAnalysis.map((item, index) => {
    const analysis = item.analysis;
    return `Giây ${analysis.second}: ${analysis.description}
- Mood: ${analysis.mood}
- Camera: ${analysis.camera_movement}
- Lighting: ${analysis.lighting}
- Colors: ${analysis.colors.join(', ')}
- Composition: ${analysis.composition}
- Veo3 prompt: ${analysis.veo3_prompt}
- Continuity: ${analysis.continuity}`;
}).join('\n\n')}

Tạo JSON format hoàn chỉnh cho Veo3 API với 8 requests (mỗi giây 1 request).`;

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
                max_tokens: 4000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ChatGPT API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const formatText = data.choices[0].message.content;
        
        console.log(`✅ [generateVeo3Format] ChatGPT tạo format thành công`);
        
        // Parse JSON response
        try {
            const jsonMatch = formatText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const veo3Format = JSON.parse(jsonMatch[0]);
                return {
                    success: true,
                    veo3Format,
                    rawResponse: formatText
                };
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.warn('⚠️ [generateVeo3Format] Không thể parse JSON, tạo mock format');
            
            // Tạo mock format
            const mockFormat = {
                clientContext: {
                    projectId: "ccd41cba-0a8f-4777-8ddb-56feee829abd",
                    tool: "PINHOLE",
                    userPaygateTier: "PAYGATE_TIER_TWO"
                },
                requests: detailedAnalysis.map((item, index) => {
                    const analysis = item.analysis;
                    return {
                        aspectRatio: "VIDEO_ASPECT_RATIO_LANDSCAPE",
                        seed: Math.floor(Math.random() * 100000),
                        textInput: {
                            prompt: analysis.veo3_prompt
                        },
                        videoModelKey: "veo_3_1_t2v_fast_ultra",
                        metadata: {
                            sceneId: `scene-${analysis.second}-${Date.now()}-${index}`
                        }
                    };
                })
            };
            
            return {
                success: true,
                veo3Format: mockFormat,
                rawResponse: formatText
            };
        }

    } catch (error) {
        console.error('❌ [generateVeo3Format] Lỗi:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// API endpoint
async function generateVeo3FormatAPI(req, res) {
    try {
        const { detailedAnalysis, videoInfo } = req.body;
        
        if (!detailedAnalysis || !videoInfo) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu detailedAnalysis hoặc videoInfo'
            });
        }
        
        console.log(`🎬 [generateVeo3FormatAPI] Tạo format JSON cho ${detailedAnalysis.length} giây`);
        
        const result = await generateVeo3Format(detailedAnalysis, videoInfo);
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Không thể tạo format JSON',
                error: result.error
            });
        }
        
        return res.json({
            success: true,
            message: `Đã tạo format JSON cho ${detailedAnalysis.length} giây`,
            veo3Format: result.veo3Format,
            rawResponse: result.rawResponse
        });
        
    } catch (error) {
        console.error('❌ [generateVeo3FormatAPI] Lỗi:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi tạo format JSON',
            error: error.message
        });
    }
}

module.exports = {
    generateVeo3Format,
    generateVeo3FormatAPI
};
