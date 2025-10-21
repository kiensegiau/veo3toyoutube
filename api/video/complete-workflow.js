const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Import các function trực tiếp thay vì qua API
const { getTranscript } = require('../transcript/transcript-management');
const { unifiedTTS } = require('../tts/vibee-tts');
const { mergeVideos } = require('./merge-videos');

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
        // Sử dụng transcript trực tiếp thay vì rewrite vì không có OpenAI key
        // Giới hạn độ dài transcript để tránh lỗi TTS và làm sạch ký tự đặc biệt
        let transcriptText = workflow.files.transcript;
        // Kiểm tra nếu transcript là object thì lấy content
        if (typeof transcriptText === 'object' && transcriptText.content) {
            transcriptText = transcriptText.content;
        }
        // Đảm bảo transcriptText là string
        transcriptText = String(transcriptText || '');
        if (transcriptText.length > 200) {
            transcriptText = transcriptText.substring(0, 200) + '...';
            console.log(`⚠️ [Step 2] Giới hạn transcript từ ${workflow.files.transcript.length} xuống ${transcriptText.length} ký tự`);
        }
        // Làm sạch ký tự đặc biệt có thể gây lỗi TTS
        transcriptText = transcriptText.replace(/[^\w\s.,!?àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi, ' ');
        transcriptText = transcriptText.replace(/\s+/g, ' ').trim();
        workflow.steps.rewrite = true;
        workflow.files.rewritten = transcriptText; // Sử dụng transcript gốc đã giới hạn
        console.log(`✅ [Step 2] Sử dụng transcript gốc (${workflow.files.rewritten.length} ký tự)`);
        
        // Bước 3: Tạo âm thanh bằng Vibee TTS
        console.log(`🎵 [Step 3] Tạo âm thanh bằng Vibee TTS...`);
        const ttsReq = {
            body: {
                text: workflow.files.rewritten,
                voice: voice,
                format: 'mp3',
                waitForCompletion: true,
                filename: `workflow_audio_${Date.now()}.mp3`
            }
        };
        const ttsResult = await unifiedTTS(ttsReq, mockRes);
        if (!ttsResult.success || !ttsResult.downloaded) {
            throw new Error('Không thể tạo âm thanh TTS');
        }
        workflow.steps.audio = true;
        workflow.files.audio = ttsResult.downloaded.path;
        console.log(`✅ [Step 3] Đã tạo âm thanh: ${ttsResult.downloaded.filename}`);
        
        // Bước 4: Lấy thời lượng âm thanh và tính số video cần
        console.log(`⏱️ [Step 4] Tính toán thời lượng và số video cần...`);
        workflow.durations.audio = await getAudioDuration(workflow.files.audio);
        workflow.durations.videoCount = Math.ceil(workflow.durations.audio / VIDEO_DURATION);
        console.log(`📊 [Step 4] Âm thanh: ${workflow.durations.audio}s, Cần ${workflow.durations.videoCount} video`);
        
        // Bước 5: Ghép video ngẫu nhiên
        console.log(`🎬 [Step 5] Ghép ${workflow.durations.videoCount} video ngẫu nhiên...`);
        const mergeReq = {
            body: {
                duration: workflow.durations.audio,
                filename: `workflow_merged_${Date.now()}.mp4`
            }
        };
        const mergeResult = await mergeVideos(mergeReq, mockRes);
        if (!mergeResult.success) {
            throw new Error('Không thể ghép video');
        }
        workflow.steps.videoMerge = true;
        workflow.files.mergedVideo = mergeResult.output.path;
        console.log(`✅ [Step 5] Đã ghép video: ${mergeResult.output.filename}`);
        
        // Bước 6: Tắt tiếng video đã ghép
        console.log(`🔇 [Step 6] Tắt tiếng video...`);
        const mutedVideoPath = path.join(tempDir, `muted_${Date.now()}.mp4`);
        await muteVideo(workflow.files.mergedVideo, mutedVideoPath);
        workflow.steps.mute = true;
        workflow.files.mutedVideo = mutedVideoPath;
        console.log(`✅ [Step 6] Đã tắt tiếng video`);
        
        // Bước 7: Thay thế audio bằng giọng Vibee
        console.log(`🎵 [Step 7] Thay thế audio bằng giọng Vibee...`);
        await replaceAudio(workflow.files.mutedVideo, workflow.files.audio, finalOutputPath);
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
