const puppeteer = require('puppeteer-core');
const path = require('path');

async function simpleUploadToYouTube(opts) {
    const {
        videoPath,
        title,
        description,
        visibility = 'UNLISTED',
        profileName = 'TestUpload'
    } = opts || {};

    let browser;
    try {
        console.log('Starting simple upload...');
        
        const profilePath = path.join(__dirname, 'chrome-profile', profileName);
        
        browser = await puppeteer.launch({
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            headless: false,
            args: [
                `--user-data-dir=${profilePath}`,
                '--profile-directory=Default',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        
        console.log('Navigating to YouTube upload...');
        await page.goto('https://www.youtube.com/upload', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        console.log('Upload page loaded, waiting for file input...');
        
        // Tìm file input
        await page.waitForSelector('input[type="file"]', { timeout: 10000 });
        const fileInput = await page.$('input[type="file"]');
        
        console.log('File input found, uploading file...');
        await fileInput.uploadFile(videoPath);
        
        console.log('File uploaded, waiting for form...');
        
        // Chờ form xuất hiện
        await page.waitForTimeout(5000);
        
        // Điền title nếu có
        if (title) {
            const titleInputs = await page.$$('#textbox');
            if (titleInputs[0]) {
                await titleInputs[0].click({ clickCount: 3 });
                await titleInputs[0].type(title);
                console.log('Title filled');
            }
        }
        
        // Điền description nếu có
        if (description) {
            const descInputs = await page.$$('#textbox');
            if (descInputs[1]) {
                await descInputs[1].click();
                await descInputs[1].type(description);
                console.log('Description filled');
            }
        }
        
        console.log('Upload process started - Chrome will stay open for 2 minutes');
        
        // Chờ 2 phút để user có thể thấy quá trình upload
        await page.waitForTimeout(120000);
        
        return { success: true, message: 'Upload process completed' };
        
    } catch (error) {
        console.error('Error:', error.message);
        return { success: false, error: error.message };
    } finally {
        // Đóng browser sau 30 giây
        setTimeout(async () => {
            if (browser) {
                try {
                    await browser.close();
                    console.log('Browser closed');
                } catch (e) {
                    console.log('Error closing browser:', e.message);
                }
            }
        }, 30000);
    }
}

module.exports = { simpleUploadToYouTube };
