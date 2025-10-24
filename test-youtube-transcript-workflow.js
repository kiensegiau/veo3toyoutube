const fetch = require('node-fetch');

async function testYouTubeTranscriptWorkflow() {
    try {
        console.log('🚀 [Test] Test YouTube Transcript Workflow...');
        
        const serverUrl = 'http://localhost:8888';
        const youtubeUrl = 'https://youtu.be/52ru0qDc0LQ?si=zahSVRyDiQy7Jd6H';
        
        // Test lấy transcript từ YouTube
        console.log('📝 [Step 1] Lấy transcript từ YouTube...');
        const transcriptResponse = await fetch(`${serverUrl}/api/get-transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: youtubeUrl,
                lang: 'vi'
            })
        });
        
        const transcriptResult = await transcriptResponse.json();
        console.log('📝 [Step 1] Transcript result:', transcriptResult.success ? '✅ Success' : '❌ Failed');
        
        if (transcriptResult.success) {
            const transcriptText = typeof transcriptResult.transcript === 'string' ? transcriptResult.transcript : JSON.stringify(transcriptResult.transcript);
            console.log(`📝 [Step 1] Transcript: ${transcriptText.substring(0, 300)}...`);
            
            // Test ChatGPT phân tích transcript và tạo chủ đề
            console.log('🤖 [Step 2] ChatGPT phân tích transcript và tạo chủ đề...');
            const chatGPTResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer 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`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { 
                            role: "system", 
                            content: `Bạn là chuyên gia phân tích nội dung video với khả năng tóm tắt và xác định chủ đề chính.

Nhiệm vụ: Phân tích transcript này để xác định:
1. CHỦ ĐỀ CHÍNH của video
2. ĐỊA ĐIỂM/THIẾT LẬP chung
3. PHONG CÁCH VISUAL phù hợp
4. MÀU SẮC CHỦ ĐẠO
5. TÂM TRẠNG/CẢM XÚC
6. TÍNH LIÊN KẾT giữa các cảnh
7. HƯỚNG PHÁT TRIỂN của video
8. PROMPT TỔNG THỂ cho Veo3

Trả về JSON format:
{
    "mainTheme": "chủ đề chính của video",
    "location": "địa điểm/thể loại chung",
    "visualStyle": "phong cách visual phù hợp với nội dung",
    "colorPalette": ["màu chủ đạo 1", "màu chủ đạo 2"],
    "mood": "tâm trạng/cảm xúc từ nội dung",
    "continuity": "cách các cảnh liên kết với nhau",
    "sceneProgression": "hướng phát triển từ cảnh này sang cảnh khác",
    "unifiedPrompt": "prompt tổng thể để tạo video liền mạch dựa trên nội dung transcript",
    "contentSummary": "tóm tắt ngắn gọn nội dung chính"
}` 
                        },
                        { 
                            role: "user", 
                            content: `Phân tích transcript này để xác định chủ đề tổng thể và tạo prompt cho video 32 giây:

TRANSCRIPT:
${transcriptText}

Yêu cầu: Tạo prompt Veo3 phù hợp với nội dung thực tế của video, không phải generic.` 
                        }
                    ],
                    max_tokens: 1500,
                    temperature: 0.7
                })
            });
            
            const chatGPTResult = await chatGPTResponse.json();
            console.log('🤖 [Step 2] ChatGPT result:', chatGPTResult.choices ? '✅ Success' : '❌ Failed');
            
            if (chatGPTResult.choices) {
                const analysisText = chatGPTResult.choices[0].message.content;
                console.log(`🤖 [Step 2] Phân tích hoàn chỉnh:`);
                console.log(analysisText);
                
                // Parse JSON từ response
                try {
                    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const analysis = JSON.parse(jsonMatch[0]);
                        console.log(`✅ [Step 2] Đã phân tích chủ đề: ${analysis.mainTheme}`);
                        console.log(`✅ [Step 2] Tóm tắt nội dung: ${analysis.contentSummary}`);
                        console.log(`✅ [Step 2] Prompt tổng thể: ${analysis.unifiedPrompt}`);
                        
                        // Test tạo video Veo3 với prompt từ transcript
                        console.log('🎬 [Step 3] Test tạo video Veo3 với prompt từ transcript...');
                        const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                input: analysis.unifiedPrompt,
                                prompt: analysis.unifiedPrompt
                            })
                        });
                        
                        const veo3Result = await veo3Response.json();
                        console.log('🎬 [Step 3] Veo3 result:', veo3Result.success ? '✅ Success' : '❌ Failed');
                        
                        if (veo3Result.success) {
                            console.log(`🎬 [Step 3] Video Veo3 đã được tạo: ${veo3Result.operationName}`);
                            console.log(`🎬 [Step 3] Status: ${veo3Result.videoStatus}`);
                        } else {
                            console.log(`❌ [Step 3] Veo3 thất bại: ${veo3Result.message}`);
                        }
                        
                    } else {
                        console.log(`⚠️ [Step 2] Không thể parse JSON từ ChatGPT response`);
                    }
                } catch (parseError) {
                    console.log(`⚠️ [Step 2] Lỗi parse JSON:`, parseError.message);
                }
            }
            
        } else {
            console.log(`❌ [Step 1] Transcript thất bại: ${transcriptResult.message}`);
        }
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Test YouTube Transcript Workflow...');
testYouTubeTranscriptWorkflow();
