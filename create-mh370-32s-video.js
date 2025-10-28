const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

// Video Configuration
const SEGMENT_DURATION = 8; // Each segment duration (seconds)
const BATCH_SIZE = 50; // Số segments mỗi batch (do giới hạn ChatGPT tokens)

// Cache cookie để tránh lấy liên tục
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

        // Tìm dòng chứa cookies (bỏ qua dòng comment)
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
 * Lấy cookie từ cache hoặc fetch mới, fallback từ file txt
 */
async function getCachedOrFreshCookie(serverUrl) {
    const now = Date.now();

    // Nếu có cache và chưa hết hạn
    if (cachedCookie && (now - cookieCacheTime) < COOKIE_CACHE_DURATION) {
        console.log(`🍪 Sử dụng cached cookie (còn ${Math.floor((COOKIE_CACHE_DURATION - (now - cookieCacheTime)) / 1000 / 60)} phút)`);
        return cachedCookie;
    }

    // Lấy cookie mới từ server
    console.log(`🔄 Lấy cookie mới từ server...`);
    try {
        const response = await fetch(`${serverUrl}/api/labs/get-cookies`, {
            method: 'GET'
        });

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

        // Fallback: Đọc cookie từ file txt
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
 * Tạo video với transcript và hình ảnh đồng nhất
 */
async function createMH370Video32s() {
    try {
        const serverUrl = 'http://localhost:8888';
        // Allow override via env or CLI arg --url="..." or first positional
        const argv = process.argv.slice(2).join(' ');
        const urlFromFlag = (argv.match(/--url\s*=\s*"([^"]+)"/) || argv.match(/--url\s*=\s*'([^']+)'/) || argv.match(/--url\s*=\s*([^\s]+)/) || [])[1];
        const positionalUrl = argv && !argv.includes('--url') ? argv.trim().split(/\s+/)[0] : '';
        const youtubeUrl = process.env.YOUTUBE_URL || urlFromFlag || positionalUrl || 'https://youtu.be/52ru0qDc0LQ?si=zahSVRyDiQy7Jd6H';

        // Extract video ID từ URL
        const videoIdMatch = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;

        if (!videoId) {
            throw new Error('Không thể extract video ID từ URL');
        }

        // Step 0: Lấy metadata video (chỉ để lấy title)
        console.log('📹 [Step 0] Lấy metadata video YouTube...');

        let videoTitle = 'Unknown Video';

        try {
            const metadataResponse = await fetch(`${serverUrl}/api/get-video-metadata`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoId: videoId
                })
            });

            const metadataResult = await metadataResponse.json();
            console.log('📹 [Step 0] Metadata result:', metadataResult.success ? '✅ Success' : '❌ Failed');

            if (metadataResult.success && metadataResult.video) {
                videoTitle = metadataResult.video.title || 'Unknown Video';
                console.log(`📹 [Step 0] Video: "${videoTitle}"`);
            }
        } catch (error) {
            console.error(`❌ [Step 0] Lỗi lấy metadata:`, error.message);
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

        // Debug: Xem transcript format
        console.log('📝 [Step 1] Transcript type:', typeof transcriptResult.transcript);
        console.log('📝 [Step 1] Is array:', Array.isArray(transcriptResult.transcript));
        if (transcriptResult.transcript) {
            const preview = typeof transcriptResult.transcript === 'string'
                ? transcriptResult.transcript.substring(0, 200)
                : JSON.stringify(transcriptResult.transcript).substring(0, 200);
            console.log('📝 [Step 1] Transcript preview:', preview + '...');
        }

        // BƯỚC 1: Chuẩn hóa transcript thành văn bản dài
        let fullText = '';

        if (Array.isArray(transcriptResult.transcript)) {
            // Nếu là array, ghép tất cả text lại
            fullText = transcriptResult.transcript
                .map(item => {
                    if (typeof item === 'string') return item;
                    if (item && item.text) return item.text;
                    return '';
                })
                .join(' ');
        } else if (typeof transcriptResult.transcript === 'object' && transcriptResult.transcript.content) {
            // Transcript là object với content field
            fullText = transcriptResult.transcript.content;
        } else if (typeof transcriptResult.transcript === 'string') {
            // Transcript là string thuần
            fullText = transcriptResult.transcript;
        } else {
            throw new Error('Transcript format không hợp lệ');
        }

        // Chuẩn hóa: loại bỏ khoảng trắng thừa, xuống dòng
        fullText = fullText.replace(/\s+/g, ' ').trim();

        console.log(`📝 [Step 1] Transcript văn bản dài: ${fullText.length} ký tự`);
        console.log(`📝 [Step 1] Preview: "${fullText.substring(0, 200)}..."`);

        // BƯỚC 2: Chia văn bản dài thành segments 8 giây
        // Ước tính số từ có thể đọc trong 8 giây (khoảng 20-25 từ tiếng Việt)
        const wordsPerSegment = 25;
        const words = fullText.split(' ');
        const transcriptSegments = [];

        for (let i = 0; i < words.length; i += wordsPerSegment) {
            const segmentWords = words.slice(i, i + wordsPerSegment);
            const segmentText = segmentWords.join(' ');
            const segmentIndex = Math.floor(i / wordsPerSegment);

            transcriptSegments.push({
                index: segmentIndex,
                text: segmentText,
                startTime: segmentIndex * SEGMENT_DURATION,
                endTime: (segmentIndex + 1) * SEGMENT_DURATION,
                duration: SEGMENT_DURATION
            });
        }

        console.log(`📝 [Step 1] Đã chia thành ${transcriptSegments.length} segments`);

        // Tạo transcriptText để dùng cho ChatGPT
        const transcriptText = transcriptSegments.map(s => s.text).join(' ');

        // Tính toán số segments và batches dựa trên transcript
        const TOTAL_SEGMENTS = transcriptSegments.length;
        const NUM_BATCHES = Math.ceil(TOTAL_SEGMENTS / BATCH_SIZE);
        const VIDEO_DURATION = TOTAL_SEGMENTS * SEGMENT_DURATION;

        console.log(`📝 [Step 1] Tổng số segments: ${TOTAL_SEGMENTS} (${SEGMENT_DURATION}s/segment)`);
        console.log(`📝 [Step 1] Chia thành ${NUM_BATCHES} batches (${BATCH_SIZE} segments/batch)`);
        console.log(`📝 [Step 1] Tổng thời gian video: ${VIDEO_DURATION}s (${Math.floor(VIDEO_DURATION / 60)}:${(VIDEO_DURATION % 60).toString().padStart(2, '0')})`);

        const outputDir = `./temp/youtube-${TOTAL_SEGMENTS}segments-video`;

        // Tạo thư mục output
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Step 2: Xử lý từng batch
        console.log(`🤖 [Step 2] Xử lý ${NUM_BATCHES} batches...`);

        let allSegments = [];
        let overallTheme = '';
        let colorScheme = '';
        let visualStyle = '';

        // Xử lý từng batch
        for (let batchIndex = 0; batchIndex < NUM_BATCHES; batchIndex++) {
            const startSegment = batchIndex * BATCH_SIZE;
            const endSegment = Math.min((batchIndex + 1) * BATCH_SIZE, TOTAL_SEGMENTS);
            const batchSegmentCount = endSegment - startSegment;
            const batchStartTime = startSegment * SEGMENT_DURATION;
            const batchEndTime = endSegment * SEGMENT_DURATION;

            // Lấy transcript cho batch này
            const batchTranscriptSegments = transcriptSegments.slice(startSegment, endSegment);

            console.log(`\n🔄 [Batch ${batchIndex + 1}/${NUM_BATCHES}] Xử lý segments ${startSegment + 1}-${endSegment} (${batchStartTime}s-${batchEndTime}s, ${batchSegmentCount} segments)...`);

        // Step 2: ChatGPT phân tích và tạo prompt cho batch này
        console.log(`🤖 [Batch ${batchIndex + 1}] ChatGPT tạo prompt cho ${batchSegmentCount} segments...`);
        
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
                        content: `Bạn là chuyên gia tạo prompt video cho Veo3 với khả năng visual hóa nội dung transcript CHÍNH XÁC.

⚠️ QUAN TRỌNG TUYỆT ĐỐI:
1. 🎯 CHỈ tạo visual DỰA TRÊN nội dung CÓ TRONG transcript - KHÔNG sáng tạo thêm
2. 📖 ĐỌC KỸ transcript, hiểu đúng nội dung, rồi mới visual hóa
3. ✅ Mỗi segment PHẢI khớp với 1 phần CỤ THỂ trong transcript
4. ❌ KHÔNG tạo cảnh không liên quan đến transcript
5. ❌ KHÔNG có text/chữ/caption trong video (Veo3 không hỗ trợ)

Nhiệm vụ: Phân tích transcript thành ${batchSegmentCount} segments (${SEGMENT_DURATION}s/segment, từ ${batchStartTime}s đến ${batchEndTime}s):
1. ĐÚNG NỘI DUNG: Mỗi prompt phải visual hóa ĐÚNG 1 phần cụ thể trong transcript
2. MÀU SẮC ĐỒNG NHẤT: Chọn bảng màu phù hợp với chủ đề thực tế của transcript
3. PHONG CÁCH PHÙ HỢP: Documentary/cinematic/artistic tùy nội dung transcript
4. LIÊN KẾT MƯỢT: Các segments chuyển tiếp tự nhiên theo dòng chảy transcript
5. CHI TIẾT CỤ THỂ: Visual cụ thể từ transcript - KHÔNG sáng tạo
6. CÂU CHUYỆN ĐÚNG: Theo đúng logic và thứ tự của transcript

Trả về JSON format với ${batchSegmentCount} segments LIÊN TỤC (từ ${batchStartTime}s đến ${batchEndTime}s):
{
    "overallTheme": "Chủ đề CHÍNH duy nhất xuyên suốt video (dựa trên transcript)",
    "colorScheme": "Bảng màu NHẤT QUÁN cho toàn bộ video",
    "visualStyle": "Phong cách ĐỒNG NHẤT (documentary/cinematic/artistic)",
    "segments": [
        {
            "timeRange": "${batchStartTime}-${batchStartTime + SEGMENT_DURATION}s",
            "focus": "Phần đầu của batch (từ transcript)",
            "prompt": "Visual mở đầu batch - đúng nội dung transcript, CÓ LIÊN KẾT với segment sau"
        },
        {
            "timeRange": "${batchStartTime + SEGMENT_DURATION}-${batchStartTime + SEGMENT_DURATION * 2}s",
            "focus": "Tiếp tục chủ đề (từ transcript)",
            "prompt": "Visual tiếp nối segment trước - cùng BỐI CẢNH, LIÊN KẾT với segment trước/sau"
        },
        ... (tổng ${batchSegmentCount} segments - TẤT CẢ PHẢI CÙNG CHỦ ĐỀ/BỐI CẢNH)
        {
            "timeRange": "${batchEndTime - SEGMENT_DURATION}-${batchEndTime}s",
            "focus": "Kết thúc batch (từ transcript)",
            "prompt": "Visual kết thúc batch - LIÊN KẾT với segment trước, đúng nội dung transcript"
        }
    ]
}

⚠️ LƯU Ý: Tất cả segments PHẢI cùng overallTheme và visualStyle, KHÔNG nhảy sang chủ đề khác!` 
                    },
                    {
                        role: "user",
                        content: `🎯 ĐỌC KỸ transcript và tạo ${batchSegmentCount} prompts ĐÚNG NỘI DUNG cho batch ${batchIndex + 1}/${NUM_BATCHES} (${batchStartTime}s-${batchEndTime}s):

📄 TRANSCRIPT CHO BATCH NÀY (${batchSegmentCount} segments):
${batchTranscriptSegments.map((seg, idx) => `Segment ${startSegment + idx + 1} (${seg.startTime}s-${seg.endTime}s): "${seg.text}"`).join('\n')}

📄 TOÀN BỘ TRANSCRIPT (để hiểu context):
${transcriptText}

🔍 BƯỚC 1 - ĐỌC VÀ PHÂN TÍCH:
- Đọc KỸ TOÀN BỘ transcript từ đầu đến cuối
- Xác định CHỦ ĐỀ CHÍNH, BỐI CẢNH, và LUỒNG CÂU CHUYỆN
- Nắm rõ các sự kiện, khái niệm, hành động được đề cập
- Xác định MÔI TRƯỜNG/BỐI CẢNH chung xuyên suốt video

🎬 BƯỚC 2 - TẠO ${batchSegmentCount} PROMPTS LIÊN TỤC CHO BATCH NÀY:
1. CHỦ ĐỀ & BỐI CẢNH XUYÊN SUỐT:
   - Tất cả ${batchSegmentCount} segments PHẢI cùng 1 chủ đề/bối cảnh chính${batchIndex > 0 ? ` (tiếp nối từ batch trước)` : ''}
   - KHÔNG nhảy sang chủ đề/bối cảnh khác không liên quan
   - Visual phải CÓ SỰ LIÊN KẾT giữa các segments
   
2. ĐÚNG NỘI DUNG TRANSCRIPT:
   - Mỗi segment = visual hóa 1 phần CỤ THỂ trong transcript
   - Theo đúng THỨ TỰ và LOGIC của transcript
   - KHÔNG sáng tạo thêm cảnh không được nhắc đến

📋 VÍ DỤ VỀ TÍNH LIÊN TỤC:
✅ ĐÚNG - Video xuyên suốt về "du lịch biển":
   Seg 1: Bãi biển buổi sáng → Seg 2: Lặn biển → Seg 3: Ngắm san hô → Seg 4: Hoàng hôn biển
   → Tất cả cùng BỐI CẢNH BIỂN, liên kết mượt mà

❌ SAI - Nhảy cóc không liên quan:
   Seg 1: Bãi biển → Seg 2: Núi tuyết → Seg 3: Thành phố → Seg 4: Sa mạc
   → Nhảy lung tung, không có sự liên kết

📋 VÍ DỤ ĐÚNG SAI VỚI TRANSCRIPT:
✅ ĐÚNG: Transcript nói "máy bay cất cánh" → Prompt: "Máy bay Boeing cất cánh từ sân bay"
✅ ĐÚNG: Transcript nói "radar mất tín hiệu" → Prompt: "Màn hình radar với tín hiệu biến mất"
❌ SAI: Transcript về "nấu ăn" nhưng segment 5 lại viết về "đá bóng" (không liên quan)
❌ SAI: Tự thêm cảnh không có trong transcript

⚠️ YÊU CẦU VISUAL:
❌ KHÔNG có text/chữ/caption/subtitle/title trong video
❌ KHÔNG có graphic text/watermark/logo
✅ CHỈ visual thuần: objects, scenes, actions, movements, atmosphere

🎯 KIỂM TRA CUỐI CÙNG TRƯỚC KHI TRẢ VỀ:
1. Tất cả ${batchSegmentCount} segments có cùng CHỦ ĐỀ/BỐI CẢNH chính không?
2. Có segment nào nhảy sang chủ đề khác không liên quan không?
3. Visual có thể chuyển tiếp mượt mà từ segment này sang segment khác không?
4. Tất cả đều dựa trên NỘI DUNG CÓ TRONG transcript chứ?
${batchIndex > 0 ? `5. Batch này có LIÊN KẾT mượt mà với batch trước (chủ đề: ${overallTheme}) không?` : ''}

💡 MỤC TIÊU: ${batchSegmentCount} segments ghép lại phải như 1 video LIỀN MẠCH, XUYÊN SUỐT 1 CHỦ ĐỀ!`
                    }
                ],
                max_tokens: Math.min(16384, batchSegmentCount * 200), // Động dựa trên số segments trong batch
                temperature: 0.3 // Thấp để chính xác, ít sáng tạo, tập trung vào transcript
            })
        });
        
        const chatGPTResult = await chatGPTResponse.json();
        console.log(`🤖 [Batch ${batchIndex + 1}] ChatGPT result:`, chatGPTResult.choices ? '✅ Success' : '❌ Failed');

        if (!chatGPTResult.choices) {
            throw new Error('ChatGPT không trả về kết quả');
        }

        const analysisText = chatGPTResult.choices[0].message.content;
        console.log(`🤖 [Batch ${batchIndex + 1}] Phân tích hoàn chỉnh:`);
        console.log(analysisText);

        // Parse JSON từ response
        let batchAnalysis;
        try {
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                batchAnalysis = JSON.parse(jsonMatch[0]);

                // Lưu theme/color/style từ batch đầu tiên
                if (batchIndex === 0) {
                    overallTheme = batchAnalysis.overallTheme;
                    colorScheme = batchAnalysis.colorScheme;
                    visualStyle = batchAnalysis.visualStyle;
                    console.log(`✅ [Batch 1] Chủ đề chính: ${overallTheme}`);
                    console.log(`✅ [Batch 1] Màu sắc: ${colorScheme}`);
                    console.log(`✅ [Batch 1] Phong cách: ${visualStyle}`);
                } else {
                    console.log(`✅ [Batch ${batchIndex + 1}] Tiếp tục chủ đề: ${overallTheme}`);
                }

                // Thêm segments vào allSegments
                allSegments.push(...batchAnalysis.segments);
                console.log(`✅ [Batch ${batchIndex + 1}] Đã thêm ${batchAnalysis.segments.length} segments (tổng: ${allSegments.length}/${TOTAL_SEGMENTS})`);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error(`❌ [Batch ${batchIndex + 1}] Không thể parse JSON từ ChatGPT:`, parseError.message);
            throw new Error('ChatGPT không trả về JSON hợp lệ. Vui lòng thử lại.');
        }

        } // Kết thúc vòng lặp batch

        // Tạo analysis object tổng hợp từ tất cả batches
        const analysis = {
            overallTheme,
            colorScheme,
            visualStyle,
            segments: allSegments
        };

        console.log(`\n✅ [Step 2] Hoàn thành ${NUM_BATCHES} batches với ${allSegments.length} segments!`);
        console.log(`✅ [Step 2] Chủ đề: ${overallTheme}`);
        console.log(`✅ [Step 2] Màu sắc: ${colorScheme}`);
        console.log(`✅ [Step 2] Phong cách: ${visualStyle}`);
        
        // Lấy cookie trước khi tạo videos (chỉ lấy 1 lần cho tất cả)
        console.log('🍪 [Step 3] Lấy/cache cookie trước khi tạo videos...');
        await getCachedOrFreshCookie(serverUrl);
        
        // Step 3: Tối ưu hóa từng prompt với ChatGPT trước khi tạo video
        console.log('🤖 [Step 3] ChatGPT tối ưu hóa từng prompt cho Veo3...');
        
        // XỬ LÝ THEO LÔ để nhanh nhưng vẫn an toàn
        const veo3Results = [];
        const CONCURRENCY = 5; // số segment xử lý đồng thời
        console.log(`⏱️ [Step 3] Xử lý THEO LÔ ${analysis.segments.length} segments (concurrency=${CONCURRENCY})`);

        async function processOneSegment(index) {
            const segment = analysis.segments[index];
            console.log(`🤖 [Step 3] Tối ưu segment ${index + 1}: ${segment.timeRange}`);
            console.log(`🤖 [Step 3] Focus: ${segment.focus}`);

            try {
                // Tạo context về segments trước/sau để đảm bảo liên kết
                const prevSegment = index > 0 ? analysis.segments[index - 1] : null;
                const nextSegment = index < analysis.segments.length - 1 ? analysis.segments[index + 1] : null;

                // Gọi ChatGPT để tối ưu prompt với format chi tiết
                const optimizeResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                                content: `Bạn là chuyên gia tối ưu prompt cho Veo 3.1 (Google Video AI mới nhất).

Nhiệm vụ: Tối ưu hóa prompt thành JSON array chi tiết cho video 8 giây với CHUYỂN CẢNH mượt mà và VOICE-OVER tiếng Việt.

🎯 QUY TẮC VÀNG:
1. CHỈ tối ưu visual của prompt GỐC - KHÔNG đổi nội dung chính
2. KHÔNG thêm cảnh/yếu tố mới không có trong prompt gốc
3. CHỈ thêm chi tiết về: camera, transition, visual details, sound, voice-over
4. GIỮ NGUYÊN ý nghĩa và nội dung của prompt gốc

⚠️ TUYỆT ĐỐI KHÔNG ĐƯỢC:
❌ KHÔNG có text/chữ/subtitle HIỂN THỊ trong video
❌ KHÔNG có dòng chữ bất kỳ xuất hiện trên màn hình
❌ KHÔNG có caption, title, watermark hiển thị
❌ KHÔNG có voice-over, lời thoại, narration
✅ CHỈ có hình ảnh thuần + âm thanh nền (không text, không voice-over)

Trả về ĐÚNG format JSON array này (4 phần tử cho 8 giây):
[
  {
    "timeStart": 0,
    "timeEnd": 2,
    "action": "Mô tả hành động KHÔNG CÓ CHỮ HIỂN THỊ, chỉ visual thuần",
    "cameraStyle": "Phong cách camera (zoom in, pan left, tilt up, steady shot, etc)",
    "transition": "Chuyển cảnh từ scene trước (fade in, dissolve, cut, pan transition, zoom transition, etc)",
    "soundFocus": "Âm thanh nền phù hợp (ambient, music, sound effects - KHÔNG voice-over)",
    "visualDetails": "Chi tiết visual (màu sắc, ánh sáng, texture, shadows, etc) - KHÔNG CHỮ HIỂN THỊ"
  },
  ...
]

YÊU CẦU CHUYỂN CẢNH:
- Scene đầu tiên: transition liên kết với segment trước (hoặc fade in nếu là segment đầu)
- Các scenes giữa: transition mượt mà (dissolve, smooth pan, gradual zoom)
- Scene cuối cùng: transition chuẩn bị cho segment sau (hoặc fade out nếu là segment cuối)

CHỈ trả về JSON array, KHÔNG có giải thích hay text khác.` 
                            },
                            {
                                role: "user",
                                content: `Tối ưu prompt này thành JSON array chi tiết cho video 8 giây với CHUYỂN CẢNH mượt mà:

🎬 CHỦ ĐỀ CHÍNH CỦA TOÀN BỘ VIDEO: ${analysis.overallTheme}
🎨 MÀU SẮC ĐỒNG NHẤT: ${analysis.colorScheme}
📹 PHONG CÁCH: ${analysis.visualStyle}

📍 SEGMENT HIỆN TẠI ${index + 1}/${analysis.segments.length}: ${segment.timeRange}
📌 FOCUS CỦA SEGMENT NÀY: ${segment.focus}
📝 ORIGINAL PROMPT: ${segment.prompt}

⚠️ QUAN TRỌNG:
- Video này CHỈ có visual thuần túy + âm thanh nền
- KHÔNG có voice-over, lời thoại, narration
- KHÔNG hiển thị text/chữ trong video
- CHỈ có hình ảnh động + âm thanh nền phù hợp

⚠️ QUAN TRỌNG: Mỗi scene PHẢI NÊU RÕ chủ đề "${analysis.overallTheme}" trong action description.
   - Ví dụ: Thay vì "Hình ảnh máy bay bay" → "Hình ảnh máy bay MH370 bay qua vùng trời (chủ đề: ${analysis.overallTheme})"
   - Mỗi action PHẢI bắt đầu bằng context về chủ đề chính để Veo3 hiểu rõ câu chuyện

BỐI CẢNH LIÊN KẾT:
${prevSegment ? `- SEGMENT TRƯỚC (${prevSegment.timeRange}): ${prevSegment.focus}
  → Scene đầu tiên (0-2s) cần transition mượt mà từ segment trước
  → Prompt gốc segment trước: ${prevSegment.prompt}` : '- ĐÂY LÀ SEGMENT ĐẦU TIÊN\n  → Scene đầu (0-2s) dùng "fade in" hoặc "slow zoom in" để mở màn'}

${nextSegment ? `- SEGMENT SAU (${nextSegment.timeRange}): ${nextSegment.focus}
  → Scene cuối cùng (6-8s) cần transition chuẩn bị cho segment sau
  → Prompt gốc segment sau: ${nextSegment.prompt}` : '- ĐÂY LÀ SEGMENT CUỐI CÙNG\n  → Scene cuối (6-8s) dùng "fade out" hoặc "slow zoom out" để kết thúc'}

🎯 YÊU CẦU TUYỆT ĐỐI:
1. GIỮ NGUYÊN NỘI DUNG của ORIGINAL PROMPT: "${segment.prompt}"
   - KHÔNG thêm yếu tố mới không có trong prompt gốc
   - KHÔNG đổi ý nghĩa chính của prompt gốc
   - CHỈ chia nhỏ thành 4 scenes (0-2s, 2-4s, 4-6s, 6-8s) và thêm chi tiết kỹ thuật

2. CHI TIẾT CẦN THÊM (không đổi nội dung):
   - action: Mô tả visual ĐÚNG với prompt gốc - PHẢI NÊU RÕ CHỦ ĐỀ "${analysis.overallTheme}" - KHÔNG TEXT/CHỮ/VOICE-OVER
     VÍ DỤ: "Hình ảnh máy bay MH370 cất cánh (chủ đề: cuộc tìm kiếm MH370), với ánh sáng mờ ảo"
     KHÔNG ĐƯỢC: "Hình ảnh máy bay cất cánh" (thiếu context chủ đề)
   - cameraStyle: camera movement (zoom in/out, pan left/right/up/down, tilt, steady, tracking shot)
   - transition: chuyển cảnh (fade, dissolve, cut, smooth pan, cross dissolve, match cut)
   - soundFocus: âm thanh nền phù hợp (ambient, dramatic music, nature sounds, effects - KHÔNG voice-over)
   - visualDetails: màu ${analysis.colorScheme}, phong cách ${analysis.visualStyle}, lighting, texture, atmosphere

⚠️ TUYỆT ĐỐI KHÔNG ĐƯỢC:
- KHÔNG thêm cảnh/đối tượng/hành động mới không có trong ORIGINAL PROMPT
- KHÔNG có text overlay, subtitle, caption, chữ viết bất kỳ
- KHÔNG có voice-over, lời thoại, narration
- CHỈ visual thuần: objects, scenes, actions, movements từ ORIGINAL PROMPT
- NHƯNG PHẢI NÊU RÕ CHỦ ĐỀ "${analysis.overallTheme}" trong mỗi action để Veo3 hiểu context câu chuyện

QUAN TRỌNG VỀ TRANSITION GIỮA SEGMENTS:
- Scene 1 (0-2s): PHẢI transition mượt mà TỪ ${prevSegment ? `"${prevSegment.focus}" của segment trước` : 'màn hình đen với fade in'}
  ${prevSegment ? `→ Visual phải liên kết với scene cuối segment trước, dùng cross dissolve, match cut hoặc smooth pan` : '→ Fade in từ đen, hoặc slow zoom in'}
- Scenes 2-3 (2-6s): transition mượt giữa các scenes TRONG segment này
  → Dùng dissolve, smooth camera movement để kết nối
- Scene 4 (6-${SEGMENT_DURATION}s): PHẢI chuẩn bị transition SANG ${nextSegment ? `"${nextSegment.focus}" của segment sau` : 'kết thúc với fade out'}
  ${nextSegment ? `→ Visual và camera phải setup cho scene đầu segment sau, tạo continuity` : '→ Fade out hoặc slow zoom out để kết thúc'}

🎬 MỤC TIÊU: ${analysis.segments.length} segments ghép lại phải liền mạch như 1 video duy nhất!

📋 VÍ DỤ TRANSITION TỐT (dựa theo nội dung):
- Segment kết thúc với "object xa dần" 
  → Segment sau bắt đầu "zoom vào object mới" (liên kết: movement continuity)
- Segment kết thúc với "scene rộng" 
  → Segment sau bắt đầu "close-up detail" (liên kết: scale transition)
- Segment kết thúc với "màu sáng"
  → Segment sau bắt đầu "màu tương tự" (liên kết: color continuity)
- Segment kết thúc với "camera pan right"
  → Segment sau bắt đầu "camera continues panning" (liên kết: motion continuity)

CHỈ trả về JSON array, KHÔNG thêm text nào khác.` 
                            }
                        ],
                        max_tokens: 1500,
                        temperature: 0.3 // Thấp để giữ đúng nội dung, không sáng tạo thêm
                    })
                });

                const optimizeResult = await optimizeResponse.json();

                if (!optimizeResult.choices) {
                    throw new Error('ChatGPT optimization failed');
                }

                const optimizedContent = optimizeResult.choices[0].message.content.trim();

                // Parse JSON array từ response
                let detailedTimeline;
                try {
                    const jsonMatch = optimizedContent.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        detailedTimeline = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error('No JSON array found in response');
                    }
                } catch (parseError) {
                    console.warn(`⚠️ [Step 3] Không parse được JSON, dùng prompt gốc`);
                    detailedTimeline = null;
                }

                // Convert JSON array thành string prompt cho Veo 3.1
                let optimizedPrompt;
                if (detailedTimeline && Array.isArray(detailedTimeline)) {
                    // Thêm context chủ đề vào đầu prompt
                    const themeContext = `[CONTEXT: ${analysis.overallTheme}. Style: ${analysis.visualStyle}. Colors: ${analysis.colorScheme}] `;

                    // Convert chi tiết timeline thành string description (KHÔNG có voice-over)
                    const scenesDescription = detailedTimeline.map(scene => {
                        const transitionText = scene.transition ? `Transition: ${scene.transition}.` : '';
                        return `[${scene.timeStart}-${scene.timeEnd}s] ${transitionText} ${scene.action}. Camera: ${scene.cameraStyle}. Visual: ${scene.visualDetails}. Sound: ${scene.soundFocus}.`;
                    }).join(' ');

                    // Kết hợp context + scenes (KHÔNG có voice-over)
                    optimizedPrompt = themeContext + scenesDescription;

                    console.log(`✅ [Step 3] Segment ${index + 1} optimized với ${detailedTimeline.length} scenes chi tiết:`);
                    detailedTimeline.forEach(scene => {
                        console.log(`   [${scene.timeStart}-${scene.timeEnd}s] ${scene.action}`);
                        if (scene.transition) {
                            console.log(`      🔄 Transition: ${scene.transition}`);
                        }
                        console.log(`      📹 Camera: ${scene.cameraStyle}`);
                        console.log(`      🎨 Visual: ${scene.visualDetails}`);
                        console.log(`      🔊 Sound: ${scene.soundFocus}`);
                    });
                } else {
                    // Fallback: dùng prompt gốc (không có voice-over)
                    optimizedPrompt = segment.prompt;
                    console.log(`⚠️ [Step 3] Segment ${index + 1} dùng prompt gốc`);
                }

                // Tạo video với retry mechanism (exponential backoff)
                console.log(`🎬 [Step 3] Tạo video segment ${index + 1} với prompt string tối ưu...`);

                let veo3Result = null;
                let retryCount = 0;
                const maxRetries = 10; // Tăng lên 10 lần retry

                while (retryCount < maxRetries) {
                    try {
                        const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                input: optimizedPrompt,
                                prompt: optimizedPrompt
                            })
                        });

                        veo3Result = await veo3Response.json();

                        if (veo3Result.success) {
                            break; // Thành công, thoát vòng lặp
                        } else {
                            throw new Error(veo3Result.message || 'Create video failed');
                        }
                    } catch (error) {
                        retryCount++;
                        console.log(`⚠️ [Step 3] Segment ${index + 1} thất bại lần ${retryCount}/${maxRetries}: ${error.message}`);

                        if (retryCount < maxRetries) {
                            // Exponential backoff: 2^retryCount * 2 giây (2s, 4s, 8s, 16s, 32s, 64s, 128s)
                            const waitTime = Math.pow(2, retryCount) * 2000;
                            const waitSeconds = Math.floor(waitTime / 1000);
                            console.log(`⏳ [Step 3] Đợi ${waitSeconds}s trước khi retry (exponential backoff)...`);
                            await new Promise(resolve => setTimeout(resolve, waitTime));

                            // Refresh cookie nếu lỗi liên quan đến cookie
                            if (error.message.includes('cookie') || error.message.includes('Chrome Labs')) {
                                console.log(`🔄 [Step 3] Refresh cookie...`);
                                cachedCookie = null; // Xóa cache
                                await getCachedOrFreshCookie(serverUrl);
                            }
                        }
                    }
                }

                if (veo3Result && veo3Result.success) {
                    console.log(`✅ [Step 3] Segment ${index + 1} Veo3: ${veo3Result.operationName}`);
                    return {
                        segmentIndex: index,
                        timeRange: segment.timeRange,
                        focus: segment.focus,
                        originalPrompt: segment.prompt,
                        detailedTimeline: detailedTimeline,
                        optimizedPrompt: optimizedPrompt,
                        operationId: veo3Result.operationName,
                        success: true
                    };
                } else {
                    console.log(`❌ [Step 3] Segment ${index + 1} thất bại sau ${maxRetries} lần thử`);
                    return {
                        segmentIndex: index,
                        timeRange: segment.timeRange,
                        error: veo3Result?.message || 'Failed after retries',
                        success: false
                    };
                }
            } catch (error) {
                console.log(`❌ [Step 3] Segment ${index + 1} lỗi: ${error.message}`);
                return {
                    segmentIndex: index,
                    timeRange: segment.timeRange,
                    error: error.message,
                    success: false
                };
            }
        }

        for (let start = 0; start < analysis.segments.length; start += CONCURRENCY) {
            const end = Math.min(start + CONCURRENCY, analysis.segments.length);
            const indexes = Array.from({ length: end - start }, (_, i) => start + i);
            // giãn cách nhẹ giữa các request trong cùng lô để giảm burst
            const tasks = indexes.map((idx, offset) => (async () => {
                if (offset > 0) await new Promise(r => setTimeout(r, 200 * offset));
                return await processOneSegment(idx);
            })());
            const batchResults = await Promise.all(tasks);
            veo3Results.push(...batchResults);
            // nghỉ 1s giữa các lô
            if (end < analysis.segments.length) await new Promise(r => setTimeout(r, 1000));
        }

        // Tất cả requests đã hoàn thành (xử lý tuần tự)
        const successfulOperations = veo3Results.filter(r => r.success);
        
        console.log(`✅ [Step 3] Đã tối ưu và gửi ${successfulOperations.length}/${analysis.segments.length} Veo3 requests`);
        console.log(`🚀 [Step 3] Tất cả Veo3 đang chạy ngầm với prompt đã tối ưu...`);
        
        // Step 4: Chạy ngầm - kiểm tra và tải video khi sẵn sàng
        console.log(`🔄 [Step 4] Chạy ngầm - kiểm tra và tải video khi sẵn sàng...`);
        
        const downloadPromises = successfulOperations.map(async (veo3Result) => {
            const operationId = veo3Result.operationId;
            console.log(`🔄 [Step 4] Monitor operation: ${operationId}`);
            
            // Polling để kiểm tra trạng thái
            let attempts = 0;
            const maxAttempts = 60; // Tối đa 60 lần (5 phút)
            
            while (attempts < maxAttempts) {
                try {
                    const statusResponse = await fetch(`${serverUrl}/api/check-status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            operationName: operationId
                        })
                    });
                    
                    const statusResult = await statusResponse.json();
                    
                    if (statusResult.success && statusResult.videoStatus === 'COMPLETED' && statusResult.videoUrl) {
                        console.log(`✅ [Step 4] Operation ${operationId} đã hoàn thành!`);
                        
                        // Tải video
                        const downloadResponse = await fetch(`${serverUrl}/api/tts/download`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                audioUrl: statusResult.videoUrl,
                                filename: `video_segment_${veo3Result.segmentIndex}_${Date.now()}.mp4`
                            })
                        });
                        
                        const downloadResult = await downloadResponse.json();
                        
                        if (downloadResult.success) {
                            // API trả về savedTo, không phải outPath
                            const videoPath = downloadResult.savedTo || downloadResult.outPath || downloadResult.path;
                            console.log(`✅ [Step 4] Segment ${veo3Result.segmentIndex + 1} đã tải về`);
                            console.log(`✅ [Step 4] Video path: ${videoPath}`);
                            console.log(`✅ [Step 4] Public path: ${downloadResult.publicPath}`);
                            return {
                                segmentIndex: veo3Result.segmentIndex,
                                timeRange: veo3Result.timeRange,
                                focus: veo3Result.focus,
                                path: videoPath,
                                publicPath: downloadResult.publicPath,
                                filename: downloadResult.filename,
                                operationId: operationId,
                                success: true
                            };
                        } else {
                            console.log(`❌ [Step 4] Segment ${veo3Result.segmentIndex + 1} tải về thất bại: ${downloadResult.message}`);
                            return {
                                segmentIndex: veo3Result.segmentIndex,
                                error: 'Download failed',
                                success: false
                            };
                        }
                    } else if (statusResult.success && statusResult.videoStatus === 'PENDING') {
                        console.log(`⏳ [Step 4] Operation ${operationId} đang xử lý... (attempt ${attempts + 1})`);
                        attempts++;
                        await new Promise(resolve => setTimeout(resolve, 5000)); // Chờ 5 giây
                    } else {
                        console.log(`❌ [Step 4] Operation ${operationId} thất bại hoặc không tìm thấy`);
                        return {
                            segmentIndex: veo3Result.segmentIndex,
                            error: 'Operation failed',
                            success: false
                        };
                    }
                } catch (error) {
                    console.warn(`⚠️ [Step 4] Lỗi kiểm tra operation ${operationId}:`, error.message);
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
            
            console.log(`⏰ [Step 4] Operation ${operationId} timeout sau ${maxAttempts} attempts`);
            return {
                segmentIndex: veo3Result.segmentIndex,
                error: 'Timeout',
                success: false
            };
        });
        
        // Chờ tất cả video được tải về
        console.log(`⏳ [Step 4] Chờ tất cả video được tải về...`);
        const videoFiles = await Promise.all(downloadPromises);
        const successfulVideos = videoFiles.filter(v => v.success);
        
        console.log(`✅ [Step 4] Đã tải ${successfulVideos.length}/${successfulOperations.length} video`);
        
        // Step 5: Ghép video thành 1 video kết quả
        if (successfulVideos.length > 0) {
            console.log(`🎬 [Step 5] Ghép ${successfulVideos.length} video thành 1 video kết quả...`);
            
            // Sắp xếp theo thứ tự
            successfulVideos.sort((a, b) => a.segmentIndex - b.segmentIndex);
            
            // Kiểm tra các file video tồn tại
            const validVideoFiles = successfulVideos.filter(video => {
                if (!video.path || !fs.existsSync(video.path)) {
                    console.warn(`⚠️ [Step 5] File video không tồn tại: ${video.path}`);
                    return false;
                }
                return true;
            });
            
            if (validVideoFiles.length === 0) {
                throw new Error('Không có file video hợp lệ để ghép');
            }
            
            console.log(`📝 [Step 5] Có ${validVideoFiles.length} file video hợp lệ để ghép`);
            
            // Tạo file list cho ffmpeg
            const listPath = path.join(outputDir, 'video_list.txt');
            const listContent = validVideoFiles.map(video => {
                const absolutePath = path.resolve(video.path);
                const normalizedPath = absolutePath.replace(/\\/g, '/');
                return `file '${normalizedPath}'`;
            }).join('\n');
            
            console.log(`📝 [Step 5] Tạo file list: ${listPath}`);
            fs.writeFileSync(listPath, listContent, 'utf8');
            
            // Ghép video
            const finalVideoPath = path.join(outputDir, `video_${VIDEO_DURATION}s_final_${Date.now()}.mp4`);
            const mergeCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${finalVideoPath}"`;
            
            await execAsync(mergeCmd);
            
            console.log(`✅ [Step 5] Đã ghép video thành: ${finalVideoPath}`);
            
            // Lưu kết quả hoàn chỉnh
            const finalResult = {
                timestamp: new Date().toISOString(),
                youtubeUrl: youtubeUrl,
                transcript: transcriptText,
                overallTheme: analysis.overallTheme,
                colorScheme: analysis.colorScheme,
                visualStyle: analysis.visualStyle,
                segmentsCreated: analysis.segments.length,
                veo3OperationsSent: successfulOperations.length,
                videosDownloaded: successfulVideos.length,
                finalVideo: finalVideoPath,
                segments: analysis.segments,
                veo3Results: veo3Results,
                videoFiles: successfulVideos,
                outputDir: outputDir
            };
            
            const resultPath = path.join(outputDir, `video-${VIDEO_DURATION}s-result.json`);
            fs.writeFileSync(resultPath, JSON.stringify(finalResult, null, 2));
            
            console.log(`📊 [Step 5] Đã lưu kết quả vào: ${resultPath}`);
            
            console.log(`🎉 Hoàn thành tạo video ${VIDEO_DURATION}s!`);
            console.log(`🎉 Video kết quả: ${finalVideoPath}`);
            console.log(`🎉 Chủ đề: ${analysis.overallTheme}`);
            console.log(`🎉 Màu sắc: ${analysis.colorScheme}`);
            
            return {
                success: true,
                result: finalResult
            };
            
        } else {
            throw new Error('Không có video nào được tải về để ghép');
        }
        
    } catch (error) {
        console.error(`❌ Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

console.log(`🚀 [START] Tạo video từ YouTube với voice-over tiếng Việt (chia theo transcript)...`);
createMH370Video32s().then(result => {
    if (result.success) {
        console.log('🎉 Hoàn thành thành công!');
        console.log(`🎉 Video: ${result.result.finalVideo}`);
    } else {
        console.log(`❌ Thất bại: ${result.error}`);
    }
});
