const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Tạo execAsync với timeout để tránh bị đơ
function execWithTimeout(command, timeoutMs = 300000) { // 5 phút timeout
    return new Promise((resolve, reject) => {
        const child = exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        });
        
        // Set timeout
        const timeout = setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error(`Command timeout after ${timeoutMs}ms`));
        }, timeoutMs);
        
        child.on('exit', () => {
            clearTimeout(timeout);
        });
    });
}

// Import các function trực tiếp thay vì qua API
const { getTranscript } = require('../transcript/transcript-management');
const { mergeVideos } = require('./merge-videos');
const { chunkedTTS } = require('../tts/vibee-tts');
const fetch = require('node-fetch');

// Mỗi video dài 8 giây
const VIDEO_DURATION = 8;

function ensureTempDir() {
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
}

function ensureOutputDir() {
    const outputDir = path.join(__dirname, '../../public/final-videos');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    return outputDir;
}

async function getAudioDuration(audioPath) {
    try {
        const command = `ffprobe -v quiet -show_entries format=duration -of csv="p=0" "${audioPath}"`;
        const { stdout } = await execAsync(command);
        const duration = parseFloat(stdout.trim());
        return Math.ceil(duration); // Làm tròn lên
    } catch (error) {
        console.error('❌ [getAudioDuration] Lỗi:', error);
        throw new Error(`Không thể lấy thời lượng audio: ${error.message}`);
    }
}

async function muteVideo(inputPath, outputPath) {
    try {
        console.log(`🔇 [muteVideo] Tắt tiếng video: ${inputPath} → ${outputPath}`);
        const command = `ffmpeg -i "${inputPath}" -c:v copy -an "${outputPath}" -y`;
        const { stdout, stderr } = await execAsync(command);
        console.log(`✅ [muteVideo] Hoàn thành tắt tiếng`);
        return outputPath;
    } catch (error) {
        console.error('❌ [muteVideo] Lỗi:', error);
        throw new Error(`Không thể tắt tiếng video: ${error.message}`);
    }
}

async function replaceAudio(videoPath, audioPath, outputPath) {
    try {
        console.log(`🎵 [replaceAudio] Thay thế audio: ${videoPath} + ${audioPath} → ${outputPath}`);
        const command = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${outputPath}" -y`;
        const { stdout, stderr } = await execAsync(command);
        console.log(`✅ [replaceAudio] Hoàn thành thay thế audio`);
        return outputPath;
    } catch (error) {
        console.error('❌ [replaceAudio] Lỗi:', error);
        throw new Error(`Không thể thay thế audio: ${error.message}`);
    }
}

