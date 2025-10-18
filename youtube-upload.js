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
    
    // Lấy launch options với stealth config
    const launchOptions = profileManager.getStealthLaunchOptions({
        profilePath,
        headless: debugMode ? false : 'new',
        debugMode,
        customUserAgent,
        customViewport
    });

    let browser;
    const logs = [];
    function log(msg) { logs.push(msg); }

    try {
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        
        // Áp dụng stealth settings
        await profileManager.applyStealthSettings(page);

        await page.goto('https://www.youtube.com/upload', { waitUntil: 'networkidle2' });
        log('Opened upload page');

        // Check login
        const signInSelector1 = 'a[aria-label="Sign in"]';
        const signInSelector2 = 'a[href*="accounts.google.com/ServiceLogin"]';
        if (await page.$(signInSelector1) || await page.$(signInSelector2)) {
            return { success: false, error: 'NOT_SIGNED_IN', logs };
        }

        // Upload file
        await page.waitForSelector('input[type="file"]');
        const fileInput = await page.$('input[type="file"]');
        await fileInput.uploadFile(videoPath);
        log('File selected');

        // Wait for metadata form
        await page.waitForSelector('#textbox', { timeout: 120000 });

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
            const btn = await page.$('button[aria-label="Tiếp"]')
                || await page.$('.ytcpButtonShapeImplHost');
            if (btn) { await btn.click(); await page.waitForTimeout(1200); return true; }
            const buttons = await page.$$('button');
            for (const b of buttons) {
                const txt = await page.evaluate(el => el.textContent || '', b);
                if (txt && txt.includes('Tiếp')) { await b.click(); await page.waitForTimeout(1200); return true; }
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

        if (!debugMode) {
            try { await page.close(); } catch (_) {}
        }

        return { success: true, videoId, url, status, logs };
    } catch (error) {
        return { success: false, error: error.message, logs };
    } finally {
        if (!debugMode && browser) {
            try { await browser.close(); } catch (_) {}
        }
    }
}

module.exports = { uploadToYouTube };





