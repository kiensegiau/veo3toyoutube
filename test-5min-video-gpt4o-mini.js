const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Cấu hình
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';
const VIDEO_PATH = './public/videos/mh370-5min-video.mp4'; // Đường dẫn video 5 phút
const OUTPUT_DIR = './temp/mh370-5min-test';
const SEGMENT_DURATION = 8; // 8 giây mỗi segment

// Tạo thư mục output
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function testVideoAnalysis() {
    console.log('🎬 Bắt đầu test video 5 phút với GPT-4o-mini...');
    console.log(`📁 Video: ${VIDEO_PATH}`);
    console.log(`📁 Output: ${OUTPUT_DIR}`);
    console.log(`⏱️  Chia thành segments 8s mỗi đoạn\n`);

    try {
        // Bước 1: Kiểm tra video tồn tại
        if (!fs.existsSync(VIDEO_PATH)) {
            console.error('❌ Video không tồn tại:', VIDEO_PATH);
            return;
        }

        // Bước 2: Lấy thông tin video
        console.log('📊 Lấy thông tin video...');
        const videoInfo = await getVideoInfo(VIDEO_PATH);
        console.log(`✅ Video info: ${videoInfo.duration}s, ${videoInfo.width}x${videoInfo.height}, ${videoInfo.fps}fps`);

        // Bước 3: Chia video thành segments 8s
        console.log('\n✂️  Chia video thành segments 8s...');
        const segments = await splitVideoIntoSegments(VIDEO_PATH, OUTPUT_DIR, SEGMENT_DURATION);
        console.log(`✅ Đã tạo ${segments.length} segments`);

        // Bước 4: Phân tích từng segment với GPT-4o-mini
        console.log('\n🔍 Phân tích từng segment với GPT-4o-mini...');
        const analysisResults = [];
        
        for (let i = 0; i < Math.min(segments.length, 5); i++) { // Test 5 segments đầu tiên
            const segment = segments[i];
            console.log(`\n📹 Phân tích segment ${i + 1}/${Math.min(segments.length, 5)}: ${segment.filename}`);
            
            try {
                const analysis = await analyzeSegmentWithGPT4oMini(segment.path, i);
                analysisResults.push({
                    segmentIndex: i,
                    segmentPath: segment.path,
                    analysis: analysis
                });
                console.log(`✅ Hoàn thành phân tích segment ${i + 1}`);
            } catch (error) {
                console.error(`❌ Lỗi phân tích segment ${i + 1}:`, error.message);
                analysisResults.push({
                    segmentIndex: i,
                    segmentPath: segment.path,
                    error: error.message
                });
            }
        }

        // Bước 5: Lưu kết quả
        const resultPath = path.join(OUTPUT_DIR, 'analysis-results.json');
        fs.writeFileSync(resultPath, JSON.stringify({
            videoInfo,
            segments: segments.slice(0, 5),
            analysisResults,
            timestamp: new Date().toISOString(),
            model: 'gpt-4o-mini'
        }, null, 2));

        console.log(`\n✅ Hoàn thành test! Kết quả lưu tại: ${resultPath}`);
        console.log(`📊 Tổng kết:`);
        console.log(`   - Video: ${videoInfo.duration}s`);
        console.log(`   - Segments: ${segments.length}`);
        console.log(`   - Phân tích: ${analysisResults.filter(r => !r.error).length}/${analysisResults.length}`);
        console.log(`   - Model: GPT-4o-mini`);

    } catch (error) {
        console.error('❌ Lỗi trong quá trình test:', error);
    }
}

async function getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            videoPath
        ]);

        let output = '';
        ffprobe.stdout.on('data', (data) => {
            output += data.toString();
        });

        ffprobe.on('close', (code) => {
            if (code === 0) {
                try {
                    const info = JSON.parse(output);
                    const videoStream = info.streams.find(s => s.codec_type === 'video');
                    resolve({
                        duration: parseFloat(info.format.duration),
                        width: videoStream.width,
                        height: videoStream.height,
                        fps: eval(videoStream.r_frame_rate)
                    });
                } catch (error) {
                    reject(error);
                }
            } else {
                reject(new Error(`FFprobe failed with code ${code}`));
            }
        });
    });
}

