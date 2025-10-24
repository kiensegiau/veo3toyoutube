const fetch = require('node-fetch');

async function testLogicDemo() {
    try {
        console.log('🎯 [testLogicDemo] Demo logic chia video đúng cho Veo3');
        
        const videoPath = './test.mp4';
        const serverUrl = 'http://localhost:8888';
        
        // Lấy thông tin video
        console.log('\n📊 [Step 1] Lấy thông tin video...');
        const extractResponse = await fetch(`${serverUrl}/api/extract-frames`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: videoPath,
                count: 1, // Chỉ cần 1 frame để lấy info
                interval: 8
            })
        });
        
        const extractResult = await extractResponse.json();
        if (extractResult.success) {
            const duration = extractResult.videoInfo.duration;
            console.log(`📊 Video duration: ${duration}s (${(duration/60).toFixed(1)} phút)`);
            
            // Logic chia video đúng
            console.log('\n🧮 [Step 2] Logic chia video:');
            console.log(`📝 Mỗi video Veo3 = 8 giây`);
            console.log(`📝 Video gốc = ${duration} giây`);
            console.log(`📝 Số video Veo3 cần = ${duration} ÷ 8 = ${Math.ceil(duration / 8)} videos`);
            
            const segmentsNeeded = Math.ceil(duration / 8);
            const maxSegments = 64;
            const finalSegments = Math.min(segmentsNeeded, maxSegments);
            
            console.log(`\n📊 [Step 3] Kết quả tính toán:`);
            console.log(`📊 Segments needed: ${segmentsNeeded}`);
            console.log(`📊 Max segments: ${maxSegments}`);
            console.log(`📊 Final segments: ${finalSegments}`);
            console.log(`📊 Total video time: ${finalSegments * 8}s (${(finalSegments * 8 / 60).toFixed(1)} phút)`);
            
            if (segmentsNeeded > maxSegments) {
                console.log(`\n⚠️ [Warning] Video quá dài!`);
                console.log(`⚠️ Cần ${segmentsNeeded} videos nhưng chỉ tạo được ${maxSegments} videos`);
                console.log(`⚠️ Sẽ mất ${((segmentsNeeded - maxSegments) * 8 / 60).toFixed(1)} phút nội dung`);
                console.log(`💡 Giải pháp: Tăng maxSegments hoặc chia thành nhiều batch`);
            }
            
            // Demo với số segments nhỏ hơn
            console.log(`\n🎬 [Step 4] Demo với 8 segments (64 giây):`);
            const demoSegments = 8;
            console.log(`📝 Sẽ tạo ${demoSegments} video Veo3`);
            console.log(`📝 Mỗi video 8 giây → Tổng ${demoSegments * 8} giây (${(demoSegments * 8 / 60).toFixed(1)} phút)`);
            console.log(`📝 Extract ${demoSegments} frames từ video gốc`);
            console.log(`📝 ChatGPT phân tích và tạo ${demoSegments} prompts`);
            console.log(`📝 Tạo ${demoSegments} video Veo3`);
            console.log(`📝 Merge thành video cuối`);
            
        } else {
            console.log('❌ Không thể lấy thông tin video');
        }
        
    } catch (error) {
        console.error('❌ [testLogicDemo] Lỗi:', error);
    }
}

testLogicDemo();
