const LabsProfileManager = require('../../labs-profile-manager');

// Mở Chrome Labs browser
async function openLabsBrowser(req, res) {
    try {
        const result = await LabsProfileManager.openLabsBrowser();
        
        if (result) {
            res.json({
                success: true,
                message: 'Chrome Labs browser opened successfully',
                profileName: 'GoogleLabs'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to open Chrome Labs browser'
            });
        }
    } catch (error) {
        console.error('❌ Open Labs browser error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to open Labs browser',
            error: error.message
        });
    }
}

// Lấy cookies từ Labs browser
async function extractLabsCookies(req, res) {
    try {
        const result = await LabsProfileManager.extractLabsCookies();
        
        if (result.success) {
            // Cập nhật thời gian lấy cookies
            LabsProfileManager.lastExtractTime = new Date().toISOString();
            
            res.json({
                success: true,
                message: `Extracted ${result.cookieCount} cookies from Labs browser`,
                cookies: result.cookies,
                cookieCount: result.cookieCount,
                isLoggedIn: result.isLoggedIn,
                profileName: result.profileName
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.error || 'Failed to extract cookies from Labs browser'
            });
        }
    } catch (error) {
        console.error('❌ Extract Labs cookies error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to extract Labs cookies',
            error: error.message
        });
    }
}

// Test Labs cookies
async function testLabsCookies(req, res) {
    try {
        const { cookies } = req.body;
        
        if (!cookies) {
            return res.status(400).json({
                success: false,
                message: 'Cookies are required for testing'
            });
        }

        const result = await LabsProfileManager.testLabsCookies(cookies);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Labs cookies are valid and working',
                isLoggedIn: result.isLoggedIn,
                profileName: result.profileName
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.error || 'Labs cookies are invalid or expired'
            });
        }
    } catch (error) {
        console.error('❌ Test Labs cookies error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to test Labs cookies',
            error: error.message
        });
    }
}

// Đóng Labs browser
async function closeLabsBrowser(req, res) {
    try {
        const result = await LabsProfileManager.closeLabsBrowser();
        
        if (result) {
            res.json({
                success: true,
                message: 'Chrome Labs browser closed successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to close Chrome Labs browser'
            });
        }
    } catch (error) {
        console.error('❌ Close Labs browser error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to close Labs browser',
            error: error.message
        });
    }
}

// Lấy thông tin Labs profile
async function getLabsProfileInfo(req, res) {
    try {
        const profileInfo = {
            profileName: 'GoogleLabs',
            profilePath: LabsProfileManager.labsProfilePath,
            exists: LabsProfileManager.profileExists(),
            isOpen: LabsProfileManager.isLabsBrowserOpen(),
            autoExtractEnabled: LabsProfileManager.autoExtractEnabled,
            lastExtractTime: LabsProfileManager.lastExtractTime
        };
        
        res.json({
            success: true,
            profileInfo: profileInfo
        });
    } catch (error) {
        console.error('❌ Get Labs profile info error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get Labs profile info',
            error: error.message
        });
    }
}

module.exports = {
    openLabsBrowser,
    extractLabsCookies,
    testLabsCookies,
    closeLabsBrowser,
    getLabsProfileInfo
};
