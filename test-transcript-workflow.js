const fetch = require('node-fetch');

async function testTranscriptWorkflow() {
    try {
        console.log('🚀 [Test] Test Transcript Workflow...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Test chỉ lấy transcript trước
        console.log('📝 [Step 1] Test lấy transcript...');
        const transcriptResponse = await fetch(`${serverUrl}/api/get-transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoUrl: './test.mp4',
                language: 'vi'
            })
        });
        
        const transcriptResult = await transcriptResponse.json();
        console.log('📝 [Step 1] Transcript result:', transcriptResult.success ? '✅ Success' : '❌ Failed');
        
        if (transcriptResult.success) {
            console.log(`📝 [Step 1] Transcript: ${transcriptResult.transcript?.substring(0, 200)}...`);
            
            // Test ChatGPT phân tích transcript
            console.log('🤖 [Step 2] Test ChatGPT phân tích transcript...');
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
                            content: "Bạn là chuyên gia phân tích nội dung video. Phân tích transcript và tóm tắt chủ đề chính." 
                        },
                        { 
                            role: "user", 
                            content: `Phân tích transcript này và tóm tắt chủ đề chính:\n\n${transcriptResult.transcript}` 
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                })
            });
            
            const chatGPTResult = await chatGPTResponse.json();
            console.log('🤖 [Step 2] ChatGPT result:', chatGPTResult.choices ? '✅ Success' : '❌ Failed');
            
            if (chatGPTResult.choices) {
                console.log(`🤖 [Step 2] Phân tích: ${chatGPTResult.choices[0].message.content}`);
            }
            
        } else {
            console.log(`❌ [Step 1] Transcript thất bại: ${transcriptResult.message}`);
        }
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Test Transcript Workflow...');
testTranscriptWorkflow();
