const fetch = require('node-fetch');

async function checkVeo3Status() {
    try {
        console.log('🔍 [Test] Kiểm tra trạng thái video Veo3...');
        
        const serverUrl = 'http://localhost:8888';
        const operationName = 'a4ed1154d028bf20b5d76d455852a17e'; // Operation ID từ test trước
        
        // Kiểm tra trạng thái
        console.log(`🔍 [Step 1] Kiểm tra trạng thái operation: ${operationName}`);
        const statusResponse = await fetch(`${serverUrl}/api/check-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operationName: operationName
            })
        });
        
        const statusResult = await statusResponse.json();
        console.log('🔍 [Step 1] Status result:', statusResult.success ? '✅ Success' : '❌ Failed');
        
        if (statusResult.success) {
            console.log(`🔍 [Step 1] Video status: ${statusResult.videoStatus}`);
            console.log(`🔍 [Step 1] Operation: ${statusResult.operationName}`);
            
            if (statusResult.videoUrl) {
                console.log(`🔍 [Step 1] Video URL: ${statusResult.videoUrl}`);
            }
            
            if (statusResult.videoStatus === 'COMPLETED') {
                console.log('🎉 [Step 1] Video đã hoàn thành!');
                
                // Tải video về
                console.log('📥 [Step 2] Tải video về...');
                const downloadResponse = await fetch(`${serverUrl}/api/tts/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audioUrl: statusResult.videoUrl,
                        filename: `veo3_from_test_${Date.now()}.mp4`
                    })
                });
                
                const downloadResult = await downloadResponse.json();
                console.log('📥 [Step 2] Download result:', downloadResult.success ? '✅ Success' : '❌ Failed');
                
                if (downloadResult.success) {
                    console.log(`📥 [Step 2] Video đã được tải về: ${downloadResult.outPath}`);
                }
            } else {
                console.log(`⏳ [Step 1] Video đang xử lý... (${statusResult.videoStatus})`);
            }
        } else {
            console.log(`❌ [Step 1] Không thể kiểm tra trạng thái: ${statusResult.message}`);
        }
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Kiểm tra trạng thái video Veo3...');
checkVeo3Status();
