const RequestLogger = require('./index.js');

// Ví dụ sử dụng RequestLogger với stealth mode và session
async function example() {
    const options = {
        stealthMode: true,
        cookiesFile: 'demo-cookies.json',
        userDataDir: './demo-chrome-data'
    };
    
    const logger = new RequestLogger(options);
    
    try {
        console.log('🚀 Bắt đầu demo RequestLogger với Stealth Mode...');
        
        // Khởi tạo logger
        await logger.init();
        
        // Truy cập một số trang web để demo
        const urls = [
            'https://www.google.com',
            'https://httpbin.org/get',
            'https://httpbin.org/post'
        ];
        
        for (const url of urls) {
            console.log(`\n📱 Đang truy cập: ${url}`);
            await logger.navigateToUrl(url);
            
            // Random delay giữa các requests
            await logger.randomDelay(3000, 5000);
        }
        
        // Lưu tất cả requests
        await logger.saveRequestsToFile('demo-requests.json');
        
        console.log('\n✅ Demo hoàn thành!');
        console.log('📁 Kiểm tra các file:');
        console.log('   - demo-requests.json (tất cả requests)');
        console.log('   - demo-cookies.json (cookies và session)');
        console.log('   - ./demo-chrome-data/ (thư mục Chrome user data)');
        
    } catch (error) {
        console.error('❌ Lỗi trong demo:', error.message);
    } finally {
        await logger.close();
    }
}

// Chạy demo
if (require.main === module) {
    example().catch(console.error);
}

module.exports = example;
