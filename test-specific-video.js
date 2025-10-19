/**
 * Test script for specific YouTube video transcript
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8888';
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=VcROsS0Q3-g';

async function testSpecificVideo() {
    console.log('🧪 Testing transcript API với video cụ thể...\n');
    console.log(`📺 Video URL: ${TEST_VIDEO_URL}\n`);

    try {
        // Test 1: Get transcript
        console.log('1️⃣ Lấy lời thoại video...');
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
            console.log('📝 Nội dung lời thoại:');
            console.log('─'.repeat(50));
            console.log(transcriptResult.transcript.content);
            console.log('─'.repeat(50));
        } else {
            console.log('❌ Lỗi lấy lời thoại:', transcriptResult.message);
            console.log('Chi tiết lỗi:', transcriptResult.error);
        }

        // Test 2: Get video metadata
        console.log('\n2️⃣ Lấy thông tin video...');
        const metadataResponse = await fetch(`${BASE_URL}/api/get-video-metadata`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoId: 'VcROsS0Q3-g'
            })
        });

        const metadataResult = await metadataResponse.json();
        
        if (metadataResult.success) {
            console.log('✅ Lấy metadata thành công!');
            console.log('📊 Thông tin video:');
            console.log(`   📺 Tiêu đề: ${metadataResult.video.title}`);
            console.log(`   ⏱️ Thời lượng: ${metadataResult.video.duration} giây`);
            console.log(`   👀 Lượt xem: ${metadataResult.video.viewCount?.toLocaleString() || 'N/A'}`);
            console.log(`   👍 Lượt thích: ${metadataResult.video.likeCount?.toLocaleString() || 'N/A'}`);
            console.log(`   📺 Kênh: ${metadataResult.video.channel?.name || 'N/A'}`);
            console.log(`   📅 Ngày upload: ${metadataResult.video.uploadDate || 'N/A'}`);
        } else {
            console.log('❌ Lỗi lấy metadata:', metadataResult.message);
        }

    } catch (error) {
        console.error('❌ Lỗi test:', error.message);
    }
}

// Run the test
if (require.main === module) {
    testSpecificVideo();
}

module.exports = { testSpecificVideo };
