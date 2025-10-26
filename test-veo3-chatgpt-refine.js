const fetch = require('node-fetch');
const fs = require('fs');

async function refineWithChatGPTAndCreateVeo3() {
    try {
        console.log('🎬 [Test] Đưa kết quả cho ChatGPT mô tả chi tiết và đồng nhất...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Đọc kết quả phân tích có sẵn
        console.log('📖 [Step 1] Đọc kết quả phân tích...');
        const resultPath = './temp/veo3-simple/veo3-simple-result.json';
        const resultData = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
        
        console.log(`📖 [Step 1] Đã đọc ${resultData.veo3JSON.length} segments`);
        
        // Tạo prompt cho ChatGPT để mô tả chi tiết và đồng nhất
        console.log('🤖 [Step 2] Gửi kết quả cho ChatGPT để mô tả chi tiết...');
        
        const chatgptPrompt = `Bạn là chuyên gia tạo prompt video cho Veo3. 

Nhiệm vụ: Tạo một prompt CHI TIẾT và ĐỒNG NHẤT cho video 8 giây dựa trên phân tích từng cảnh.

PHÂN TÍCH GỐC:
${resultData.veo3JSON.map((segment, index) => 
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

        // Gọi ChatGPT API
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';
        
        const chatgptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Bạn là chuyên gia tạo prompt video cho Veo3 với khả năng mô tả chi tiết và đồng nhất.' },
                    { role: 'user', content: chatgptPrompt }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });
        
        const chatgptResult = await chatgptResponse.json();
        
        if (chatgptResult.choices && chatgptResult.choices[0]) {
            const refinedPrompt = chatgptResult.choices[0].message.content;
            console.log('🤖 [Step 2] ChatGPT đã tạo prompt chi tiết:');
            console.log(`🤖 [Step 2] ${refinedPrompt.substring(0, 200)}...`);
            
            // Tạo video Veo3 với prompt đã được ChatGPT refine
            console.log('🎬 [Step 3] Tạo video Veo3 với prompt đã refine...');
            const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: refinedPrompt,
                    prompt: refinedPrompt
                })
            });
            
            const veo3Result = await veo3Response.json();
            console.log('🎬 [Step 3] Veo3 result:', veo3Result.success ? '✅ Success' : '❌ Failed');
            
            if (veo3Result.success) {
                console.log(`🎬 [Step 3] Video Veo3 đã được tạo: ${veo3Result.operationName}`);
                console.log(`🎬 [Step 3] Status: ${veo3Result.videoStatus}`);
                
                // Lưu kết quả hoàn chỉnh
                const finalResult = {
                    timestamp: new Date().toISOString(),
                    originalVideo: 'test.mp4 (8s)',
                    analysisSegments: resultData.veo3JSON.length,
                    originalAnalysis: resultData.veo3JSON,
                    chatgptRefinedPrompt: refinedPrompt,
                    veo3Operation: veo3Result.operationName,
                    veo3Status: veo3Result.videoStatus
                };
                
                const finalPath = './temp/veo3-chatgpt-refined-result.json';
                fs.writeFileSync(finalPath, JSON.stringify(finalResult, null, 2));
                
                console.log(`📊 [Step 3] Đã lưu kết quả vào: ${finalPath}`);
                
                // Tóm tắt
                console.log('📊 [Step 4] Tóm tắt:');
                console.log(`📊 [Step 4] - Video gốc: test.mp4 (8s)`);
                console.log(`📊 [Step 4] - Phân tích gốc: ${resultData.veo3JSON.length} segments`);
                console.log(`📊 [Step 4] - ChatGPT refine: ✅ Hoàn thành`);
                console.log(`📊 [Step 4] - Video Veo3: ${veo3Result.success ? '✅ Thành công' : '❌ Thất bại'}`);
                console.log(`📊 [Step 4] - Operation ID: ${veo3Result.operationName}`);
                
                console.log('🎉 [Test] Hoàn thành workflow ChatGPT refine + Veo3!');
                
            } else {
                console.log(`❌ [Step 3] Tạo video Veo3 thất bại: ${veo3Result.message}`);
            }
            
        } else {
            throw new Error('ChatGPT không trả về kết quả hợp lệ');
        }
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] ChatGPT refine + Veo3 workflow...');
refineWithChatGPTAndCreateVeo3();
