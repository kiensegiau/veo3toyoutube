const labsManager = require('./labs-profile-manager');

(async () => {
    console.log('🚀 Mở Chrome Labs để đăng nhập và tự xuất cookie...');
    const ok = await labsManager.openLabsBrowser();
    if (!ok) {
        console.error('❌ Không thể mở Chrome Labs');
        process.exit(1);
    }

    // Poll trạng thái đăng nhập tối đa ~10 phút
    const start = Date.now();
    const timeoutMs = 10 * 60 * 1000;
    let loggedIn = false;

    while (Date.now() - start < timeoutMs) {
        try {
            const url = await labsManager.page.url();
            if (!url.includes('labs.google')) {
                await labsManager.page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'networkidle2', timeout: 60000 });
            }

            const isLoggedIn = await labsManager.page.evaluate(() => {
                const hasSignInButton = document.querySelector('a[aria-label="Sign in"]') !== null;
                const hasLoginLink = document.querySelector('a[href*="accounts.google.com/ServiceLogin"]') !== null;
                const hasSessionToken = document.cookie.includes('__Secure-next-auth.session-token');
                return !hasSignInButton && !hasLoginLink && hasSessionToken;
            });

            if (isLoggedIn) {
                loggedIn = true;
                break;
            }
        } catch (_) {}

        console.log('⏳ Chờ bạn đăng nhập...');
        await new Promise(r => setTimeout(r, 5000));
    }

    if (!loggedIn) {
        console.error('❌ Hết thời gian chờ đăng nhập (10 phút). Hãy thử lại hoặc dùng: npm run login');
        process.exit(1);
    }

    console.log('✅ Đã phát hiện đăng nhập. Đang xuất cookie...');
    const result = await labsManager.extractLabsCookies();

    if (result.success) {
        labsManager.saveLabsCookies(result.cookies);
        labsManager.updateCookiesJsonWithLabs(result.cookies);
        console.log('\n💾 Đã lưu labs-cookies.txt & cookies.json.');
    } else {
        console.error('❌ Lỗi xuất cookie:', result.error);
    }

    if (labsManager.isLabsBrowserOpen()) {
        await labsManager.closeLabsBrowser();
    }
})();
