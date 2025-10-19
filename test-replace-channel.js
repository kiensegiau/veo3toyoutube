/**
 * Test script for channel name replacement functionality
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8888';

async function testReplaceChannelNames() {
    console.log('🧪 Testing channel name replacement...\n');

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

        // Test 1: Replace channel names (Chu Chu Audio -> KenKen Audio)
        console.log('\n2️⃣ Thay đổi tên kênh từ "Chu Chu Audio" thành "KenKen Audio"...');
        
        const replaceResponse = await fetch(`${BASE_URL}/api/replace-channel-names`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: testFile.filename,
                newChannelName: 'KenKen Audio',
                oldChannelNames: ['Chu Chu Audio', 'ChuChu Audio', 'Chu Chu', 'ChuChu']
            })
        });

        const replaceResult = await replaceResponse.json();
        
        if (replaceResult.success) {
            console.log('✅ Thay đổi tên kênh thành công!');
            console.log(`📄 File mới: ${replaceResult.modifiedFilename}`);
            console.log(`📊 Tổng số thay đổi: ${replaceResult.totalReplacements}`);
            console.log(`📺 Tên kênh mới: ${replaceResult.newChannelName}`);
            
            console.log('\n📝 Chi tiết thay đổi:');
            replaceResult.replacements.forEach((replacement, index) => {
                console.log(`   ${index + 1}. "${replacement.oldName}" → "${replacement.newName}" (${replacement.count} lần)`);
            });

            console.log('\n📖 Preview thay đổi:');
            console.log(`Gốc: ${replaceResult.changes.original}`);
            console.log(`Mới: ${replaceResult.changes.modified}`);
            
        } else {
            console.log('❌ Lỗi thay đổi tên kênh:', replaceResult.message);
        }

        // Test 2: Advanced text replacement
        console.log('\n3️⃣ Test thay thế text nâng cao...');
        
        const advancedResponse = await fetch(`${BASE_URL}/api/advanced-text-replacement`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: testFile.filename,
                replacements: [
                    {
                        from: 'Chu Chu Audio',
                        to: 'KenKen Audio',
                        caseSensitive: false,
                        wholeWord: false
                    },
                    {
                        from: 'ChuChu Audio',
                        to: 'KenKen Audio',
                        caseSensitive: false,
                        wholeWord: false
                    },
                    {
                        from: 'Chu Chu',
                        to: 'KenKen',
                        caseSensitive: false,
                        wholeWord: true
                    },
                    {
                        from: 'ChuChu',
                        to: 'KenKen',
                        caseSensitive: false,
                        wholeWord: true
                    }
                ]
            })
        });

        const advancedResult = await advancedResponse.json();
        
        if (advancedResult.success) {
            console.log('✅ Thay thế text nâng cao thành công!');
            console.log(`📄 File mới: ${advancedResult.modifiedFilename}`);
            console.log(`📊 Tổng số thay đổi: ${advancedResult.totalReplacements}`);
            console.log(`📊 Số pattern thành công: ${advancedResult.successfulReplacements}/${advancedResult.replacementResults.length}`);
            
            console.log('\n📝 Chi tiết kết quả:');
            advancedResult.replacementResults.forEach((result, index) => {
                const status = result.count > 0 ? '✅' : '❌';
                console.log(`   ${status} Pattern ${result.index}: "${result.from}" → "${result.to}" (${result.count} lần)`);
                if (result.note) {
                    console.log(`      📝 ${result.note}`);
                }
            });
            
        } else {
            console.log('❌ Lỗi thay thế text nâng cao:', advancedResult.message);
        }

        // Test 3: List all files after replacement
        console.log('\n4️⃣ Liệt kê tất cả file sau khi thay đổi...');
        const finalListResponse = await fetch(`${BASE_URL}/api/list-transcripts`);
        const finalListResult = await finalListResponse.json();
        
        if (finalListResult.success) {
            console.log(`📁 Tổng số file: ${finalListResult.count}`);
            finalListResult.files.forEach((file, index) => {
                console.log(`   ${index + 1}. ${file.filename}`);
                console.log(`      📊 Kích thước: ${(file.size / 1024).toFixed(2)} KB`);
                console.log(`      📅 Tạo lúc: ${new Date(file.created).toLocaleString()}`);
            });
        }

    } catch (error) {
        console.error('❌ Lỗi test:', error.message);
    }
}

// Test with specific channel name replacement
async function testSpecificChannelReplacement() {
    console.log('🧪 Testing specific channel name replacement...\n');

    try {
        // List files
        const listResponse = await fetch(`${BASE_URL}/api/list-transcripts`);
        const listResult = await listResponse.json();
        
        if (!listResult.success || listResult.files.length === 0) {
            console.log('❌ Không có file transcript nào để test');
            return;
        }

        const testFile = listResult.files[0];
        console.log(`📄 File test: ${testFile.filename}`);

        // Show original content preview
        console.log('\n📖 Nội dung gốc (300 ký tự đầu):');
        const fileResponse = await fetch(`${BASE_URL}/api/get-transcript-file/${testFile.filename}`);
        const fileResult = await fileResponse.json();
        
        if (fileResult.success) {
            console.log(`"${fileResult.content.substring(0, 300)}..."`);
            
            // Count occurrences of "Chu Chu" variations
            const content = fileResult.content;
            const chuChuCount = (content.match(/Chu Chu Audio/gi) || []).length;
            const chuChuAudioCount = (content.match(/ChuChu Audio/gi) || []).length;
            const chuChuOnlyCount = (content.match(/Chu Chu/gi) || []).length;
            const chuChuOnlyNoAudioCount = (content.match(/ChuChu/gi) || []).length;
            
            console.log('\n📊 Thống kê tên kênh trong file:');
            console.log(`   "Chu Chu Audio": ${chuChuCount} lần`);
            console.log(`   "ChuChu Audio": ${chuChuAudioCount} lần`);
            console.log(`   "Chu Chu": ${chuChuOnlyCount} lần`);
            console.log(`   "ChuChu": ${chuChuOnlyNoAudioCount} lần`);
            console.log(`   Tổng cộng: ${chuChuCount + chuChuAudioCount + chuChuOnlyCount + chuChuOnlyNoAudioCount} lần`);
        }

    } catch (error) {
        console.error('❌ Lỗi test:', error.message);
    }
}

// Run the test
if (require.main === module) {
    // Test specific channel replacement first
    testSpecificChannelReplacement();
    
    // Then test full replacement
    setTimeout(() => {
        testReplaceChannelNames();
    }, 2000);
}

module.exports = { testReplaceChannelNames, testSpecificChannelReplacement };
