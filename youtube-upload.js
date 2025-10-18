const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const ChromeProfileManager = require('./chrome-profile-manager');

async function uploadToYouTube(opts) {
    const {
        videoPath,
        title,
        description,
        visibility = 'UNLISTED',
        debugMode = false,
        profileName = 'Default',
        customUserAgent = null,
        customViewport = null
    } = opts || {};

    if (!videoPath || !fs.existsSync(videoPath)) {
        return { success: false, error: 'VIDEO_PATH_INVALID' };
    }

    // Khởi tạo Chrome Profile Manager
    const profileManager = new ChromeProfileManager();
    
    // Tạo profile path
    const profilePath = path.join(profileManager.defaultProfilePath, profileName);
    
    // Sử dụng launch options đơn giản không stealth
    const launchOptions = {
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
    };

    let browser;
    const logs = [];
    function log(msg) { logs.push(msg); }

    try {
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        
        // Không dùng stealth settings để tránh lỗi

        await page.goto('https://www.youtube.com/upload', { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
        });
        log('Opened upload page');
        
        // Chờ thêm để trang load hoàn toàn
        await page.waitForTimeout(5000);

        // Check login
        const signInSelector1 = 'a[aria-label="Sign in"]';
        const signInSelector2 = 'a[href*="accounts.google.com/ServiceLogin"]';
        if (await page.$(signInSelector1) || await page.$(signInSelector2)) {
            return { success: false, error: 'NOT_SIGNED_IN', logs };
        }

        // Upload file - thử nhiều selector khác nhau
        let fileInput = null;
        const fileSelectors = [
            'input[type="file"]',
            'input[accept*="video"]',
            'input[accept*="mp4"]',
            'input[aria-label*="file"]',
            'input[aria-label*="video"]'
        ];
        
        for (const selector of fileSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 10000 });
                fileInput = await page.$(selector);
                if (fileInput) break;
            } catch (e) {
                log(`Selector ${selector} not found: ${e.message}`);
            }
        }
        
        if (!fileInput) {
            return { success: false, error: 'FILE_INPUT_NOT_FOUND', logs };
        }
        
        await fileInput.uploadFile(videoPath);
        log('File selected');

        // Chờ file được xử lý
        log('Waiting for file processing...');
        await page.waitForTimeout(10000);

        // Wait for metadata form với debug
        try {
            await page.waitForSelector('#textbox', { timeout: 120000 });
            log('Found metadata form');
        } catch (e) {
            log(`Metadata form not found: ${e.message}`);
            // Chụp ảnh màn hình để debug
            await page.screenshot({ path: 'debug-upload.png' });
            log('Screenshot saved as debug-upload.png');
            return { success: false, error: 'METADATA_FORM_NOT_FOUND', logs };
        }

        // Optional: title/description
        if (typeof title === 'string' && title.length > 0) {
            const titleBoxes = await page.$$('#textbox');
            if (titleBoxes[0]) {
                await titleBoxes[0].click({ clickCount: 3 });
                await titleBoxes[0].type(title);
            }
        }
        if (typeof description === 'string') {
            const textboxes = await page.$$('#textbox');
            if (textboxes[1]) {
                await textboxes[1].click();
                await textboxes[1].type(description);
            }
        }

        // Audience: not for kids
        try {
            const notForKids = await page.$('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]');
            if (notForKids) { await notForKids.click(); await page.waitForTimeout(500); }
        } catch (_) {}

        // Next steps 3-4 times
        async function clickNext() {
            // Try multiple selectors for Next button
            const nextSelectors = [
                'button[aria-label="Tiếp"]',
                'button[aria-label="Next"]', 
                '.ytcpButtonShapeImplHost',
                'button[aria-label="Continue"]',
                'button[aria-label="Tiếp tục"]'
            ];
            
            for (const selector of nextSelectors) {
                try {
                    const btn = await page.$(selector);
                    if (btn) { 
                        log(`Found Next button with selector: ${selector}`);
                        // Scroll to button và chờ để đảm bảo nút có thể click
                        await btn.scrollIntoView();
                        await page.waitForTimeout(1000);
                        // Thử click bằng JavaScript thay vì Puppeteer click
                        await page.evaluate((element) => element.click(), btn); 
                        await page.waitForTimeout(1200); 
                        return true; 
                    }
                } catch (e) {
                    log(`Error clicking button with selector ${selector}: ${e.message}`);
                }
            }
            
            // Fallback: search by text content
            const buttons = await page.$$('button');
            for (const b of buttons) {
                const txt = await page.evaluate(el => el.textContent || '', b);
                if (txt && (txt.includes('Tiếp') || txt.includes('Next') || txt.includes('Continue'))) { 
                    await b.click(); 
                    await page.waitForTimeout(1200); 
                    return true; 
                }
            }
            return false;
        }
        for (let i = 0; i < 4; i++) { await clickNext(); }

        // Visibility
        if (visibility === 'UNLISTED') {
            const radio = await page.$('tp-yt-paper-radio-button[name="UNLISTED"]');
            if (radio) { await radio.click(); await page.waitForTimeout(500); }
        }

        // Save/Publish
        await page.waitForSelector('#done-button', { timeout: 120000 });
        const doneBtn = await page.$('#done-button');
        if (doneBtn) { await doneBtn.click(); await page.waitForTimeout(1000); }

        // Handle content check dialog
        try {
            const dialog = await page.waitForSelector('tp-yt-paper-dialog#dialog', { timeout: 3000 });
            if (dialog) {
                const titleText = await page.$eval('#dialog-title', el => el.textContent || '');
                if (titleText.includes('kiểm tra nội dung') || titleText.includes('Chúng tôi vẫn đang kiểm tra')) {
                    const stillPublishBtn = await page.$('#secondary-action-button');
                    if (stillPublishBtn) { await stillPublishBtn.click(); await page.waitForTimeout(2000); }
                }
            }
        } catch (_) {}

        // Poll progress until completed/processing
        const start = Date.now();
        let status = 'uploading';
        while (Date.now() - start < 15 * 60 * 1000) {
            try {
                const text = await page.evaluate(() => {
                    const sels = [
                        '.ytcp-video-upload-progress',
                        'ytcp-video-upload-progress-hover .subtitle yt-formatted-string',
                        '.progress-label',
                        '#dialog-title'
                    ];
                    for (const sel of sels) {
                        const el = document.querySelector(sel);
                        if (el && el.textContent) return el.textContent;
                    }
                    return '';
                });
                if (/completed|processing/i.test(text)) { status = 'processing'; break; }
            } catch (_) {}
            await page.waitForTimeout(5000);
        }

        // Extract URL/ID
        const link = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            const targets = anchors.filter(a => /youtu\.be\//.test(a.href) || /youtube\.com\/watch/.test(a.href));
            const preferred = targets.find(a => /youtu\.be\//.test(a.href)) || targets[0];
            return preferred ? preferred.href : '';
        });

        let videoId = null;
        let url = null;
        if (link) {
            const ytb = link.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
            const watch = link.match(/watch\?v=([A-Za-z0-9_-]{6,})/);
            videoId = (ytb && ytb[1]) || (watch && watch[1]) || null;
            url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : link;
        }

        // Không đóng browser ngay để user có thể thấy kết quả
        if (!debugMode) {
            try { await page.close(); } catch (_) {}
        }

        return { success: true, videoId, url, status, logs };
    } catch (error) {
        log(`Error: ${error.message}`);
        // Không đóng browser khi có lỗi để user có thể debug
        console.log('Error occurred, keeping browser open for debugging...');
        return { success: false, error: error.message, logs };
    } finally {
        // Luôn giữ browser mở ít nhất 60 giây để user có thể debug
        if (browser) {
            console.log('Keeping browser open for 60 seconds for debugging...');
            setTimeout(async () => {
                try { 
                    await browser.close(); 
                    console.log('Browser closed after 60 seconds');
                } catch (e) {
                    console.log('Error closing browser:', e.message);
                }
            }, 60000);
        }
    }
}

module.exports = { uploadToYouTube };





