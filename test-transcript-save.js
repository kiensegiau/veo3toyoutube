/**
 * Test script for transcript file saving functionality
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8888';
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=VcROsS0Q3-g';

async function testTranscriptSaving() {
    console.log('🧪 Testing transcript file saving...\n');

    try {
        // Test 1: Get transcript and save to file
        console.log('1️⃣ Lấy lời thoại và lưu file...');
        const transcriptResponse = await fetch(`${BASE_URL}/api/get-transcript`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: TEST_VIDEO_URL,
                lang: 'en',
                text: true,
                mode: 'auto'
            })
        });

        const transcriptResult = await transcriptResponse.json();
        
        if (transcriptResult.success) {
            console.log('✅ Lấy lời thoại thành công!');
            console.log(`💾 File đã lưu: ${transcriptResult.savedTo}`);
            console.log(`📄 Tên file: ${transcriptResult.filename}`);
        } else {
            console.log('❌ Lỗi lấy lời thoại:', transcriptResult.message);
            return;
        }

        // Test 2: List all transcript files
        console.log('\n2️⃣ Liệt kê tất cả file transcript...');
        const listResponse = await fetch(`${BASE_URL}/api/list-transcripts`);
        const listResult = await listResponse.json();
        
        if (listResult.success) {
            console.log(`✅ Tìm thấy ${listResult.count} file transcript:`);
            listResult.files.forEach((file, index) => {
                console.log(`   ${index + 1}. ${file.filename}`);
                console.log(`      📁 Đường dẫn: ${file.path}`);
                console.log(`      📊 Kích thước: ${(file.size / 1024).toFixed(2)} KB`);
                console.log(`      📅 Tạo lúc: ${new Date(file.created).toLocaleString()}`);
                console.log(`      🔄 Sửa lúc: ${new Date(file.modified).toLocaleString()}`);
                console.log('');
            });
        } else {
            console.log('❌ Lỗi liệt kê file:', listResult.message);
        }

        // Test 3: Read a specific transcript file
        if (listResult.success && listResult.files.length > 0) {
            const latestFile = listResult.files[0];
            console.log(`3️⃣ Đọc nội dung file mới nhất: ${latestFile.filename}`);
            
            const fileResponse = await fetch(`${BASE_URL}/api/get-transcript-file/${latestFile.filename}`);
            const fileResult = await fileResponse.json();
            
            if (fileResult.success) {
                console.log('✅ Đọc file thành công!');
                console.log(`📄 Nội dung (100 ký tự đầu): ${fileResult.content.substring(0, 100)}...`);
                console.log(`📊 Kích thước: ${(fileResult.size / 1024).toFixed(2)} KB`);
            } else {
                console.log('❌ Lỗi đọc file:', fileResult.message);
            }
        }

    } catch (error) {
        console.error('❌ Lỗi test:', error.message);
    }
}

// Run the test
if (require.main === module) {
    testTranscriptSaving();
}

module.exports = { testTranscriptSaving };
