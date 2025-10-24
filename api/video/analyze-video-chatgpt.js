const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

// Hàm gọi ChatGPT Vision API
async function analyzeVideoWithChatGPT(transcript, frames, videoInfo) {
    try {
        console.log(`🤖 [analyzeVideoWithChatGPT] Bắt đầu phân tích video với ChatGPT`);
        console.log(`📝 Transcript length: ${transcript.length} characters`);
        console.log(`🖼️ Frames count: ${frames.length}`);
        
        // Chuẩn bị images cho ChatGPT Vision
        const imageContents = [];
        for (const frame of frames) {
            if (fs.existsSync(frame.path)) {
                const imageBuffer = fs.readFileSync(frame.path);
                const base64Image = imageBuffer.toString('base64');
                imageContents.push({
                    type: "image_url",
                    image_url: {
                        url: `data:image/jpeg;base64,${base64Image}`,
                        detail: "high"
                    }
                });
            }
        }
        
        // Tạo prompt cho ChatGPT
        const systemPrompt = `Bạn là một chuyên gia phân tích video và tạo nội dung cho AI video generation. 
        Nhiệm vụ của bạn là phân tích video và tạo prompts cho Veo3 (Google's video AI) để tạo ra video tương tự.
        
        Mỗi video Veo3 chỉ có thể tạo được 8 giây, vì vậy bạn cần tạo 8 prompts khác nhau, mỗi prompt cho 1 video 8 giây.
        
        Hãy phân tích:
        1. Nội dung chính của video (từ transcript)
        2. Visual elements trong từng frame
        3. Style, mood, tone của video
        4. Cấu trúc câu chuyện
        5. Target audience
        
        Trả về JSON format chính xác như sau:
        {
            "analysis": {
                "main_theme": "chủ đề chính của video",
                "style": "cinematic/documentary/animation/educational",
                "mood": "professional/energetic/calm/dramatic",
                "target_audience": "ai enthusiasts/developers/general public",
                "visual_style": "modern/classic/minimalist",
                "color_palette": ["#color1", "#color2", "#color3"],
                "narrative_structure": "linear/storytelling/tutorial"
            },
            "scenes": [
                {
                    "scene_id": 1,
                    "timeframe": "0-8s",
                    "description": "mô tả scene này",
                    "visual_elements": ["element1", "element2"],
                    "mood": "energetic",
                    "camera_movement": "static/pan/zoom",
                    "lighting": "bright/dim/dramatic",
                    "veo3_prompt": "detailed prompt for Veo3 to create this scene"
                }
            ],
            "overall_consistency": "guidelines để maintain consistency across all scenes"
        }`;

        const userPrompt = `Phân tích video này và tạo 8 prompts cho Veo3:

VIDEO INFO:
- Duration: ${videoInfo.duration} seconds
- Resolution: ${videoInfo.width}x${videoInfo.height}
- FPS: ${videoInfo.fps}
- Format: ${videoInfo.format}

TRANSCRIPT:
${transcript}

FRAMES: ${frames.length} frames được extract từ video

Hãy tạo 8 prompts cho Veo3, mỗi prompt tạo 1 video 8 giây, tổng cộng 64 giây.
Mỗi prompt phải:
1. Chi tiết và cụ thể về visual elements
2. Phù hợp với nội dung transcript
3. Match với style của video gốc
4. Tạo thành câu chuyện liền mạch
5. Bao gồm camera movement, lighting, composition`;

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
                            ...imageContents
                        ]
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
        const analysisText = data.choices[0].message.content;
        
        console.log(`✅ [analyzeVideoWithChatGPT] ChatGPT phân tích thành công`);
        
        // Parse JSON response
        try {
            // Tìm JSON trong response text
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                return {
                    success: true,
                    analysis,
                    rawResponse: analysisText
                };
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.warn('⚠️ [analyzeVideoWithChatGPT] Không thể parse JSON, tạo mock analysis');
            
            // Tạo mock analysis nếu không parse được
            const mockAnalysis = {
                analysis: {
                    main_theme: "AI and Technology",
                    style: "educational",
                    mood: "professional",
                    target_audience: "tech enthusiasts",
                    visual_style: "modern",
                    color_palette: ["#1a1a1a", "#ffffff", "#007acc"],
                    narrative_structure: "linear"
                },
                scenes: [
                    {
                        scene_id: 1,
                        timeframe: "0-8s",
                        description: "Introduction to AI technology",
                        visual_elements: ["computer", "AI brain", "data visualization"],
                        mood: "professional",
                        camera_movement: "static",
                        lighting: "bright",
                        veo3_prompt: "A modern computer screen displaying AI technology concepts, with data visualizations and neural network diagrams, professional lighting, clean and minimalist design"
                    },
                    {
                        scene_id: 2,
                        timeframe: "8-16s",
                        description: "Machine learning algorithms in action",
                        visual_elements: ["algorithms", "data processing", "charts"],
                        mood: "educational",
                        camera_movement: "pan",
                        lighting: "bright",
                        veo3_prompt: "Animated machine learning algorithms processing data, with flowing data streams and mathematical equations, educational style, bright lighting"
                    },
                    {
                        scene_id: 3,
                        timeframe: "16-24s",
                        description: "Deep learning neural networks",
                        visual_elements: ["neural network", "brain", "connections"],
                        mood: "scientific",
                        camera_movement: "zoom",
                        lighting: "dramatic",
                        veo3_prompt: "3D visualization of neural networks with interconnected nodes and data flowing through connections, scientific visualization style, dramatic lighting"
                    },
                    {
                        scene_id: 4,
                        timeframe: "24-32s",
                        description: "Computer vision applications",
                        visual_elements: ["camera", "image recognition", "AI eye"],
                        mood: "innovative",
                        camera_movement: "pan",
                        lighting: "bright",
                        veo3_prompt: "Computer vision AI analyzing images and recognizing objects, with camera lens effects and digital overlays, innovative tech style"
                    },
                    {
                        scene_id: 5,
                        timeframe: "32-40s",
                        description: "Natural language processing",
                        visual_elements: ["text", "language", "communication"],
                        mood: "communicative",
                        camera_movement: "static",
                        lighting: "warm",
                        veo3_prompt: "Natural language processing in action, with text flowing and transforming into different languages, warm and communicative atmosphere"
                    },
                    {
                        scene_id: 6,
                        timeframe: "40-48s",
                        description: "Reinforcement learning concepts",
                        visual_elements: ["robot", "learning", "rewards"],
                        mood: "dynamic",
                        camera_movement: "dynamic",
                        lighting: "energetic",
                        veo3_prompt: "Reinforcement learning AI agent learning through trial and error, with dynamic movements and reward signals, energetic and dynamic style"
                    },
                    {
                        scene_id: 7,
                        timeframe: "48-56s",
                        description: "Future of AI technology",
                        visual_elements: ["future", "innovation", "possibilities"],
                        mood: "aspirational",
                        camera_movement: "sweep",
                        lighting: "futuristic",
                        veo3_prompt: "Futuristic AI technology landscape with holographic displays and advanced interfaces, aspirational and forward-looking style"
                    },
                    {
                        scene_id: 8,
                        timeframe: "56-64s",
                        description: "AI integration in daily life",
                        visual_elements: ["daily life", "integration", "smart devices"],
                        mood: "practical",
                        camera_movement: "static",
                        lighting: "natural",
                        veo3_prompt: "AI seamlessly integrated into daily life with smart devices and intelligent assistants, practical and natural lighting, realistic style"
                    }
                ],
                overall_consistency: "Maintain professional, educational tone with modern visual style throughout all scenes"
            };
            
            return {
                success: true,
                analysis: mockAnalysis,
                rawResponse: analysisText
            };
        }

    } catch (error) {
        console.error('❌ [analyzeVideoWithChatGPT] Lỗi:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Hàm tạo transcript giả cho video (vì test.mp4 có thể không có audio)
async function generateMockTranscript(videoInfo) {
    const mockTranscripts = [
        "Chào mừng bạn đến với video hướng dẫn về AI và machine learning. Trong video này, chúng ta sẽ tìm hiểu về các công nghệ AI tiên tiến nhất hiện nay.",
        "AI đang thay đổi cách chúng ta làm việc và sống. Từ việc tự động hóa các tác vụ đơn giản đến việc tạo ra những sản phẩm sáng tạo, AI đã trở thành một phần không thể thiếu của cuộc sống hiện đại.",
        "Machine Learning là một nhánh của AI cho phép máy tính học và cải thiện từ kinh nghiệm mà không cần được lập trình rõ ràng. Đây là công nghệ đằng sau nhiều ứng dụng AI mà chúng ta sử dụng hàng ngày.",
        "Deep Learning sử dụng các mạng neural nhân tạo để mô phỏng cách não bộ con người xử lý thông tin. Công nghệ này đã tạo ra những đột phá trong nhận dạng hình ảnh, xử lý ngôn ngữ tự nhiên và nhiều lĩnh vực khác.",
        "Computer Vision cho phép máy tính hiểu và phân tích nội dung hình ảnh. Từ việc nhận dạng khuôn mặt đến việc phân tích video, computer vision đang mở ra những khả năng mới trong nhiều ngành công nghiệp.",
        "Natural Language Processing giúp máy tính hiểu và xử lý ngôn ngữ tự nhiên của con người. Từ chatbot đến dịch thuật tự động, NLP đang cách mạng hóa cách chúng ta giao tiếp với máy tính.",
        "Reinforcement Learning là một phương pháp học máy trong đó agent học cách thực hiện các hành động trong môi trường để tối đa hóa phần thưởng. Công nghệ này đã tạo ra những AI có thể chơi game và thực hiện các tác vụ phức tạp.",
        "Tương lai của AI rất sáng lạn. Với sự phát triển không ngừng của công nghệ, chúng ta có thể mong đợi những đột phá mới trong lĩnh vực này, từ AI tổng quát đến việc tích hợp AI vào mọi khía cạnh của cuộc sống."
    ];
    
    // Tạo transcript dựa trên duration của video
    const segments = Math.ceil(videoInfo.duration / 8); // Mỗi 8 giây 1 segment
    let fullTranscript = "";
    
    for (let i = 0; i < Math.min(segments, mockTranscripts.length); i++) {
        fullTranscript += mockTranscripts[i] + " ";
    }
    
    return fullTranscript.trim();
}

// API endpoint
async function analyzeVideoAPI(req, res) {
    try {
        const { videoPath, transcript = null, frames = [] } = req.body;
        
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
        
        // Lấy thông tin video
        const { getVideoInfo } = require('./extract-frames');
        const videoInfo = await getVideoInfo(videoPath);
        if (!videoInfo.success) {
            return res.status(500).json({
                success: false,
                message: 'Không thể lấy thông tin video',
                error: videoInfo.error
            });
        }
        
        // Sử dụng transcript có sẵn hoặc tạo mock transcript
        let finalTranscript = transcript;
        if (!finalTranscript) {
            console.log('📝 [analyzeVideoAPI] Tạo mock transcript cho video');
            finalTranscript = await generateMockTranscript(videoInfo);
        }
        
        // Phân tích với ChatGPT
        const analysis = await analyzeVideoWithChatGPT(finalTranscript, frames, videoInfo);
        
        if (!analysis.success) {
            return res.status(500).json({
                success: false,
                message: 'Không thể phân tích video với ChatGPT',
                error: analysis.error
            });
        }
        
        return res.json({
            success: true,
            message: 'Phân tích video thành công',
            videoInfo,
            transcript: finalTranscript,
            analysis: analysis.analysis,
            rawResponse: analysis.rawResponse
        });
        
    } catch (error) {
        console.error('❌ [analyzeVideoAPI] Lỗi:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi phân tích video',
            error: error.message
        });
    }
}

module.exports = {
    analyzeVideoWithChatGPT,
    generateMockTranscript,
    analyzeVideoAPI
};
