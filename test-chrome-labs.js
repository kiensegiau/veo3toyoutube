const fetch = require('node-fetch');

async function testChromeLabs() {
    try {
        console.log('🧪 [Test] Test Chrome Labs...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Test mở Chrome Labs
        console.log('🚀 [Test] Mở Chrome Labs...');
        const openResponse = await fetch(`${serverUrl}/api/open-labs-browser`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        const openResult = await openResponse.json();
        console.log('🚀 [Test] Open result:', openResult.success ? '✅ Success' : '❌ Failed');
        
        if (openResult.success) {
            // Chờ Chrome load
            console.log('⏳ [Test] Chờ Chrome load...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Test lấy cookies
            console.log('🍪 [Test] Lấy cookies...');
            const cookiesResponse = await fetch(`${serverUrl}/api/extract-labs-cookies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            
            const cookiesResult = await cookiesResponse.json();
            console.log('🍪 [Test] Cookies result:', cookiesResult.success ? '✅ Success' : '❌ Failed');
            
            if (cookiesResult.success) {
                console.log(`🍪 [Test] Đã lấy ${cookiesResult.cookieCount} cookies`);
                console.log(`🍪 [Test] Đã đăng nhập: ${cookiesResult.isLoggedIn}`);
                
                // Test tạo video Veo3
                console.log('🎬 [Test] Test tạo video Veo3...');
                const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: "Test video creation with Chrome Labs",
                        prompt: "Test video creation with Chrome Labs"
                    })
                });
                
                const veo3Result = await veo3Response.json();
                console.log('🎬 [Test] Veo3 result:', veo3Result.success ? '✅ Success' : '❌ Failed');
                
                if (veo3Result.success) {
                    console.log(`🎬 [Test] Video Veo3: ${veo3Result.operationName}`);
                } else {
                    console.log(`❌ [Test] Veo3 thất bại: ${veo3Result.message}`);
                }
            } else {
                console.log(`❌ [Test] Cookies thất bại: ${cookiesResult.message}`);
            }
        } else {
            console.log(`❌ [Test] Open thất bại: ${openResult.message}`);
        }
        
    } catch (error) {
        console.error('❌ [Test] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Test Chrome Labs...');
testChromeLabs();
