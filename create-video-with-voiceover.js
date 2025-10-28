const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

// Video Configuration
const TARGET_SEGMENT_DURATION = 8; // Mục tiêu mỗi segment 8 giây
const MAX_CHARS_PER_SEGMENT = 200; // Số ký tự tối đa mỗi đoạn thoại (~8 giây)

// Cache cookie
let cachedCookie = null;
let cookieCacheTime = 0;
const COOKIE_CACHE_DURATION = 30 * 60 * 1000; // 30 phút

/**
 * Đọc cookie từ file labs-cookies.txt
 */
function readCookieFromFile() {
    try {
        const cookieFilePath = path.join(__dirname, 'labs-cookies.txt');
        if (!fs.existsSync(cookieFilePath)) {
            console.log('❌ File labs-cookies.txt không tồn tại');
            return null;
        }
        const content = fs.readFileSync(cookieFilePath, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() && !line.startsWith('#')) {
                console.log(`✅ Đọc cookie từ file labs-cookies.txt`);
                return line.trim();
            }
        }
        console.log('❌ Không tìm thấy cookies trong file');
        return null;
    } catch (error) {
        console.error('❌ Lỗi đọc cookie từ file:', error.message);
        return null;
    }
}

/**
 * Lấy cookie từ cache hoặc fetch mới
 */
async function getCachedOrFreshCookie(serverUrl) {
    const now = Date.now();
    if (cachedCookie && (now - cookieCacheTime) < COOKIE_CACHE_DURATION) {
        console.log(`🍪 Sử dụng cached cookie (còn ${Math.floor((COOKIE_CACHE_DURATION - (now - cookieCacheTime)) / 1000 / 60)} phút)`);
        return cachedCookie;
    }
    console.log(`🔄 Lấy cookie mới từ server...`);
    try {
        const response = await fetch(`${serverUrl}/api/labs/get-cookies`, { method: 'GET' });
        const result = await response.json();
        if (result.success && result.cookies) {
            cachedCookie = result.cookies;
            cookieCacheTime = now;
            console.log(`✅ Đã cache cookie mới từ server`);
            return cachedCookie;
        } else {
            throw new Error('Không lấy được cookie từ server');
        }
    } catch (error) {
        console.error(`❌ Lỗi lấy cookie từ server:`, error.message);
        console.log(`🔄 Thử lấy cookie từ file labs-cookies.txt...`);
        const cookieFromFile = readCookieFromFile();
        if (cookieFromFile) {
            cachedCookie = cookieFromFile;
            cookieCacheTime = now;
            console.log(`✅ Sử dụng cookie từ file labs-cookies.txt`);
            return cachedCookie;
        } else {
            console.error(`❌ Không thể lấy cookie từ cả server và file txt`);
            return null;
        }
    }
}

/**
 * Chia transcript thành các đoạn nhỏ dựa trên câu và độ dài
 */
function splitTranscriptIntoSegments(transcriptText) {
    console.log('📝 Chia transcript thành các đoạn...');
    
    // Tách thành các câu
    const sentences = transcriptText
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    const segments = [];
    let currentSegment = '';
    
    for (const sentence of sentences) {
        // Nếu thêm câu này vào segment hiện tại vẫn < MAX_CHARS_PER_SEGMENT
        if ((currentSegment + ' ' + sentence).length <= MAX_CHARS_PER_SEGMENT) {
            currentSegment += (currentSegment ? ' ' : '') + sentence + '.';
        } else {
            // Lưu segment hiện tại và bắt đầu segment mới
            if (currentSegment) {
                segments.push(currentSegment.trim());
            }
            currentSegment = sentence + '.';
        }
    }
    
    // Thêm segment cuối cùng
    if (currentSegment) {
        segments.push(currentSegment.trim());
    }
    
    console.log(`✅ Đã chia thành ${segments.length} đoạn thoại`);
    return segments;
}

/**
 * Tạo TTS cho một đoạn text
 */
