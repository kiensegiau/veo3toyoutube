#!/usr/bin/env node

/**
 * 🧪 Test Cookie Extraction - Script để test tính năng tự động lấy cookie
 */

const AutoCookieExtractor = require('./auto-cookie-extractor');
const ChromeProfileUtils = require('./chrome-profile-utils');

async function testCookieExtraction() {
    console.log('🧪 Testing Cookie Extraction System');
    console.log('===================================\n');
    
    const extractor = new AutoCookieExtractor();
    const profileUtils = new ChromeProfileUtils();
    
    try {
        // 1. Liệt kê tất cả profiles
        console.log('📋 Step 1: Listing all profiles...');
        const profiles = profileUtils.listAllProfiles();
        console.log(`Found ${profiles.length} profiles: ${profiles.join(', ')}\n`);
        
        if (profiles.length === 0) {
            console.log('❌ No profiles found. Please create a profile first.');
            console.log('Run: node chrome-profile-utils.js create YouTube');
            return;
        }
        
        // 2. Thử lấy cookies từ profile đầu tiên
        console.log('🍪 Step 2: Extracting cookies from first profile...');
        const firstProfile = profiles[0];
        const result = await extractor.extractCookiesFromProfile(firstProfile);
        
        if (result.success) {
            console.log(`✅ Successfully extracted ${result.cookieCount} cookies from ${firstProfile}`);
            console.log(`🔐 Is logged in: ${result.isLoggedIn}`);
            console.log(`📏 Cookie string length: ${result.cookies.length} characters`);
            console.log(`🍪 First 100 chars: ${result.cookies.substring(0, 100)}...\n`);
            
            // 3. Lưu cookies vào file
            console.log('💾 Step 3: Saving cookies to file...');
            const filePath = extractor.saveCookiesToFile(result.cookies, `cookies-${firstProfile}-${Date.now()}.txt`);
            if (filePath) {
                console.log(`✅ Cookies saved to: ${filePath}\n`);
            }
            
            // 4. Cập nhật cookies.json
            console.log('🔄 Step 4: Updating cookies.json...');
            const updateSuccess = extractor.updateCookiesJsonFile(result.cookies);
            if (updateSuccess) {
                console.log('✅ cookies.json updated successfully\n');
            }
            
            // 5. Test cookies với Google Labs API
            console.log('🧪 Step 5: Testing cookies with Google Labs API...');
            const testResult = await extractor.testCookies(result.cookies);
            
            if (testResult.success) {
                console.log('✅ Cookies are valid and working!');
                console.log(`📊 API Response Status: ${testResult.status}`);
                if (testResult.sessionData) {
                    console.log('📋 Session data received from API');
                }
            } else {
                console.log('❌ Cookies test failed');
                console.log(`📊 Status: ${testResult.status}`);
                console.log(`💬 Message: ${testResult.message}`);
            }
            
        } else {
            console.log(`❌ Failed to extract cookies from ${firstProfile}`);
            console.log(`💬 Error: ${result.error}\n`);
            
            // Thử profile khác nếu có
            if (profiles.length > 1) {
                console.log('🔄 Trying other profiles...');
                const allResult = await extractor.extractCookiesFromAllProfiles();
                
                if (allResult.success) {
                    console.log(`✅ Successfully extracted cookies from ${allResult.profileName}`);
                    console.log(`🍪 Cookie count: ${allResult.cookieCount}`);
                } else {
                    console.log('❌ No cookies found in any profile');
                    console.log('💡 Please ensure you are logged in to Google Labs in at least one profile');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log('🧪 Cookie Extraction Test Script');
        console.log('================================');
        console.log('');
        console.log('Usage:');
        console.log('  node test-cookie-extraction.js           # Test with first available profile');
        console.log('  node test-cookie-extraction.js --help    # Show this help');
        console.log('');
        console.log('Prerequisites:');
        console.log('  1. At least one Chrome profile must exist');
        console.log('  2. Profile must be logged in to Google Labs');
        console.log('  3. Chrome must be installed');
        console.log('');
        console.log('Steps:');
        console.log('  1. Create profile: node chrome-profile-utils.js create GoogleLabs');
        console.log('  2. Login manually: node chrome-profile-utils.js login GoogleLabs');
        console.log('  3. Run this test: node test-cookie-extraction.js');
        return;
    }
    
    testCookieExtraction().catch(console.error);
}

module.exports = { testCookieExtraction };
