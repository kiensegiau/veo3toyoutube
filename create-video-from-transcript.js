const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

// Video Configuration
const SEGMENT_DURATION = 8; // Mỗi segment 8 giây
const WORDS_PER_SEGMENT = 50; // Số từ ước tính cho 8 giây (có thể điều chỉnh)

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
 * Chia transcript thành các đoạn theo số từ
 */
function splitTranscriptIntoSegments(transcriptText, wordsPerSegment = WORDS_PER_SEGMENT) {
    // Tách thành các từ
    const words = transcriptText.trim().split(/\s+/);
    const segments = [];
    
    for (let i = 0; i < words.length; i += wordsPerSegment) {
        const segmentWords = words.slice(i, i + wordsPerSegment);
        const segmentText = segmentWords.join(' ');
        
        segments.push({
            index: segments.length,
            text: segmentText,
            wordCount: segmentWords.length,
            startWord: i,
            endWord: Math.min(i + wordsPerSegment, words.length)
        });
    }
    
    console.log(`📝 Đã chia transcript thành ${segments.length} segments (${wordsPerSegment} từ/segment)`);
    return segments;
}

/**
 * Tạo prompt với voice-over cho Veo3
 */
function createPromptWithVoiceOver(visualPrompt, voiceOverText, theme, colorScheme, style) {
    // Format: [Voice-over: "text"] + Visual description
    const voiceOverSection = `[Voice-over in Vietnamese: "${voiceOverText}"]`;
    const contextSection = `[Context: ${theme}. Style: ${style}. Colors: ${colorScheme}]`;
    const visualSection = visualPrompt;

    return `${voiceOverSection} ${contextSection} ${visualSection}`;
}

/**
 * Tạo video từ transcript với voice-over
 */
