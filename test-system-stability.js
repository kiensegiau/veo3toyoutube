const express = require('express');
const path = require('path');
const fs = require('fs');

// Test server stability
const app = express();
const PORT = 8889; // Different port to avoid conflict

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mock TTS endpoint for testing
app.post('/api/tts', (req, res) => {
    console.log('📝 Mock TTS request received:', req.body);
    
    const { text, voice, waitForCompletion } = req.body;
    
    if (!text) {
        return res.status(400).json({
            success: false,
            message: 'Text is required'
        });
    }
    
    // Simulate TTS processing
    const mockResponse = {
        success: true,
        requestId: `mock_${Date.now()}`,
        status: waitForCompletion ? 'SUCCESS' : 'PENDING',
        audioUrl: waitForCompletion ? 'https://example.com/mock-audio.mp3' : null,
        text: text,
        voice: voice || 'hn_female_ngochuyen_full_48k-fhg',
        timestamp: new Date().toISOString()
    };
    
    console.log('✅ Mock TTS response:', mockResponse);
    res.json(mockResponse);
});

app.get('/api/tts/list-audio', (req, res) => {
    const audioDir = path.join(__dirname, 'public/audio');
    let files = [];
    
    try {
        if (fs.existsSync(audioDir)) {
            files = fs.readdirSync(audioDir)
                .filter(file => file.endsWith('.mp3'))
                .map(file => ({
                    filename: file,
                    path: `/audio/${file}`,
                    size: fs.statSync(path.join(audioDir, file)).size,
                    created: fs.statSync(path.join(audioDir, file)).birthtime
                }));
        }
    } catch (error) {
        console.error('Error reading audio directory:', error);
    }
    
    res.json({
        success: true,
        files: files,
        count: files.length
    });
});

const server = app.listen(PORT, () => {
    console.log(`🧪 Test server running on http://localhost:${PORT}`);
    console.log(`📝 Test endpoints:`);
    console.log(`   POST /api/tts - Mock TTS endpoint`);
    console.log(`   GET  /api/tts/list-audio - List audio files`);
});

// Test the endpoints
async function testEndpoints() {
    const base = `http://localhost:${PORT}`;
    
    try {
        console.log('\n=== TESTING SYSTEM STABILITY ===');
        
        // Test 1: Mock TTS without waiting
        console.log('\n1. Testing mock TTS (no wait)...');
        const response1 = await fetch(`${base}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
                text: 'Xin chào! Đây là test hệ thống.',
                voice: 'hn_female_ngochuyen_full_48k-fhg',
                waitForCompletion: false
            })
        });
        const result1 = await response1.json();
        console.log('Result 1:', JSON.stringify(result1, null, 2));
        
        // Test 2: Mock TTS with waiting
        console.log('\n2. Testing mock TTS (with wait)...');
        const response2 = await fetch(`${base}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
                text: 'Test với tiếng Việt có dấu: àáảãạăắằẳẵặâấầẩẫậ',
                voice: 'hn_female_ngochuyen_full_48k-fhg',
                waitForCompletion: true
            })
        });
        const result2 = await response2.json();
        console.log('Result 2:', JSON.stringify(result2, null, 2));
        
        // Test 3: List audio files
        console.log('\n3. Testing list audio...');
        const response3 = await fetch(`${base}/api/tts/list-audio`);
        const result3 = await response3.json();
        console.log('Result 3:', JSON.stringify(result3, null, 2));
        
        console.log('\n✅ All tests completed successfully!');
        console.log('🌐 You can also test the HTML interface at: http://localhost:8889');
        
        // Gracefully shutdown test server
        server.close(() => {
            console.log('🛑 Test server closed');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        server.close(() => process.exit(1));
    }
}

// Run tests after server starts
setTimeout(testEndpoints, 2000);
