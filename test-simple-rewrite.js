/**
 * Simple test for ChatGPT rewrite
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8888';
const OPENAI_API_KEY = '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';

async function testSimpleRewrite() {
    console.log('🤖 Testing ChatGPT rewrite (simple)...\n');

    try {
        // List files
        console.log('1️⃣ Liệt kê file transcript...');
        const listResponse = await fetch(`${BASE_URL}/api/list-transcripts`);
        const listResult = await listResponse.json();
        
        if (!listResult.success || listResult.files.length === 0) {
            console.log('❌ Không có file transcript nào');
            return;
        }

        // Find original file
        const originalFile = listResult.files.find(f => 
            !f.filename.includes('_replaced_') && 
            !f.filename.includes('_rewritten_') && 
            !f.filename.includes('_chatgpt_')
        );

        if (!originalFile) {
            console.log('❌ Không tìm thấy file gốc');
            return;
        }

        console.log(`📄 FILE GỐC: ${originalFile.filename}`);
        console.log(`📊 Kích thước: ${(originalFile.size / 1024).toFixed(2)} KB`);
        console.log(`📅 Tạo lúc: ${new Date(originalFile.created).toLocaleString()}`);

        // Test rewrite
        console.log(`\n2️⃣ Viết lại bằng ChatGPT...`);
        
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
            console.log(`✅ Viết lại thành công!`);
            console.log(`📄 FILE MỚI: ${rewriteResult.rewrittenFilename}`);
            console.log(`🎯 Loại: ${rewriteResult.rewriteType}`);
            console.log(`📝 Chunks: ${rewriteResult.chunksProcessed}`);
            console.log(`📊 Độ dài gốc: ${rewriteResult.originalLength} ký tự`);
            console.log(`📊 Độ dài mới: ${rewriteResult.rewrittenLength} ký tự`);
            console.log(`🔄 Thay tên kênh: ${rewriteResult.channelReplacements} lần`);
            
            console.log('\n📖 So sánh nội dung:');
            console.log(`GỐC: ${rewriteResult.changes.original}`);
            console.log(`MỚI: ${rewriteResult.changes.rewritten}`);
            
        } else {
            console.log(`❌ Lỗi: ${rewriteResult.message}`);
            if (rewriteResult.error) {
                console.log(`🔍 Chi tiết: ${rewriteResult.error}`);
            }
        }

        // Final list
        console.log(`\n3️⃣ Danh sách file sau khi viết lại...`);
        const finalResponse = await fetch(`${BASE_URL}/api/list-transcripts`);
        const finalResult = await finalResponse.json();
        
        if (finalResult.success) {
            console.log(`📁 Tổng số file: ${finalResult.files.length}`);
            
            const originalFiles = finalResult.files.filter(f => 
                !f.filename.includes('_replaced_') && 
                !f.filename.includes('_rewritten_') && 
                !f.filename.includes('_chatgpt_')
            );
            
            const rewrittenFiles = finalResult.files.filter(f => 
                f.filename.includes('_chatgpt_')
            );
            
            console.log(`📄 File gốc: ${originalFiles.length}`);
            console.log(`🤖 File ChatGPT: ${rewrittenFiles.length}`);
            
            if (rewrittenFiles.length > 0) {
                console.log('\n📋 File ChatGPT:');
                rewrittenFiles.forEach(file => {
                    console.log(`   📄 ${file.filename}`);
                    console.log(`      📊 ${(file.size / 1024).toFixed(2)} KB`);
                    console.log(`      📅 ${new Date(file.created).toLocaleString()}`);
                });
            }
        }

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    }
}

// Run test
if (require.main === module) {
    testSimpleRewrite();
}

module.exports = { testSimpleRewrite };
