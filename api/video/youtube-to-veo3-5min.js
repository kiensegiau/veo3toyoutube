const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

// Server URL
const SERVER_URL = 'http://localhost:8888';

// Cấu hình mặc định
const DEFAULT_CONFIG = {
    totalSegments: 36,      // Tổng số segments (36 x 8s = 288s ≈ 5 phút)
    segmentDuration: 8,     // Thời lượng mỗi segment (giây)
    delayBetweenRequests: 5000,  // Chờ giữa các Veo3 requests (ms)
    outputDir: './temp/youtube-veo3-5min',
    language: 'vi'          // Ngôn ngữ transcript
};

/**
 * Bước 1: Lấy transcript từ YouTube
 */
async function getYouTubeTranscript(youtubeUrl, language = 'vi') {
    try {
        console.log('📝 [Step 1] Lấy transcript từ YouTube...');
        console.log(`📝 [Step 1] URL: ${youtubeUrl}`);
        
        const response = await fetch(`${SERVER_URL}/api/get-transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: youtubeUrl,
                lang: language
            })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(`Không thể lấy transcript: ${result.message}`);
        }
        
        const transcriptText = typeof result.transcript === 'string' ? 
            result.transcript : 
            JSON.stringify(result.transcript);
        
        console.log(`✅ [Step 1] Đã lấy transcript thành công (${transcriptText.length} ký tự)`);
        console.log(`📝 [Step 1] Preview: ${transcriptText.substring(0, 200)}...`);
        
        return {
            success: true,
            transcript: transcriptText,
            videoInfo: result.videoInfo || {}
        };
        
    } catch (error) {
        console.error(`❌ [Step 1] Lỗi lấy transcript:`, error.message);
        throw error;
    }
}

module.exports = {
    youtubeToVeo3_5min,
    youtubeToVeo3_5minAPI
};