async function createTTSForSegment(serverUrl, text, segmentIndex) {
    try {
        console.log(`🎙️ [TTS ${segmentIndex + 1}] Tạo voice-over...`);
        
        const ttsResponse = await fetch(`${serverUrl}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                voice: 'hn-quynhanh', // Giọng nữ miền Bắc
                speed: 1.0,
                timeout: 120000 // 2 phút timeout
            })
        });
        
        const ttsResult = await ttsResponse.json();
        
        if (ttsResult.success && ttsResult.audioPath) {
            console.log(`✅ [TTS ${segmentIndex + 1}] Voice-over đã tạo: ${ttsResult.audioPath}`);
            return {
                success: true,
                audioPath: ttsResult.audioPath,
                publicPath: ttsResult.publicPath,
                duration: ttsResult.duration || TARGET_SEGMENT_DURATION
            };
        } else {
            throw new Error(ttsResult.message || 'TTS failed');
        }
    } catch (error) {
        console.error(`❌ [TTS ${segmentIndex + 1}] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Tạo video với voice-over từ transcript
 */
async function createVideoWithVoiceover() {
    try {
        const serverUrl = 'http://localhost:8888';
        const youtubeUrl = 'https://youtu.be/52ru0qDc0LQ?si=zahSVRyDiQy7Jd6H';
        
        const videoIdMatch = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;
        
        if (!videoId) {
            throw new Error('Không thể extract video ID từ URL');
        }
        
        const outputDir = `./temp/youtube-voiceover-video`;
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Step 1: Lấy transcript từ YouTube
        console.log('📝 [Step 1] Lấy transcript từ YouTube...');
        const transcriptResponse = await fetch(`${serverUrl}/api/get-transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: youtubeUrl,
                lang: 'vi'
            })
        });
        
        const transcriptResult = await transcriptResponse.json();
        console.log('📝 [Step 1] Transcript result:', transcriptResult.success ? '✅ Success' : '❌ Failed');
        
        if (!transcriptResult.success) {
            throw new Error(`Không thể lấy transcript: ${transcriptResult.message}`);
        }
        
        const transcriptText = typeof transcriptResult.transcript === 'string' ? 
            transcriptResult.transcript : 
            JSON.stringify(transcriptResult.transcript);
        
        console.log(`📝 [Step 1] Transcript: ${transcriptText.substring(0, 300)}...`);
        
        // Step 2: Chia transcript thành các đoạn
        console.log('✂️ [Step 2] Chia transcript thành các đoạn...');
        const textSegments = splitTranscriptIntoSegments(transcriptText);
        console.log(`✅ [Step 2] Đã chia thành ${textSegments.length} đoạn`);
        
        // Step 3: Tạo TTS cho từng đoạn
        console.log('🎙️ [Step 3] Tạo voice-over cho từng đoạn...');
        const ttsPromises = textSegments.map((text, index) => 
            createTTSForSegment(serverUrl, text, index)
        );
        const ttsResults = await Promise.all(ttsPromises);
        const successfulTTS = ttsResults.filter(r => r.success);
        
        console.log(`✅ [Step 3] Đã tạo ${successfulTTS.length}/${textSegments.length} voice-over`);
        
        // Step 4: Lấy cookie
        console.log('🍪 [Step 4] Lấy cookie...');
        await getCachedOrFreshCookie(serverUrl);
        
        // Step 5: Tạo video cho từng đoạn với ChatGPT
        console.log('🤖 [Step 5] ChatGPT tạo prompt và tạo video...');
        
        const videoPromises = successfulTTS.map(async (ttsData, index) => {
            const text = textSegments[index];
            const audioDuration = ttsData.duration;
            
            console.log(`\n🤖 [Segment ${index + 1}/${successfulTTS.length}] Tạo prompt cho: "${text.substring(0, 50)}..."`);
            console.log(`🎙️ [Segment ${index + 1}] Voice-over: ${audioDuration}s`);
            
            // Gọi ChatGPT để tạo prompt
            const chatGPTResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { 
                            role: "system", 
                            content: `Bạn là chuyên gia tạo prompt video cho Veo3.
Nhiệm vụ: Tạo prompt video ${audioDuration} giây phù hợp với nội dung voice-over.

YÊU CẦU:
1. Visual phải KHỚP với nội dung voice-over
2. KHÔNG có text/chữ/subtitle trong video
3. Phong cách: Documentary, cinematic
4. Màu sắc: Xanh dương và xám, tạo cảm giác bí ẩn

Trả về JSON:
{
    "prompt": "Mô tả visual chi tiết cho video ${audioDuration}s",
    "focus": "Trọng tâm của đoạn này"
}`
                        },
                        {
                            role: "user",
                            content: `Tạo prompt video ${audioDuration}s cho voice-over này:

"${text}"

Prompt phải visual hóa ĐÚNG nội dung voice-over, KHÔNG sáng tạo thêm.`
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.3
                })
            });

