/**
 * Test script for optimized ChatGPT transcript rewriting (15% changes, single style)
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8888';
const OPENAI_API_KEY = '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';

async function testOptimizedChatGPT() {
    console.log('🤖 Testing optimized ChatGPT rewrite (15% changes, single style)...\n');

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

        // Test optimized ChatGPT rewrite
        console.log(`\n2️⃣ Test ChatGPT rewrite tối ưu (15% thay đổi)...`);
        
        const rewriteResponse = await fetch(`${BASE_URL}/api/rewrite-with-chatgpt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: originalFile.filename,
                openaiApiKey: OPENAI_API_KEY
            })
        });

        const rewriteResult = await rewriteResponse.json();
        
        if (rewriteResult.success) {
            console.log(`✅ ChatGPT rewrite thành công!`);
            console.log(`📄 File mới: ${rewriteResult.rewrittenFilename}`);
            console.log(`🎯 Loại rewrite: ${rewriteResult.rewriteType}`);
            console.log(`📝 Chunks processed: ${rewriteResult.chunksProcessed}`);
            console.log(`📊 Độ dài gốc: ${rewriteResult.originalLength} ký tự`);
            console.log(`📊 Độ dài mới: ${rewriteResult.rewrittenLength} ký tự`);
            console.log(`🔄 Channel replacements: ${rewriteResult.channelReplacements}`);
            
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
                
                // Check if change percentage is around 15%
                const changePercent = parseFloat(compareResult.comparison.metrics.wordChangePercentage);
                if (changePercent >= 10 && changePercent <= 20) {
                    console.log(`✅ Thay đổi trong khoảng hợp lý (${changePercent.toFixed(2)}%)`);
                } else {
                    console.log(`⚠️ Thay đổi ngoài khoảng mong muốn (${changePercent.toFixed(2)}%)`);
                }
            }

            // Check if channel names were replaced
            console.log(`\n4️⃣ Kiểm tra thay đổi tên kênh...`);
            const fileResponse = await fetch(`${BASE_URL}/api/get-transcript-file/${rewriteResult.rewrittenFilename}`);
            const fileResult = await fileResponse.json();
            
            if (fileResult.success) {
                const content = fileResult.content;
                const chuChuCount = (content.match(/Chu Chu Audio/gi) || []).length;
                const chuChuShortCount = (content.match(/Chu Chu/gi) || []).length;
                const kenKenCount = (content.match(/Ken Ken Audio/gi) || []).length;
                const kenKenShortCount = (content.match(/Ken Ken/gi) || []).length;
                
                console.log(`📊 Thống kê tên kênh trong file mới:`);
                console.log(`   🔴 Chu Chu Audio: ${chuChuCount} lần`);
                console.log(`   🔴 Chu Chu: ${chuChuShortCount} lần`);
                console.log(`   🟢 Ken Ken Audio: ${kenKenCount} lần`);
                console.log(`   🟢 Ken Ken: ${kenKenShortCount} lần`);
                
                if (kenKenCount > 0 || kenKenShortCount > 0) {
                    console.log(`✅ Tên kênh đã được thay đổi thành Ken Ken Audio!`);
                } else {
                    console.log(`⚠️ Không tìm thấy tên kênh Ken Ken trong file`);
                }
            }
            
        } else {
            console.log(`❌ Lỗi ChatGPT rewrite: ${rewriteResult.message}`);
            if (rewriteResult.error) {
                console.log(`🔍 Chi tiết lỗi: ${rewriteResult.error}`);
            }
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
                console.log('\n📋 Danh sách file ChatGPT (tối ưu):');
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
    testOptimizedChatGPT();
}

module.exports = { testOptimizedChatGPT };
