/**
 * Test script for transcript rewriting functionality
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8888';

async function testRewriteTranscript() {
    console.log('🧪 Testing transcript rewriting with ChatGPT...\n');

    try {
        // First, list available transcript files
        console.log('1️⃣ Liệt kê file transcript có sẵn...');
        const listResponse = await fetch(`${BASE_URL}/api/list-transcripts`);
        const listResult = await listResponse.json();
        
        if (!listResult.success || listResult.files.length === 0) {
            console.log('❌ Không có file transcript nào để test');
            return;
        }

        const testFile = listResult.files[0];
        console.log(`📄 Sử dụng file: ${testFile.filename}`);

        // Test rewrite with different intensities
        const intensities = ['light', 'medium', 'heavy'];
        
        for (const intensity of intensities) {
            console.log(`\n2️⃣ Viết lại transcript với intensity: ${intensity}`);
            
            const rewriteResponse = await fetch(`${BASE_URL}/api/rewrite-transcript`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: testFile.filename,
                    openaiApiKey: 'YOUR_OPENAI_API_KEY_HERE', // Thay bằng API key thật
                    intensity: intensity
                })
            });

            const rewriteResult = await rewriteResponse.json();
            
            if (rewriteResult.success) {
                console.log(`✅ Viết lại thành công với intensity ${intensity}!`);
                console.log(`📄 File mới: ${rewriteResult.rewrittenFilename}`);
                console.log(`📊 Độ dài gốc: ${rewriteResult.originalLength} ký tự`);
                console.log(`📊 Độ dài mới: ${rewriteResult.rewrittenLength} ký tự`);
                console.log(`📝 Preview gốc: ${rewriteResult.changes.original}`);
                console.log(`📝 Preview mới: ${rewriteResult.changes.rewritten}`);
                
                // Test comparison
                console.log(`\n3️⃣ So sánh transcript gốc và đã viết lại...`);
                const compareResponse = await fetch(`${BASE_URL}/api/compare-transcripts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        originalFilename: testFile.filename,
                        rewrittenFilename: rewriteResult.rewrittenFilename
                    })
                });

                const compareResult = await compareResponse.json();
                
                if (compareResult.success) {
                    console.log(`📊 Kết quả so sánh:`);
                    console.log(`   📈 Thay đổi từ: ${compareResult.comparison.metrics.wordChangePercentage}`);
                    console.log(`   🔄 Độ tương đồng: ${compareResult.comparison.metrics.similarity}`);
                    console.log(`   📏 Chênh lệch độ dài: ${compareResult.comparison.metrics.lengthDifference} ký tự`);
                } else {
                    console.log(`❌ Lỗi so sánh: ${compareResult.message}`);
                }
                
            } else {
                console.log(`❌ Lỗi viết lại với intensity ${intensity}: ${rewriteResult.message}`);
                if (rewriteResult.error && rewriteResult.error.includes('OpenAI API')) {
                    console.log(`💡 Lưu ý: Cần thiết lập OpenAI API key hợp lệ`);
                }
            }
        }

    } catch (error) {
        console.error('❌ Lỗi test:', error.message);
    }
}

// Test with mock data (không cần OpenAI API key)
async function testRewriteWithMock() {
    console.log('🧪 Testing transcript rewriting with mock data...\n');

    try {
        // List available files
        console.log('1️⃣ Liệt kê file transcript có sẵn...');
        const listResponse = await fetch(`${BASE_URL}/api/list-transcripts`);
        const listResult = await listResponse.json();
        
        if (!listResult.success || listResult.files.length === 0) {
            console.log('❌ Không có file transcript nào để test');
            return;
        }

        const testFile = listResult.files[0];
        console.log(`📄 File test: ${testFile.filename}`);
        console.log(`📊 Kích thước: ${(testFile.size / 1024).toFixed(2)} KB`);
        console.log(`📅 Tạo lúc: ${new Date(testFile.created).toLocaleString()}`);

        // Show file content preview
        console.log(`\n2️⃣ Xem nội dung file...`);
        const fileResponse = await fetch(`${BASE_URL}/api/get-transcript-file/${testFile.filename}`);
        const fileResult = await fileResponse.json();
        
        if (fileResult.success) {
            console.log(`📖 Nội dung (200 ký tự đầu):`);
            console.log(`"${fileResult.content.substring(0, 200)}..."`);
            console.log(`📊 Tổng độ dài: ${fileResult.content.length} ký tự`);
            console.log(`📊 Số từ: ${fileResult.content.split(/\s+/).length} từ`);
        } else {
            console.log(`❌ Lỗi đọc file: ${fileResult.message}`);
        }

    } catch (error) {
        console.error('❌ Lỗi test:', error.message);
    }
}

// Run the test
if (require.main === module) {
    // Test with mock data first (không cần API key)
    testRewriteWithMock();
    
    // Uncomment để test với OpenAI API (cần API key)
    // testRewriteTranscript();
}

module.exports = { testRewriteTranscript, testRewriteWithMock };
