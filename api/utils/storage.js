const fs = require('fs');
const path = require('path');

// Load storage data from file
function loadStorageData() {
    try {
        const storageFile = path.join(__dirname, '../../server-storage.json');
        
        if (!fs.existsSync(storageFile)) {
            console.log('📁 Storage file not found, creating new one');
            return {
                currentCookies: null,
                tokenExpiryTime: null,
                currentOperationName: null,
                requestHistory: []
            };
        }
        
        const data = fs.readFileSync(storageFile, 'utf8');
        const parsed = JSON.parse(data);
        
        console.log('📁 Storage data loaded from file');
        return parsed;
    } catch (error) {
        console.error('❌ Error loading storage data:', error);
        return {
            currentCookies: null,
            tokenExpiryTime: null,
            currentOperationName: null,
            requestHistory: []
        };
    }
}

// Save storage data to file
function saveStorageData(storageData) {
    try {
        const storageFile = path.join(__dirname, '../../server-storage.json');
        fs.writeFileSync(storageFile, JSON.stringify(storageData, null, 2));
        console.log('💾 Storage data saved to file');
    } catch (error) {
        console.error('❌ Error saving storage data:', error);
    }
}

// Get token status
function getTokenStatus(storageData) {
    const now = Date.now();
    const expiryTime = storageData.tokenExpiryTime;
    
    if (!expiryTime) {
        return {
            hasToken: false,
            isExpired: true,
            timeUntilExpiry: 0,
            expiryTime: null
        };
    }
    
    const timeUntilExpiry = expiryTime - now;
    const isExpired = timeUntilExpiry <= 0;
    
    return {
        hasToken: true,
        isExpired: isExpired,
        timeUntilExpiry: Math.max(0, timeUntilExpiry),
        expiryTime: new Date(expiryTime).toISOString()
    };
}

// List video files
function listVideos() {
    try {
        const videosDir = path.join(__dirname, '../../public/videos');
        
        if (!fs.existsSync(videosDir)) {
            return {
                success: true,
                videos: []
            };
        }
        
        const files = fs.readdirSync(videosDir);
        const videoFiles = files.filter(file => 
            file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mov')
        );
        
        return {
            success: true,
            videos: videoFiles
        };
    } catch (error) {
        console.error('❌ Error listing videos:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Get request history
function getHistory(storageData) {
    try {
        const history = storageData.requestHistory || [];
        
        // Sort by timestamp (newest first)
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return {
            success: true,
            requests: history
        };
    } catch (error) {
        console.error('❌ Error getting history:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Clear request history
function clearHistory(storageData) {
    try {
        storageData.requestHistory = [];
        saveStorageData(storageData);
        
        return {
            success: true,
            message: 'History cleared successfully'
        };
    } catch (error) {
        console.error('❌ Error clearing history:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Remove operation from storage
function removeOperation(storageData, operationName) {
    try {
        // Remove from request history
        if (storageData.requestHistory) {
            storageData.requestHistory = storageData.requestHistory.filter(
                req => req.operationName !== operationName
            );
        }
        
        // Clear current operation if it matches
        if (storageData.currentOperationName === operationName) {
            storageData.currentOperationName = null;
        }
        
        saveStorageData(storageData);
        
        console.log(`🗑️ Removed operation ${operationName} from storage`);
        
        return {
            success: true,
            message: `Operation ${operationName} removed from storage`
        };
    } catch (error) {
        console.error('❌ Error removing operation:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    loadStorageData,
    saveStorageData,
    getTokenStatus,
    listVideos,
    getHistory,
    clearHistory,
    removeOperation
};
