/**
 * Test script for ChatGPT transcript rewriting
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8888';

async function testChatGPTRewrite() {
    console.log('🤖 Testing ChatGPT transcript rewriting...\n');

    try {
        // First, list available transcript files
        console.log('1️⃣ Liệt kê file transcript có sẵn...');
        const listResponse = await fetch(`${BASE_URL}/api/list-transcripts`);
        const listResult = await listResponse.json();
        
        if (!listResult.success || listResult.files.length === 0) {
            console.log('❌ Không có file transcript nào để test');
            return;
        }

        // Find original file (not rewritten)
        const originalFile = listResult.files.find(f => 
            !f.filename.includes('_replaced_') && 
            !f.filename.includes('_rewritten_') && 
            !f.filename.includes('_chatgpt_')
        );

        if (!originalFile) {
            console.log('❌ Không tìm thấy file gốc để test');
            return;
        }

        console.log(`📄 Sử dụng file gốc: ${originalFile.filename}`);

        // Test different styles and intensities
        const testCases = [
            { style: 'natural', intensity: 'light' },
            { style: 'natural', intensity: 'medium' },
            { style: 'casual', intensity: 'light' },
            { style: 'formal', intensity: 'light' }
        ];

        for (const testCase of testCases) {
            console.log(`\n2️⃣ Test ChatGPT rewrite với style: ${testCase.style}, intensity: ${testCase.intensity}`);
            
            const rewriteResponse = await fetch(`${BASE_URL}/api/rewrite-with-chatgpt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: originalFile.filename,
                    openaiApiKey: 'YOUR_OPENAI_API_KEY_HERE', // Thay bằng API key thật
                    style: testCase.style,
                    intensity: testCase.intensity
                })
            });

            const rewriteResult = await rewriteResponse.json();
            
            if (rewriteResult.success) {
                console.log(`✅ ChatGPT rewrite thành công!`);
                console.log(`📄 File mới: ${rewriteResult.rewrittenFilename}`);
                console.log(`🎨 Style: ${rewriteResult.style}`);
                console.log(`⚡ Intensity: ${rewriteResult.intensity}`);
                console.log(`📝 Chunks processed: ${rewriteResult.chunksProcessed}`);
                console.log(`📊 Độ dài gốc: ${rewriteResult.originalLength} ký tự`);
                console.log(`📊 Độ dài mới: ${rewriteResult.rewrittenLength} ký tự`);
                
                console.log('\n📖 Preview thay đổi:');
                console.log(`Gốc: ${rewriteResult.changes.original}`);
                console.log(`Mới: ${rewriteResult.changes.rewritten}`);
                
                // Test comparison
                console.log(`\n3️⃣ So sánh với file gốc...`);
                const compareResponse = await fetch(`${BASE_URL}/api/compare-transcripts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        originalFilename: originalFile.filename,
                        rewrittenFilename: rewriteResult.rewrittenFilename
                    })
                });

                const compareResult = await compareResponse.json();
                
                if (compareResult.success) {
                    console.log(`📊 Kết quả so sánh:`);
                    console.log(`   📈 Thay đổi từ: ${compareResult.comparison.metrics.wordChangePercentage}`);
                    console.log(`   🔄 Độ tương đồng: ${compareResult.comparison.metrics.similarity}`);
                    console.log(`   📏 Chênh lệch độ dài: ${compareResult.comparison.metrics.lengthDifference} ký tự`);
                }
                
            } else {
                console.log(`❌ Lỗi ChatGPT rewrite: ${rewriteResult.message}`);
                if (rewriteResult.error && rewriteResult.error.includes('OpenAI API')) {
                    console.log(`💡 Lưu ý: Cần thiết lập OpenAI API key hợp lệ`);
                }
            }
        }

        // Test smart rewrite
        console.log(`\n4️⃣ Test Smart Rewrite với nhiều phong cách...`);
        const smartResponse = await fetch(`${BASE_URL}/api/smart-rewrite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: originalFile.filename,
                openaiApiKey: 'YOUR_OPENAI_API_KEY_HERE', // Thay bằng API key thật
                styles: ['natural', 'casual', 'formal']
            })
        });

        const smartResult = await smartResponse.json();
        
        if (smartResult.success) {
            console.log(`✅ Smart rewrite thành công!`);
            console.log(`📊 Tổng số phong cách: ${smartResult.totalStyles}`);
            console.log(`📊 Số phong cách thành công: ${smartResult.successfulStyles}`);
            
            console.log('\n📝 Kết quả từng phong cách:');
            smartResult.results.forEach((result, index) => {
                if (result.error) {
                    console.log(`   ❌ ${result.style}: ${result.error}`);
                } else {
                    console.log(`   ✅ ${result.style}: ${result.filename}`);
                    console.log(`      📊 Độ dài: ${result.length} ký tự`);
                }
            });
        } else {
            console.log(`❌ Lỗi Smart rewrite: ${smartResult.message}`);
        }

    } catch (error) {
        console.error('❌ Lỗi test:', error.message);
    }
}

// Test with mock data (không cần OpenAI API key)
async function testChatGPTRewriteMock() {
    console.log('🤖 Testing ChatGPT rewrite with mock data...\n');

    try {
        // List files
        const listResponse = await fetch(`${BASE_URL}/api/list-transcripts`);
        const listResult = await listResponse.json();
        
        if (!listResult.success || listResult.files.length === 0) {
            console.log('❌ Không có file transcript nào để test');
            return;
        }

        const originalFile = listResult.files.find(f => 
            !f.filename.includes('_replaced_') && 
            !f.filename.includes('_rewritten_') && 
            !f.filename.includes('_chatgpt_')
        );

        if (!originalFile) {
            console.log('❌ Không tìm thấy file gốc để test');
            return;
        }

        console.log(`📄 File gốc: ${originalFile.filename}`);
        console.log(`📊 Kích thước: ${(originalFile.size / 1024).toFixed(2)} KB`);
        console.log(`📅 Tạo lúc: ${new Date(originalFile.created).toLocaleString()}`);

        // Show original content preview
        console.log(`\n📖 Nội dung gốc (300 ký tự đầu):`);
        const fileResponse = await fetch(`${BASE_URL}/api/get-transcript-file/${originalFile.filename}`);
        const fileResult = await fileResponse.json();
        
        if (fileResult.success) {
            console.log(`"${fileResult.content.substring(0, 300)}..."`);
            console.log(`📊 Tổng độ dài: ${fileResult.content.length} ký tự`);
            console.log(`📊 Số từ: ${fileResult.content.split(/\s+/).length} từ`);
            
            // Show what ChatGPT would change
            console.log(`\n🎨 Các phong cách ChatGPT có thể áp dụng:`);
            console.log(`   📝 Natural (Tự nhiên): Thay đổi ngôn từ để nghe tự nhiên hơn`);
            console.log(`   😊 Casual (Thân thiện): Sử dụng ngôn ngữ thân thiện, gần gũi`);
            console.log(`   🎩 Formal (Trang trọng): Sử dụng ngôn ngữ trang trọng, lịch sự`);
            console.log(`   ⚡ Light (Nhẹ): Thay đổi ít, giữ nguyên ý nghĩa`);
            console.log(`   🔥 Medium (Trung bình): Thay đổi vừa phải`);
            console.log(`   💥 Heavy (Mạnh): Thay đổi nhiều hơn`);
        }

    } catch (error) {
        console.error('❌ Lỗi test:', error.message);
    }
}

// Run the test
if (require.main === module) {
    // Test with mock data first (không cần API key)
    testChatGPTRewriteMock();
    
    // Uncomment để test với OpenAI API (cần API key)
    // testChatGPTRewrite();
}

module.exports = { testChatGPTRewrite, testChatGPTRewriteMock };