async function createVideoFromTranscript() {
    try {
        const serverUrl = 'http://localhost:8888';
        const youtubeUrl = 'https://youtu.be/52ru0qDc0LQ?si=zahSVRyDiQy7Jd6H';

        // Extract video ID
        const videoIdMatch = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;

        if (!videoId) {
            throw new Error('Không thể extract video ID từ URL');
        }

        const outputDir = `./temp/youtube-transcript-video`;
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
        
        console.log(`📝 [Step 1] Transcript length: ${transcriptText.length} ký tự`);
        console.log(`📝 [Step 1] Preview: ${transcriptText.substring(0, 200)}...`);

        // Step 2: Chia transcript thành các segments
        console.log('\n📊 [Step 2] Chia transcript thành segments...');
        const transcriptSegments = splitTranscriptIntoSegments(transcriptText, WORDS_PER_SEGMENT);
        
        console.log(`📊 [Step 2] Tổng số segments: ${transcriptSegments.length}`);
        console.log(`📊 [Step 2] Ước tính thời lượng video: ${transcriptSegments.length * SEGMENT_DURATION}s (${Math.floor(transcriptSegments.length * SEGMENT_DURATION / 60)}:${(transcriptSegments.length * SEGMENT_DURATION % 60).toString().padStart(2, '0')})`);

        // Step 3: Phân tích và tạo prompts với ChatGPT
        console.log('\n🤖 [Step 3] ChatGPT phân tích và tạo prompts...');
        
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
                        content: `Bạn là chuyên gia tạo prompt video cho Veo3 với khả năng tạo voice-over.

⚠️ QUAN TRỌNG: Veo3 có thể tạo video CÓ GIỌNG NÓI nếu yêu cầu trong prompt!

Nhiệm vụ: Phân tích transcript và tạo visual prompt cho ${transcriptSegments.length} segments (mỗi segment 8 giây).

Trả về JSON format:
{
    "overallTheme": "Chủ đề chính xuyên suốt video",
    "colorScheme": "Bảng màu đồng nhất",
    "visualStyle": "Phong cách (documentary/cinematic/artistic)",
    "voiceGender": "male hoặc female",
    "voiceTone": "Giọng điệu (calm/dramatic/energetic)",
    "segments": [
        {
            "index": 0,
            "voiceOverText": "Lời thoại tiếng Việt cho segment này (từ transcript)",
            "visualPrompt": "Mô tả visual tương ứng với lời thoại (KHÔNG text/chữ trên màn hình)",
            "focus": "Trọng tâm của segment"
        }
    ]
}

⚠️ YÊU CẦU:
1. voiceOverText: Lấy CHÍNH XÁC từ transcript, KHÔNG sáng tạo thêm
2. visualPrompt: Mô tả visual phù hợp với nội dung lời thoại
3. KHÔNG có text/chữ/caption hiển thị trên video
4. Tất cả segments cùng chủ đề, màu sắc, phong cách
5. Visual phải liên kết mượt mà giữa các segments`
                    },
                    {
                        role: "user",
                        content: `Tạo ${transcriptSegments.length} prompts (có voice-over) cho transcript này:

TRANSCRIPT SEGMENTS:
${transcriptSegments.map((seg, idx) => `
[Segment ${idx + 1}/${transcriptSegments.length}]:
Text: ${seg.text}
`).join('\n')}`
                    }
                ],
                max_tokens: Math.min(16384, transcriptSegments.length * 150),
                temperature: 0.3
            })
        });

        const chatGPTResult = await chatGPTResponse.json();
        console.log(`🤖 [Step 3] ChatGPT result:`, chatGPTResult.choices ? '✅ Success' : '❌ Failed');

        if (!chatGPTResult.choices) {
            throw new Error('ChatGPT không trả về kết quả');
        }

        const analysisText = chatGPTResult.choices[0].message.content;

        // Parse JSON
        let analysis;
        try {
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
                console.log(`✅ [Step 3] Chủ đề: ${analysis.overallTheme}`);
                console.log(`✅ [Step 3] Màu sắc: ${analysis.colorScheme}`);
                console.log(`✅ [Step 3] Phong cách: ${analysis.visualStyle}`);
            } else {
                throw new Error('No JSON found');
            }
        } catch (parseError) {
            console.error(`❌ [Step 3] Không parse được JSON:`, parseError.message);
            throw new Error('ChatGPT không trả về JSON hợp lệ');
        }

        // Lấy cookie trước
        console.log('\n🍪 [Step 4] Lấy cookie...');
        await getCachedOrFreshCookie(serverUrl);

        // Step 4: Tạo Video với Voice-over cho từng segment
        console.log('\n🎬 [Step 4] Tạo Video với Voice-over cho từng segment...');

        const segmentPromises = transcriptSegments.map(async (segment, index) => {
            // Delay để tránh overload
            await new Promise(resolve => setTimeout(resolve, index * 3000));

            console.log(`\n--- Segment ${index + 1}/${transcriptSegments.length} ---`);
            console.log(`📝 Text: ${segment.text.substring(0, 100)}...`);

            // Lấy data từ analysis
            const visualData = analysis.segments[index] || {};
            const voiceOverText = visualData.voiceOverText || segment.text;
            const visualPrompt = visualData.visualPrompt || segment.text;

            console.log(`🎙️ Voice-over: ${voiceOverText.substring(0, 100)}...`);
            console.log(`🎨 Visual: ${visualPrompt.substring(0, 100)}...`);

            // Tạo prompt kết hợp voice-over + visual cho Veo3
            const fullPrompt = createPromptWithVoiceOver(
                visualPrompt,
                voiceOverText,
                analysis.overallTheme,
                analysis.colorScheme,
                analysis.visualStyle
            );

            console.log(`📋 Full prompt: ${fullPrompt.substring(0, 150)}...`);

            // Tạo video với Veo3 (có voice-over)
            let veo3Result = null;
            let retryCount = 0;
            const maxRetries = 10;

            while (retryCount < maxRetries) {
                try {
                    const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            input: fullPrompt,
                            prompt: fullPrompt
                        })
                    });

                    veo3Result = await veo3Response.json();

                    if (veo3Result.success) {
                        break;
                    } else {
                        throw new Error(veo3Result.message || 'Create video failed');
                    }
                } catch (error) {
                    retryCount++;
                    console.log(`⚠️ Segment ${index + 1} thất bại lần ${retryCount}/${maxRetries}: ${error.message}`);

                    if (retryCount < maxRetries) {
                        const waitTime = Math.pow(2, retryCount) * 2000;
                        const waitSeconds = Math.floor(waitTime / 1000);
                        console.log(`⏳ Đợi ${waitSeconds}s trước khi retry...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));

                        if (error.message.includes('cookie') || error.message.includes('429')) {
                            console.log(`🔄 Refresh cookie...`);
                            cachedCookie = null;
                            await getCachedOrFreshCookie(serverUrl);
                        }
                    }
                }
            }

            if (veo3Result && veo3Result.success) {
                console.log(`✅ Segment ${index + 1} Veo3: ${veo3Result.operationName}`);
                return {
                    segmentIndex: index,
                    text: segment.text,
                    voiceOverText: voiceOverText,
                    visualPrompt: visualPrompt,
                    fullPrompt: fullPrompt,
                    operationId: veo3Result.operationName,
                    success: true
                };
            } else {
                console.log(`❌ Segment ${index + 1} thất bại sau ${maxRetries} lần thử`);
                return {
                    segmentIndex: index,
                    text: segment.text,
                    error: 'Failed after retries',
                    success: false
                };
            }
        });

        // Chờ tất cả segments
        const segmentResults = await Promise.all(segmentPromises);
        const successfulSegments = segmentResults.filter(r => r.success);

        console.log(`\n✅ [Step 4] Đã tạo ${successfulSegments.length}/${transcriptSegments.length} segments`);

        // Step 5: Monitor và download videos
        console.log('\n🔄 [Step 5] Monitor và download videos...');

        const downloadPromises = successfulSegments.map(async (segment) => {
            const operationId = segment.operationId;
            console.log(`🔄 Monitor operation: ${operationId}`);

            let attempts = 0;
            const maxAttempts = 60;

            while (attempts < maxAttempts) {
                try {
                    const statusResponse = await fetch(`${serverUrl}/api/check-status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ operationName: operationId })
                    });

                    const statusResult = await statusResponse.json();

                    if (statusResult.success && statusResult.videoStatus === 'COMPLETED' && statusResult.videoUrl) {
                        console.log(`✅ Operation ${operationId} hoàn thành!`);

                        // Download video
                        const downloadResponse = await fetch(`${serverUrl}/api/tts/download`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                audioUrl: statusResult.videoUrl,
                                filename: `segment_${segment.segmentIndex}_${Date.now()}.mp4`
                            })
                        });

                        const downloadResult = await downloadResponse.json();

                        if (downloadResult.success) {
                            const videoPath = downloadResult.savedTo || downloadResult.outPath;
                            console.log(`✅ Segment ${segment.segmentIndex + 1} đã tải về: ${videoPath}`);

                            return {
                                segmentIndex: segment.segmentIndex,
                                text: segment.text,
                                voiceOverText: segment.voiceOverText,
                                videoPath: videoPath,
                                success: true
                            };
                        }
                    } else if (statusResult.success && statusResult.videoStatus === 'PENDING') {
                        attempts++;
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    } else {
                        return { segmentIndex: segment.segmentIndex, error: 'Failed', success: false };
                    }
                } catch (error) {
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            return { segmentIndex: segment.segmentIndex, error: 'Timeout', success: false };
        });

        const videoFiles = await Promise.all(downloadPromises);
        const successfulVideos = videoFiles.filter(v => v.success);

        console.log(`\n✅ [Step 5] Đã tải ${successfulVideos.length}/${successfulSegments.length} videos`);

        // Step 6: Ghép tất cả videos thành 1 (videos đã có voice-over từ Veo3)
        if (successfulVideos.length > 0) {
            console.log(`\n🎬 [Step 6] Ghép ${successfulVideos.length} videos thành 1...`);

            successfulVideos.sort((a, b) => a.segmentIndex - b.segmentIndex);

            // Tạo file list
            const listPath = path.join(outputDir, 'video_list.txt');
            const listContent = successfulVideos.map(video => {
                const absolutePath = path.resolve(video.videoPath);
                return `file '${absolutePath.replace(/\\/g, '/')}'`;
            }).join('\n');

            fs.writeFileSync(listPath, listContent, 'utf8');

            // Ghép video
            const finalVideoPath = path.join(outputDir, `final_video_${Date.now()}.mp4`);
            const mergeCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${finalVideoPath}"`;

            await execAsync(mergeCmd);

            console.log(`✅ [Step 6] Video cuối: ${finalVideoPath}`);

            // Lưu kết quả
            const result = {
                timestamp: new Date().toISOString(),
                youtubeUrl: youtubeUrl,
                transcriptLength: transcriptText.length,
                wordsPerSegment: WORDS_PER_SEGMENT,
                segmentDuration: SEGMENT_DURATION,
                totalSegments: transcriptSegments.length,
                videosDownloaded: successfulVideos.length,
                estimatedDuration: `${successfulVideos.length * SEGMENT_DURATION}s`,
                finalVideo: finalVideoPath,
                overallTheme: analysis.overallTheme,
                colorScheme: analysis.colorScheme,
                visualStyle: analysis.visualStyle,
                voiceGender: analysis.voiceGender,
                voiceTone: analysis.voiceTone,
                segments: successfulVideos.map(v => ({
                    index: v.segmentIndex,
                    text: v.text,
                    voiceOver: v.voiceOverText,
                    videoPath: v.videoPath
                }))
            };

            const resultPath = path.join(outputDir, 'result.json');
            fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

            console.log(`\n🎉 Hoàn thành!`);
            console.log(`🎉 Video cuối: ${finalVideoPath}`);
            console.log(`🎉 Tổng segments: ${successfulVideos.length}`);
            console.log(`🎉 Thời lượng: ${successfulVideos.length * SEGMENT_DURATION}s (~${Math.floor(successfulVideos.length * SEGMENT_DURATION / 60)} phút)`);
            console.log(`🎉 Chủ đề: ${analysis.overallTheme}`);
            console.log(`🎉 Giọng nói: ${analysis.voiceGender} - ${analysis.voiceTone}`);

            return { success: true, result };
        } else {
            throw new Error('Không có video nào được tải về');
        }

    } catch (error) {
        console.error(`❌ Lỗi:`, error.message);
        return { success: false, error: error.message };
    }
}

console.log(`🚀 [START] Tạo video từ transcript YouTube...`);
createVideoFromTranscript().then(result => {
    if (result.success) {
        console.log('🎉 Hoàn thành thành công!');
    } else {
        console.log(`❌ Thất bại: ${result.error}`);
    }
});

