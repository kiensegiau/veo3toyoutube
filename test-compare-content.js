/**
 * Test script to compare transcript content changes
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8888';

async function compareTranscriptContent() {
    console.log('🧪 Comparing transcript content changes...\n');

    try {
        // List all transcript files
        console.log('1️⃣ Liệt kê tất cả file transcript...');
        const listResponse = await fetch(`${BASE_URL}/api/list-transcripts`);
        const listResult = await listResponse.json();
        
        if (!listResult.success || listResult.files.length === 0) {
            console.log('❌ Không có file transcript nào để so sánh');
            return;
        }

        console.log(`📁 Tìm thấy ${listResult.count} file transcript:`);
        listResult.files.forEach((file, index) => {
            console.log(`   ${index + 1}. ${file.filename}`);
        });

        // Find the original file and modified files
        const originalFile = listResult.files.find(f => !f.filename.includes('_replaced_') && !f.filename.includes('_rewritten_'));
        const channelReplacedFile = listResult.files.find(f => f.filename.includes('_channel_replaced_'));
        const advancedReplacedFile = listResult.files.find(f => f.filename.includes('_advanced_replaced_'));

        if (!originalFile) {
            console.log('❌ Không tìm thấy file gốc');
            return;
        }

        console.log(`\n📄 File gốc: ${originalFile.filename}`);

        // Read original content
        console.log('\n2️⃣ Đọc nội dung file gốc...');
        const originalResponse = await fetch(`${BASE_URL}/api/get-transcript-file/${originalFile.filename}`);
        const originalResult = await originalResponse.json();
        
        if (!originalResult.success) {
            console.log('❌ Lỗi đọc file gốc:', originalResult.message);
            return;
        }

        const originalContent = originalResult.content;
        console.log(`📊 Độ dài gốc: ${originalContent.length} ký tự`);
        console.log(`📊 Số từ gốc: ${originalContent.split(/\s+/).length} từ`);

        // Show original content preview
        console.log('\n📖 Nội dung gốc (300 ký tự đầu):');
        console.log(`"${originalContent.substring(0, 300)}..."`);

        // Check for channel name occurrences in original
        const chuChuAudioCount = (originalContent.match(/Chu Chu Audio/gi) || []).length;
        const chuChuCount = (originalContent.match(/Chu Chu/gi) || []).length;
        console.log(`\n📊 Thống kê tên kênh trong file gốc:`);
        console.log(`   "Chu Chu Audio": ${chuChuAudioCount} lần`);
        console.log(`   "Chu Chu": ${chuChuCount} lần`);

        // Compare with channel replaced file
        if (channelReplacedFile) {
            console.log(`\n3️⃣ So sánh với file đã thay đổi tên kênh: ${channelReplacedFile.filename}`);
            
            const channelResponse = await fetch(`${BASE_URL}/api/get-transcript-file/${channelReplacedFile.filename}`);
            const channelResult = await channelResponse.json();
            
            if (channelResult.success) {
                const channelContent = channelResult.content;
                
                // Check for new channel name
                const kenKenAudioCount = (channelContent.match(/KenKen Audio/gi) || []).length;
                const remainingChuChuCount = (channelContent.match(/Chu Chu/gi) || []).length;
                
                console.log(`📊 Thống kê sau khi thay đổi tên kênh:`);
                console.log(`   "KenKen Audio": ${kenKenAudioCount} lần`);
                console.log(`   "Chu Chu" còn lại: ${remainingChuChuCount} lần`);
                
                console.log('\n📖 Nội dung sau thay đổi tên kênh (300 ký tự đầu):');
                console.log(`"${channelContent.substring(0, 300)}..."`);
                
                // Show the specific change
                const originalStart = originalContent.substring(0, 200);
                const channelStart = channelContent.substring(0, 200);
                
                if (originalStart !== channelStart) {
                    console.log('\n🔄 Thay đổi cụ thể:');
                    console.log(`Gốc: ${originalStart}`);
                    console.log(`Mới: ${channelStart}`);
                }
            }
        }

        // Compare with advanced replaced file
        if (advancedReplacedFile) {
            console.log(`\n4️⃣ So sánh với file thay thế nâng cao: ${advancedReplacedFile.filename}`);
            
            const advancedResponse = await fetch(`${BASE_URL}/api/get-transcript-file/${advancedReplacedFile.filename}`);
            const advancedResult = await advancedResponse.json();
            
            if (advancedResult.success) {
                const advancedContent = advancedResult.content;
                
                // Check for new channel name
                const kenKenAudioCount = (advancedContent.match(/KenKen Audio/gi) || []).length;
                const remainingChuChuCount = (advancedContent.match(/Chu Chu/gi) || []).length;
                
                console.log(`📊 Thống kê sau thay thế nâng cao:`);
                console.log(`   "KenKen Audio": ${kenKenAudioCount} lần`);
                console.log(`   "Chu Chu" còn lại: ${remainingChuChuCount} lần`);
                
                console.log('\n📖 Nội dung sau thay thế nâng cao (300 ký tự đầu):');
                console.log(`"${advancedContent.substring(0, 300)}..."`);
            }
        }

        // Test the compare API
        if (channelReplacedFile) {
            console.log('\n5️⃣ Sử dụng API so sánh...');
            
            const compareResponse = await fetch(`${BASE_URL}/api/compare-transcripts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    originalFilename: originalFile.filename,
                    rewrittenFilename: channelReplacedFile.filename
                })
            });

            const compareResult = await compareResponse.json();
            
            if (compareResult.success) {
                console.log('✅ So sánh thành công!');
                console.log(`📊 Metrics:`);
                console.log(`   📈 Thay đổi từ: ${compareResult.comparison.metrics.wordChangePercentage}`);
                console.log(`   🔄 Độ tương đồng: ${compareResult.comparison.metrics.similarity}`);
                console.log(`   📏 Chênh lệch độ dài: ${compareResult.comparison.metrics.lengthDifference} ký tự`);
                console.log(`   📝 Chênh lệch từ: ${compareResult.comparison.metrics.wordDifference} từ`);
            } else {
                console.log('❌ Lỗi so sánh:', compareResult.message);
            }
        }

    } catch (error) {
        console.error('❌ Lỗi test:', error.message);
    }
}

// Run the test
if (require.main === module) {
    compareTranscriptContent();
}

module.exports = { compareTranscriptContent };
