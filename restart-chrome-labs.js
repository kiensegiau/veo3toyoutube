const fetch = require('node-fetch');

async function restartChromeLabs() {
    try {
        console.log('🔄 [Chrome] Khởi động lại Chrome Labs hoàn toàn...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Đóng Chrome Labs hiện tại
        console.log('🔄 [Chrome] Đóng Chrome Labs hiện tại...');
        try {
            const closeResponse = await fetch(`${serverUrl}/api/close-labs-browser`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            
            const closeResult = await closeResponse.json();
            console.log('🔄 [Chrome] Close result:', closeResult.success ? '✅ Success' : '❌ Failed');
        } catch (error) {
            console.log('⚠️ [Chrome] Close failed:', error.message);
        }
        
        // Chờ một chút
        console.log('⏳ [Chrome] Chờ 5 giây...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Mở Chrome Labs mới
        console.log('🚀 [Chrome] Mở Chrome Labs mới...');
        const openResponse = await fetch(`${serverUrl}/api/open-labs-browser`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        const openResult = await openResponse.json();
        console.log('🚀 [Chrome] Open result:', openResult.success ? '✅ Success' : '❌ Failed');
        
        if (openResult.success) {
            // Chờ Chrome load hoàn toàn
            console.log('⏳ [Chrome] Chờ Chrome load hoàn toàn...');
            await new Promise(resolve => setTimeout(resolve, 15000));
            
            // Test lấy cookies
            console.log('🍪 [Chrome] Test lấy cookies...');
            const cookiesResponse = await fetch(`${serverUrl}/api/extract-labs-cookies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            
            const cookiesResult = await cookiesResponse.json();
            console.log('🍪 [Chrome] Cookies result:', cookiesResult.success ? '✅ Success' : '❌ Failed');
            
            if (cookiesResult.success) {
                console.log(`🍪 [Chrome] Đã lấy ${cookiesResult.cookieCount} cookies`);
                console.log(`🍪 [Chrome] Đã đăng nhập: ${cookiesResult.isLoggedIn}`);
                
                // Test tạo video Veo3
                console.log('🎬 [Chrome] Test tạo video Veo3...');
                const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: "Test video creation after restart",
                        prompt: "Test video creation after restart"
                    })
                });
                
                const veo3Result = await veo3Response.json();
                console.log('🎬 [Chrome] Veo3 result:', veo3Result.success ? '✅ Success' : '❌ Failed');
                
                if (veo3Result.success) {
                    console.log(`🎬 [Chrome] Video Veo3: ${veo3Result.operationName}`);
                    console.log('🎉 [Chrome] Chrome Labs đã sẵn sàng!');
                } else {
                    console.log(`❌ [Chrome] Veo3 thất bại: ${veo3Result.message}`);
                }
            } else {
                console.log(`❌ [Chrome] Cookies thất bại: ${cookiesResult.message}`);
            }
        } else {
            console.log(`❌ [Chrome] Open thất bại: ${openResult.message}`);
        }
        
    } catch (error) {
        console.error('❌ [Chrome] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Khởi động lại Chrome Labs hoàn toàn...');
restartChromeLabs();
