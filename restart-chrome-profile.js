const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function restartChromeProfile() {
    try {
        console.log('🔄 [Chrome] Khởi động lại Chrome profile...');
        
        // Kill existing Chrome processes
        console.log('🔄 [Chrome] Dừng Chrome hiện tại...');
        try {
            await execAsync('taskkill /f /im chrome.exe');
            console.log('✅ [Chrome] Đã dừng Chrome');
        } catch (error) {
            console.log('⚠️ [Chrome] Chrome không chạy hoặc đã dừng');
        }
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Start Chrome with labs profile
        console.log('🔄 [Chrome] Khởi động Chrome với labs profile...');
        const chromeCmd = `start chrome.exe --user-data-dir="chrome-profile/labs-profile" --disable-web-security --disable-features=VizDisplayCompositor --remote-debugging-port=9222`;
        
        await execAsync(chromeCmd);
        console.log('✅ [Chrome] Đã khởi động Chrome với labs profile');
        
        // Wait for Chrome to start
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('🎉 [Chrome] Chrome profile đã sẵn sàng!');
        console.log('🎉 [Chrome] Bây giờ có thể tạo video Veo3');
        
    } catch (error) {
        console.error(`❌ [Chrome] Lỗi:`, error.message);
    }
}

console.log('🚀 [START] Khởi động lại Chrome profile...');
restartChromeProfile();