async function createVideoFromYouTube(req, res) {
    try {
        const body = req.body || {};
        const youtubeUrl = body.youtubeUrl;
        const voice = body.voice || 'hn_female_ngochuyen_full_48k-fhg';
        const outputFilename = body.filename || `final_video_${Date.now()}.mp4`;
        
        if (!youtubeUrl) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu YouTube URL'
            });
        }
        
        console.log(`🎬 [createVideoFromYouTube] Bắt đầu workflow cho: ${youtubeUrl}`);
        
        const tempDir = ensureTempDir();
        const outputDir = ensureOutputDir();
        const finalOutputPath = path.join(outputDir, outputFilename);
        
        const workflow = {
            youtubeUrl,
            voice,
            outputFilename,
            steps: {
                transcript: false,
                rewrite: false,
                audio: false,
                videoMerge: false,
                mute: false,
                final: false
            },
            files: {
                transcript: null,
                rewritten: null,
                audio: null,
                mergedVideo: null,
                mutedVideo: null,
                final: null
            },
            durations: {
                audio: 0,
                videoCount: 0
            }
        };
        
        // Bước 1: Lấy transcript từ YouTube
        console.log(`📝 [Step 1] Lấy transcript từ YouTube...`);
        const transcriptReq = {
            body: { url: youtubeUrl }
        };
        const mockRes = {
            json: (data) => data,
            status: (code) => ({ json: (data) => data })
        };
        const transcriptResult = await getTranscript(transcriptReq, mockRes);
        if (!transcriptResult.success) {
            throw new Error('Không thể lấy transcript từ YouTube');
        }
        workflow.steps.transcript = true;
        workflow.files.transcript = transcriptResult.transcript;
        console.log(`✅ [Step 1] Đã lấy transcript (${transcriptResult.transcript.length} ký tự)`);
        
        // Bước 2: Viết lại transcript bằng ChatGPT
        console.log(`🤖 [Step 2] Viết lại transcript bằng ChatGPT...`);
        
        // Lấy transcript text
        let transcriptText = workflow.files.transcript;
        if (typeof transcriptText === 'object' && transcriptText.content) {
            transcriptText = transcriptText.content;
        }
        transcriptText = String(transcriptText || '');
        
        // Không giới hạn độ dài - sẽ xử lý text dài bằng chunked TTS
        console.log(`📝 [Step 2] Transcript độ dài: ${transcriptText.length} ký tự`);
        
        // Sử dụng ChatGPT API để rewrite (khoảng 15% thay đổi)
        try {
            const { rewriteWithChatGPT } = require('../transcript/transcript-management');
            
            // Tạo file tạm để ChatGPT có thể đọc
            const fs = require('fs');
            const path = require('path');
            const tempFilename = `temp_workflow_${Date.now()}.txt`;
            const tempFilePath = path.join(__dirname, '../../transcripts', tempFilename);
            
            // Tạo thư mục transcripts nếu chưa có
            const transcriptDir = path.join(__dirname, '../../transcripts');
            if (!fs.existsSync(transcriptDir)) {
                fs.mkdirSync(transcriptDir, { recursive: true });
            }
            
            // Ghi file tạm
            fs.writeFileSync(tempFilePath, transcriptText, 'utf8');
            
            // Gọi ChatGPT API để rewrite
            const rewriteReq = {
                body: {
                    filename: tempFilename,
                    openaiApiKey: process.env.OPENAI_API_KEY || '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'
                }
            };
            
            const rewriteResult = await rewriteWithChatGPT(rewriteReq, mockRes);
            
            if (rewriteResult.success) {
                // Đọc nội dung đã rewrite
                const rewrittenFilePath = rewriteResult.rewrittenPath;
                const rewrittenContent = fs.readFileSync(rewrittenFilePath, { encoding: 'utf8' });
                
                // Làm sạch ký tự đặc biệt
                let cleanedText = rewrittenContent.replace(/[^\w\s.,!?àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi, ' ');
                cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
                
                workflow.steps.rewrite = true;
                workflow.files.rewritten = cleanedText;
                console.log(`✅ [Step 2] ChatGPT rewrite thành công (${workflow.files.rewritten.length} ký tự)`);
                
                // Xóa file tạm
                try {
                    fs.unlinkSync(tempFilePath);
                    fs.unlinkSync(rewrittenFilePath);
                } catch (e) {
                    console.log(`⚠️ Không thể xóa file tạm: ${e.message}`);
                }
            } else {
                throw new Error('ChatGPT rewrite failed');
            }
        } catch (error) {
            console.error(`❌ [Step 2] ChatGPT rewrite thất bại: ${error.message}`);
            console.error(`🛑 [Step 2] Dừng workflow do lỗi ChatGPT API`);
            
            // Dừng workflow và báo lỗi
            return res.status(500).json({
                success: false,
                message: 'Workflow thất bại ở bước ChatGPT rewrite',
                error: error.message,
                step: 'ChatGPT rewrite',
                workflow: {
                    youtubeUrl: youtubeUrl,
                    voice: voice,
                    filename: outputFilename,
                    steps: {
                        transcript: true,
                        rewrite: false,
                        audio: false,
                        videoMerge: false,
                        mute: false,
                        final: false
                    },
                    error: {
                        step: 'ChatGPT rewrite',
                        message: error.message,
                        details: 'OpenAI API key không hợp lệ hoặc ChatGPT service không khả dụng'
                    }
                }
            });
        }
        
        // Bước 3: Tạo âm thanh từ transcript đã viết lại bằng chunkedTTS
        console.log(`🎵 [Step 3] Tạo âm thanh từ transcript (${workflow.files.rewritten.length} ký tự)...`);
        
        // Sử dụng chunkedTTS trực tiếp
        const ttsResult = await chunkedTTS(workflow.files.rewritten, voice, `workflow_audio_${Date.now()}.mp3`);
        
        if (!ttsResult.success) {
            throw new Error(`TTS thất bại: ${ttsResult.message}`);
        }
        
        workflow.steps.audio = true;
        workflow.files.audio = ttsResult.audioPath;
        console.log(`✅ [Step 3] Đã tạo âm thanh: ${ttsResult.filename}`);
        
        // Bước 4: Lấy thời lượng âm thanh và tính số video cần
        console.log(`⏱️ [Step 4] Tính toán thời lượng và số video cần...`);
        workflow.durations.audio = await getAudioDuration(workflow.files.audio);
        workflow.durations.videoCount = Math.ceil(workflow.durations.audio / VIDEO_DURATION);
        console.log(`📊 [Step 4] Âm thanh: ${workflow.durations.audio}s, Cần ${workflow.durations.videoCount} video`);
        
        // Bước 5: Ghép video ngẫu nhiên
        console.log(`🎬 [Step 5] Ghép ${workflow.durations.videoCount} video ngẫu nhiên...`);
        
        const mergeResponse = await fetch('http://localhost:8888/api/merge-videos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                duration: workflow.durations.audio,
                filename: `workflow_merged_${Date.now()}.mp4`
            })
        });
        
        const mergeResult = await mergeResponse.json();
        if (!mergeResult.success) {
            throw new Error(`Không thể ghép video: ${mergeResult.message}`);
        }
        workflow.steps.videoMerge = true;
        workflow.files.mergedVideo = mergeResult.output.path;
        console.log(`✅ [Step 5] Đã ghép video: ${mergeResult.output.filename}`);
        
        // Bước 6: Tắt tiếng video đã ghép
        console.log(`🔇 [Step 6] Tắt tiếng video...`);
        const mutedVideoPath = path.join(tempDir, `muted_${Date.now()}.mp4`);
        
        const muteCmd = `ffmpeg -y -i "${workflow.files.mergedVideo}" -c copy -an "${mutedVideoPath}"`;
        
        try {
            console.log(`🔧 [Step 6] Chạy lệnh: ${muteCmd}`);
            await execWithTimeout(muteCmd, 120000); // 2 phút timeout
            console.log(`✅ [Step 6] FFmpeg mute hoàn thành thành công`);
        } catch (error) {
            console.error(`❌ [Step 6] Lỗi FFmpeg mute:`, error);
            throw new Error(`Không thể tắt tiếng video: ${error.message}`);
        }
        
        workflow.steps.mute = true;
        workflow.files.mutedVideo = mutedVideoPath;
        console.log(`✅ [Step 6] Đã tắt tiếng video`);
        
        // Bước 7: Thay thế audio bằng giọng Vibee
        console.log(`🎵 [Step 7] Thay thế audio bằng giọng Vibee...`);
        
        const replaceCmd = `ffmpeg -y -i "${workflow.files.mutedVideo}" -i "${workflow.files.audio}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${finalOutputPath}"`;
        
        try {
            console.log(`🔧 [Step 7] Chạy lệnh: ${replaceCmd}`);
            await execWithTimeout(replaceCmd, 300000); // 5 phút timeout
            console.log(`✅ [Step 7] FFmpeg hoàn thành thành công`);
        } catch (error) {
            console.error(`❌ [Step 7] Lỗi FFmpeg:`, error);
            throw new Error(`Không thể thay thế audio: ${error.message}`);
        }
        
        workflow.steps.final = true;
        workflow.files.final = finalOutputPath;
        console.log(`✅ [Step 7] Hoàn thành video cuối cùng!`);
        
        // Dọn dẹp file tạm
        try {
            if (fs.existsSync(workflow.files.mutedVideo)) {
                fs.unlinkSync(workflow.files.mutedVideo);
            }
        } catch (err) {
            console.warn('⚠️ Không thể xóa file tạm:', err.message);
        }
        
        const finalStats = fs.statSync(finalOutputPath);
        const finalSizeMB = (finalStats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`🎉 [createVideoFromYouTube] Hoàn thành workflow!`);
        console.log(`📁 File cuối: ${outputFilename} (${finalSizeMB}MB)`);
        
        return res.json({
            success: true,
            message: 'Hoàn thành tạo video từ YouTube',
            workflow: {
                youtubeUrl,
                voice,
                outputFilename,
                steps: workflow.steps,
                durations: workflow.durations,
                files: {
                    final: {
                        filename: outputFilename,
                        path: finalOutputPath,
                        publicPath: `/final-videos/${outputFilename}`,
                        size: finalStats.size,
                        sizeMB: finalSizeMB
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('❌ [createVideoFromYouTube] Lỗi:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi tạo video từ YouTube: ' + error.message,
            error: error.message
        });
    }
}

module.exports = {
    createVideoFromYouTube
};
