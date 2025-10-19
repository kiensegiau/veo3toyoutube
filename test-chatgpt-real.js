/**
 * Test script for ChatGPT transcript rewriting with real API key
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8888';
const OPENAI_API_KEY = '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';

async function testChatGPTRewriteReal() {
    console.log('🤖 Testing ChatGPT transcript rewriting with real API key...\n');

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
        console.log(`📊 Kích thước: ${(originalFile.size / 1024).toFixed(2)} KB`);

        // Test different styles and intensities
        const testCases = [
            { style: 'natural', intensity: 'light', description: 'Tự nhiên nhẹ - Thay đổi ít, giữ nguyên ý nghĩa' },
            { style: 'casual', intensity: 'light', description: 'Thân thiện nhẹ - Ngôn ngữ gần gũi, dễ hiểu' },
            { style: 'formal', intensity: 'light', description: 'Trang trọng nhẹ - Ngôn ngữ lịch sự, chuyên nghiệp' }
        ];

        for (const testCase of testCases) {
            console.log(`\n2️⃣ Test ChatGPT rewrite: ${testCase.description}`);
            console.log(`🎨 Style: ${testCase.style}, Intensity: ${testCase.intensity}`);
            
            const rewriteResponse = await fetch(`${BASE_URL}/api/rewrite-with-chatgpt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: originalFile.filename,
                    openaiApiKey: OPENAI_API_KEY,
                    style: testCase.style,
                    intensity: testCase.intensity
                })
            });

            const rewriteResult = await rewriteResponse.json();
            
            if (rewriteResult.success) {
                console.log(`✅ ChatGPT rewrite thành công!`);
                console.log(`📄 File mới: ${rewriteResult.rewrittenFilename}`);
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
                    console.log(`   📝 Số từ thay đổi: ${compareResult.comparison.metrics.wordDifference}`);
                }
                
            } else {
                console.log(`❌ Lỗi ChatGPT rewrite: ${rewriteResult.message}`);
                if (rewriteResult.error) {
                    console.log(`🔍 Chi tiết lỗi: ${rewriteResult.error}`);
                }
            }

            // Add delay between tests
            console.log('\n⏳ Chờ 3 giây trước khi test tiếp...');
            await new Promise(resolve => setTimeout(resolve, 3000));
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
                openaiApiKey: OPENAI_API_KEY,
                styles: ['natural', 'casual']
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

        // Final summary
        console.log(`\n5️⃣ Tóm tắt kết quả...`);
        const finalListResponse = await fetch(`${BASE_URL}/api/list-transcripts`);
        const finalListResult = await finalListResponse.json();
        
        if (finalListResult.success) {
            const chatgptFiles = finalListResult.files.filter(f => f.filename.includes('_chatgpt_'));
            console.log(`📁 Tổng số file transcript: ${finalListResult.files.length}`);
            console.log(`🤖 Số file ChatGPT: ${chatgptFiles.length}`);
            
            if (chatgptFiles.length > 0) {
                console.log('\n📋 Danh sách file ChatGPT:');
                chatgptFiles.forEach(file => {
                    console.log(`   📄 ${file.filename}`);
                    console.log(`      📊 Kích thước: ${(file.size / 1024).toFixed(2)} KB`);
                    console.log(`      📅 Tạo lúc: ${new Date(file.created).toLocaleString()}`);
                });
            }
        }

    } catch (error) {
        console.error('❌ Lỗi test:', error.message);
    }
}

// Run the test
if (require.main === module) {
    testChatGPTRewriteReal();
}

module.exports = { testChatGPTRewriteReal };
