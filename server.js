const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');

// Import API modules
const { createVideo } = require('./api/video/create-video');
const { checkStatus } = require('./api/video/check-status');
const { uploadYouTube } = require('./api/youtube/upload-youtube');
const profileAPI = require('./api/profile/profile-management');
const labsAPI = require('./api/labs/labs-management');
const transcriptAPI = require('./api/transcript/transcript-management');
const storageUtils = require('./api/utils/storage');

const app = express();
const PORT = Number(process.env.PORT || 8888);

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Load storage data
let storageData = storageUtils.loadStorageData();

// Auto batch polling
let autoBatchPollingInterval = null;
const AUTO_BATCH_POLLING_INTERVAL = 15000; // 15 seconds

function startAutoBatchPolling() {
    if (autoBatchPollingInterval) {
        clearInterval(autoBatchPollingInterval);
    }
    
    console.log(`⏱️ Auto batch polling enabled (interval ${AUTO_BATCH_POLLING_INTERVAL} ms)`);
    
    autoBatchPollingInterval = setInterval(async () => {
        try {
            const operations = storageData.requestHistory?.filter(req => 
                req.status === 'PENDING' && req.operationName
            ) || [];
            
            if (operations.length > 0) {
                console.log(`⏱️ Auto batch polling ${operations.length} operations...`);
                
                // Check status for all pending operations
                for (const operation of operations) {
                    try {
                        const mockReq = { body: { operationName: operation.operationName } };
                        const mockRes = {
                            json: (data) => {
                                if (data.success && data.videoStatus === 'COMPLETED') {
                                    // Update status in storage
                                    const historyItem = storageData.requestHistory.find(req => 
                                        req.operationName === operation.operationName
                                    );
                                    if (historyItem) {
                                        historyItem.status = 'COMPLETED';
                                        storageUtils.saveStorageData(storageData);
                                    }
                                }
                            },
                            status: () => ({ json: () => {} })
                        };
                        
                        await checkStatus(mockReq, mockRes, storageData);
                    } catch (error) {
                        console.error(`❌ Auto polling error for ${operation.operationName}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Auto batch polling error:', error);
        }
    }, AUTO_BATCH_POLLING_INTERVAL);
}

// ===== API ROUTES =====

// Video Generation APIs
app.post('/api/create-video', (req, res) => createVideo(req, res, storageData));
app.post('/api/check-status', (req, res) => checkStatus(req, res, storageData));

// YouTube Upload API
app.post('/api/upload-youtube', uploadYouTube);

// Profile Management APIs
app.post('/api/create-profile', profileAPI.createProfile);
app.get('/api/list-profiles', profileAPI.listProfiles);
app.get('/api/check-profile/:profileName', profileAPI.checkProfile);
app.post('/api/check-youtube-login', profileAPI.checkYouTubeLogin);
app.post('/api/check-labs-login', profileAPI.checkLabsLogin);
app.post('/api/open-profile-login', profileAPI.openProfileForLogin);
app.post('/api/delete-profile', profileAPI.deleteProfile);
app.post('/api/extract-cookies', profileAPI.extractCookies);
app.post('/api/extract-cookies-all', profileAPI.extractCookiesAll);
app.post('/api/open-clean-chrome-youtube', profileAPI.openCleanChromeForYouTube);
app.post('/api/open-chrome-logged-in', profileAPI.openChromeWithLoggedInProfile);

// Labs Management APIs
app.post('/api/open-labs-browser', labsAPI.openLabsBrowser);
app.post('/api/extract-labs-cookies', labsAPI.extractLabsCookies);
app.post('/api/test-labs-cookies', labsAPI.testLabsCookies);
app.post('/api/close-labs-browser', labsAPI.closeLabsBrowser);
app.get('/api/labs-profile-info', labsAPI.getLabsProfileInfo);

// Transcript APIs
app.post('/api/get-transcript', transcriptAPI.getTranscript);
app.post('/api/check-transcript-job', transcriptAPI.checkTranscriptJob);
app.post('/api/get-video-metadata', transcriptAPI.getVideoMetadata);
app.post('/api/translate-transcript', transcriptAPI.translateTranscript);
app.get('/api/list-transcripts', transcriptAPI.listTranscriptFiles);
app.get('/api/get-transcript-file/:filename', transcriptAPI.getTranscriptFile);

// Utility APIs
app.get('/api/token-status', (req, res) => {
    try {
        const tokenStatus = storageUtils.getTokenStatus(storageData);
        res.json({
            success: true,
            ...tokenStatus,
            hasCookies: !!storageData.currentCookies,
            currentOperationName: storageData.currentOperationName
        });
    } catch (error) {
        console.error('❌ Token status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get token status',
            error: error.message
        });
    }
});

app.get('/api/list-videos', (req, res) => {
    try {
        const result = storageUtils.listVideos();
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('❌ List videos error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list videos',
            error: error.message
        });
    }
});

app.get('/api/history', (req, res) => {
    try {
        const result = storageUtils.getHistory(storageData);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('❌ Get history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get history',
            error: error.message
        });
    }
});

app.delete('/api/history', (req, res) => {
    try {
        const result = storageUtils.clearHistory(storageData);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('❌ Clear history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear history',
            error: error.message
        });
    }
});

// ===== SERVER STARTUP =====

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`📝 API endpoints:`);
    console.log(`   POST /api/create-video - Tạo video từ text`);
    console.log(`   POST /api/check-status - Kiểm tra trạng thái video`);
    console.log(`   POST /api/upload-youtube - Upload video lên YouTube`);
    console.log(`   POST /api/create-profile - Tạo Chrome profile mới`);
    console.log(`   GET  /api/list-profiles - Liệt kê Chrome profiles`);
    console.log(`   POST /api/check-youtube-login - Kiểm tra đăng nhập YouTube`);
    console.log(`   POST /api/check-labs-login - Kiểm tra đăng nhập Google Labs`);
    console.log(`   POST /api/open-profile-login - Mở profile để đăng nhập`);
    console.log(`   POST /api/delete-profile - Xóa Chrome profile`);
    console.log(`   GET  /api/list-videos - Liệt kê video files`);
    console.log(`   GET  /api/history - Xem lịch sử requests`);
    console.log(`   DELETE /api/history - Xóa lịch sử`);
    console.log(`   GET  /api/token-status - Kiểm tra trạng thái token`);
    console.log(`   POST /api/extract-cookies - Tự động lấy cookies từ profile`);
    console.log(`   POST /api/extract-cookies-all - Lấy cookies từ tất cả profiles`);
    console.log(`   POST /api/open-labs-browser - Mở Chrome Labs riêng biệt`);
    console.log(`   POST /api/extract-labs-cookies - Lấy cookies từ Labs browser`);
    console.log(`   POST /api/test-labs-cookies - Test Labs cookies`);
    console.log(`   POST /api/close-labs-browser - Đóng Labs browser`);
    console.log(`   GET  /api/labs-profile-info - Thông tin Labs profile`);
    console.log(`   POST /api/get-transcript - Lấy lời thoại video YouTube`);
    console.log(`   POST /api/check-transcript-job - Kiểm tra trạng thái job transcript`);
    console.log(`   POST /api/get-video-metadata - Lấy metadata video YouTube`);
    console.log(`   POST /api/translate-transcript - Dịch lời thoại video`);
    console.log(`   GET  /api/list-transcripts - Liệt kê file transcript đã lưu`);
    console.log(`   GET  /api/get-transcript-file/:filename - Đọc nội dung file transcript`);
    
    // Start auto batch polling
    startAutoBatchPolling();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down server...');
    if (autoBatchPollingInterval) {
        clearInterval(autoBatchPollingInterval);
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down server...');
    if (autoBatchPollingInterval) {
        clearInterval(autoBatchPollingInterval);
    }
    process.exit(0);
});
