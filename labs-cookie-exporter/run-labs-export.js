const labsManager = require('./labs-profile-manager');

(async () => {
    const result = await labsManager.extractLabsCookies(true);
    console.log('\n==== Exported Labs Cookie Result ====');
    console.log(result);

    if (result.success) {
        labsManager.saveLabsCookies(result.cookies);
        labsManager.updateCookiesJsonWithLabs(result.cookies);
        console.log('\nĐã lưu labs-cookies.txt & cookies.json. Hãy gửi file .txt cho khách!');
    } else {
        console.error('Lỗi xuất cookie:', result.error);
    }

    if (labsManager.isLabsBrowserOpen()) {
        await labsManager.closeLabsBrowser();
    }
})();