async function splitVideoIntoSegments(videoPath, outputDir, segmentDuration) {
    return new Promise((resolve, reject) => {
        const segments = [];
        const totalDuration = 300; // 5 phút = 300 giây
        const numSegments = Math.ceil(totalDuration / segmentDuration);

        let completedSegments = 0;

        for (let i = 0; i < numSegments; i++) {
            const startTime = i * segmentDuration;
            const endTime = Math.min(startTime + segmentDuration, totalDuration);
            const filename = `segment_${i.toString().padStart(3, '0')}_${startTime}s-${endTime}s.mp4`;
            const segmentPath = path.join(outputDir, filename);

            const ffmpeg = spawn('ffmpeg', [
                '-i', videoPath,
                '-ss', startTime.toString(),
                '-t', (endTime - startTime).toString(),
                '-c', 'copy',
                '-avoid_negative_ts', 'make_zero',
                segmentPath
            ]);

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    segments.push({
                        index: i,
                        startTime,
                        endTime,
                        duration: endTime - startTime,
                        filename,
                        path: segmentPath
                    });
                    completedSegments++;

                    if (completedSegments === numSegments) {
                        resolve(segments);
                    }
                } else {
                    reject(new Error(`FFmpeg failed for segment ${i}`));
                }
            });
        }
    });
}

async function analyzeSegmentWithGPT4oMini(segmentPath, segmentIndex) {
    // Trích xuất frames từ segment
    const framesDir = path.join(OUTPUT_DIR, `frames_${segmentIndex}`);
    if (!fs.existsSync(framesDir)) {
        fs.mkdirSync(framesDir, { recursive: true });
    }

    // Trích xuất 8 frames (1 frame mỗi giây)
    await extractFrames(segmentPath, framesDir, 1);

    // Lấy danh sách frames
    const frameFiles = fs.readdirSync(framesDir)
        .filter(f => f.endsWith('.jpg'))
        .sort()
        .slice(0, 8); // Chỉ lấy 8 frames đầu

    // Chuẩn bị messages cho GPT-4o-mini
    const messages = [
        {
            role: 'system',
            content: `Bạn là chuyên gia phân tích video cho Veo3. Phân tích các frames từ video segment và tạo mô tả chi tiết cho việc tạo video mới.

Nhiệm vụ:
1. Phân tích nội dung visual của từng frame
2. Xác định chủ đề, cảm xúc, và phong cách
3. Mô tả chi tiết về camera movement, lighting, composition
4. Tạo prompt JSON cho Veo3 để tạo video tương tự

Format output:
{
    "overallTheme": "chủ đề tổng thể",
    "visualStyle": "phong cách visual",
    "cameraMovement": "chuyển động camera",
    "lighting": "ánh sáng",
    "composition": "bố cục",
    "emotion": "cảm xúc",
    "veo3Prompt": "prompt chi tiết cho Veo3",
    "timeline": [
        {
            "timeStart": 0,
            "timeEnd": 2,
            "action": "mô tả hành động",
            "cameraStyle": "góc máy quay",
            "soundFocus": "âm thanh",
            "visualDetails": "chi tiết visual"
        }
    ]
}`
        },
        {
            role: 'user',
            content: `Phân tích ${frameFiles.length} frames từ video segment ${segmentIndex}. Mỗi frame đại diện cho 1 giây của video 8 giây.`
        }
    ];

    // Thêm frames vào messages
    for (const frameFile of frameFiles) {
        const framePath = path.join(framesDir, frameFile);
        const frameData = fs.readFileSync(framePath);
        const base64 = frameData.toString('base64');
        
        messages.push({
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: `Frame ${frameFile} (giây ${frameFiles.indexOf(frameFile) + 1}):`
                },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:image/jpeg;base64,${base64}`
                    }
                }
            ]
        });
    }

    // Gọi API GPT-4o-mini
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7
        })
    });

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
        const analysisText = data.choices[0].message.content;
        
        try {
            // Thử parse JSON từ response
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            } else {
                return { rawAnalysis: analysisText };
            }
        } catch (error) {
            return { rawAnalysis: analysisText, parseError: error.message };
        }
    } else {
        throw new Error('Không nhận được response từ GPT-4o-mini');
    }
}

async function extractFrames(videoPath, outputDir, interval) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-vf', `fps=1/${interval}`,
            '-q:v', '2',
            path.join(outputDir, 'frame_%03d.jpg')
        ]);

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg frame extraction failed with code ${code}`));
            }
        });
    });
}

// Chạy test
if (require.main === module) {
    testVideoAnalysis().catch(console.error);
}

module.exports = { testVideoAnalysis };
















