const labsManager = require('./labs-profile-manager');

(async () => {
    console.log('🚀 Mở Chrome Labs để bạn đăng nhập...');
    const ok = await labsManager.openLabsBrowser();
    if (!ok) {
        console.error('❌ Không thể mở Chrome Labs');
        process.exit(1);
    }

    console.log('\n📝 Hãy đăng nhập Google Labs trong cửa sổ vừa mở.');
    console.log('👉 Sau khi đăng nhập xong, hãy TỰ đóng cửa sổ trình duyệt.');
    console.log('⏳ Mình sẽ chờ đến khi trình duyệt đóng để kết thúc.');

    await new Promise((resolve) => {
        labsManager.browser.on('disconnected', () => {
            console.log('✅ Trình duyệt đã đóng. Bạn có thể chạy npm run export để xuất cookie.');
            resolve();
        });
    });
})();
