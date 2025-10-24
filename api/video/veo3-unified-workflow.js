const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Import các module
const { splitVideoInto8sSegments } = require('./veo3-video-splitter');
const { extractFramesFromSegment, analyzeFramesWithChatGPT, generateVeo3JSON } = require('./veo3-frame-analyzer');

/**
 * Workflow thống nhất: Tách video → Phân tích → Tạo JSON
 * @param {string} videoPath - Đường dẫn video gốc
 * @param {Object} options - Tùy chọn
 * @returns {Promise<Object>} - Kết quả workflow
 */
async function veo3UnifiedWorkflow(videoPath, options = {}) {
    try {
        console.log(`🎬 [veo3UnifiedWorkflow] Bắt đầu workflow thống nhất cho: ${videoPath}`);
        
        const {
            maxSegments = 200,
            segmentDuration = 8,
            frameInterval = 1,
            maxFrames = 8,
            outputDir = './temp/veo3-workflow'
        } = options;
        
        // Step 1: Tách video thành các đoạn 8s
        console.log(`✂️ [Step 1] Tách video thành các đoạn 8s...`);
        const splitResult = await splitVideoInto8sSegments(videoPath, {
            outputDir: path.join(outputDir, 'segments'),
            segmentDuration,
            maxSegments
        });
        
        if (!splitResult.success) {
            throw new Error(`Không thể tách video: ${splitResult.error}`);
        }
        
        console.log(`✅ [Step 1] Đã tách video thành ${splitResult.segments.length} segments`);
        
        // Step 2: Phân tích từng segment
        console.log(`🔍 [Step 2] Phân tích từng segment...`);
        const segmentResults = [];
        
        for (let i = 0; i < splitResult.segments.length; i++) {
            const segment = splitResult.segments[i];
            console.log(`🔍 [Step 2] Phân tích segment ${i + 1}/${splitResult.segments.length}: ${segment.filename}`);
            
            // Trích xuất frames từ segment
            const extractResult = await extractFramesFromSegment(segment.path, {
                outputDir: path.join(outputDir, 'frames', `segment_${i}`),
                frameInterval,
                maxFrames
            });
            
            if (!extractResult.success) {
                console.warn(`⚠️ [Step 2] Không thể trích xuất frames từ segment ${i}: ${extractResult.error}`);
                continue;
            }
            
            // Phân tích frames với ChatGPT
            const analyzeResult = await analyzeFramesWithChatGPT(extractResult.frames);
            
            if (!analyzeResult.success) {
                console.warn(`⚠️ [Step 2] Không thể phân tích frames từ segment ${i}: ${analyzeResult.error}`);
                continue;
            }
            
            // Tạo JSON format cho segment
            const jsonResult = await generateVeo3JSON(analyzeResult.detailedAnalysis, {
                duration: segment.duration,
                width: splitResult.videoInfo.width,
                height: splitResult.videoInfo.height,
                fps: splitResult.videoInfo.fps
            });
            
            if (!jsonResult.success) {
                console.warn(`⚠️ [Step 2] Không thể tạo JSON cho segment ${i}: ${jsonResult.error}`);
                continue;
            }
            
            segmentResults.push({
                segmentIndex: i,
                segment: segment,
                frames: extractResult.frames,
                detailedAnalysis: analyzeResult.detailedAnalysis,
                veo3JSON: jsonResult.timeline,
                outputDir: extractResult.outputDir
            });
            
            console.log(`✅ [Step 2] Đã phân tích segment ${i + 1}/${splitResult.segments.length}`);
        }
        
        console.log(`✅ [Step 2] Đã phân tích ${segmentResults.length} segments`);
        
        // Step 3: Tạo kết quả tổng hợp
        console.log(`📊 [Step 3] Tạo kết quả tổng hợp...`);
        
        const summary = {
            totalSegments: splitResult.segments.length,
            analyzedSegments: segmentResults.length,
            videoInfo: splitResult.videoInfo,
            outputDir: outputDir
        };
        
        // Lưu kết quả vào file
        const resultPath = path.join(outputDir, 'veo3-workflow-result.json');
        fs.writeFileSync(resultPath, JSON.stringify({
            summary: summary,
            segments: segmentResults
        }, null, 2));
        
        console.log(`✅ [Step 3] Đã lưu kết quả vào: ${resultPath}`);
        
        return {
            success: true,
            summary: summary,
            segments: segmentResults,
            resultPath: resultPath
        };
        
    } catch (error) {
        console.error(`❌ [veo3UnifiedWorkflow] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Workflow đơn giản: Chỉ tạo 1 video 8s từ video gốc
 * @param {string} videoPath - Đường dẫn video gốc
 * @param {Object} options - Tùy chọn
 * @returns {Promise<Object>} - Kết quả workflow
 */
async function veo3SimpleWorkflow(videoPath, options = {}) {
    try {
        console.log(`🎬 [veo3SimpleWorkflow] Tạo video 8s đơn giản từ: ${videoPath}`);
        
        const {
            startSecond = 0,
            duration = 8,
            frameInterval = 1,
            maxFrames = 8,
            outputDir = './temp/veo3-simple'
        } = options;
        
        // Tạo thư mục output
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Tạo segment 8s từ video gốc
        console.log(`✂️ [Step 1] Tạo segment 8s từ giây ${startSecond}...`);
        const segmentPath = path.join(outputDir, `segment_${startSecond}s-${startSecond + duration}s.mp4`);
        
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        const ffmpegCmd = `ffmpeg -i "${videoPath}" -ss ${startSecond} -t ${duration} -c copy -avoid_negative_ts make_zero "${segmentPath}"`;
        await execAsync(ffmpegCmd);
        
        console.log(`✅ [Step 1] Đã tạo segment: ${segmentPath}`);
        
        // Trích xuất frames
        console.log(`📸 [Step 2] Trích xuất frames...`);
        const extractResult = await extractFramesFromSegment(segmentPath, {
            outputDir: path.join(outputDir, 'frames'),
            frameInterval,
            maxFrames
        });
        
        if (!extractResult.success) {
            throw new Error(`Không thể trích xuất frames: ${extractResult.error}`);
        }
        
        console.log(`✅ [Step 2] Đã trích xuất ${extractResult.frames.length} frames`);
        
        // Phân tích frames
        console.log(`🔍 [Step 3] Phân tích frames với ChatGPT...`);
        const analyzeResult = await analyzeFramesWithChatGPT(extractResult.frames);
        
        if (!analyzeResult.success) {
            throw new Error(`Không thể phân tích frames: ${analyzeResult.error}`);
        }
        
        console.log(`✅ [Step 3] Đã phân tích ${analyzeResult.detailedAnalysis.length} frames`);
        
        // Tạo JSON format
        console.log(`🎬 [Step 4] Tạo JSON format cho Veo3...`);
        const jsonResult = await generateVeo3JSON(analyzeResult.detailedAnalysis, {
            duration: duration,
            width: 1920, // Default
            height: 1080, // Default
            fps: 30 // Default
        });
        
        if (!jsonResult.success) {
            throw new Error(`Không thể tạo JSON: ${jsonResult.error}`);
        }
        
        console.log(`✅ [Step 4] Đã tạo JSON format với ${jsonResult.timeline.length} segments`);
        
        // Lưu kết quả
        const resultPath = path.join(outputDir, 'veo3-simple-result.json');
        fs.writeFileSync(resultPath, JSON.stringify({
            segment: {
                path: segmentPath,
                startSecond: startSecond,
                duration: duration
            },
            frames: extractResult.frames,
            detailedAnalysis: analyzeResult.detailedAnalysis,
            veo3JSON: jsonResult.timeline,
            outputDir: extractResult.outputDir
        }, null, 2));
        
        console.log(`✅ [Step 4] Đã lưu kết quả vào: ${resultPath}`);
        
        return {
            success: true,
            segment: {
                path: segmentPath,
                startSecond: startSecond,
                duration: duration
            },
            frames: extractResult.frames,
            detailedAnalysis: analyzeResult.detailedAnalysis,
            veo3JSON: jsonResult.timeline,
            resultPath: resultPath
        };
        
    } catch (error) {
        console.error(`❌ [veo3SimpleWorkflow] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * API endpoint cho workflow thống nhất
 */
async function veo3UnifiedWorkflowAPI(req, res) {
    try {
        console.log(`🎬 [veo3UnifiedWorkflowAPI] API workflow thống nhất được gọi`);
        
        const { videoPath, maxSegments, segmentDuration, frameInterval, maxFrames, outputDir } = req.body;
        
        if (!videoPath) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu videoPath'
            });
        }
        
        const result = await veo3UnifiedWorkflow(videoPath, {
            maxSegments,
            segmentDuration,
            frameInterval,
            maxFrames,
            outputDir
        });
        
        if (result.success) {
            return res.json({
                success: true,
                message: `Đã hoàn thành workflow thống nhất cho ${result.summary.analyzedSegments} segments`,
                result: result
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }
        
    } catch (error) {
        console.error(`❌ [veo3UnifiedWorkflowAPI] Lỗi:`, error.message);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * API endpoint cho workflow đơn giản
 */
async function veo3SimpleWorkflowAPI(req, res) {
    try {
        console.log(`🎬 [veo3SimpleWorkflowAPI] API workflow đơn giản được gọi`);
        
        const { videoPath, startSecond, duration, frameInterval, maxFrames, outputDir } = req.body;
        
        if (!videoPath) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu videoPath'
            });
        }
        
        const result = await veo3SimpleWorkflow(videoPath, {
            startSecond,
            duration,
            frameInterval,
            maxFrames,
            outputDir
        });
        
        if (result.success) {
            return res.json({
                success: true,
                message: `Đã hoàn thành workflow đơn giản cho video 8s`,
                result: result
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }
        
    } catch (error) {
        console.error(`❌ [veo3SimpleWorkflowAPI] Lỗi:`, error.message);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

module.exports = {
    veo3UnifiedWorkflow,
    veo3SimpleWorkflow,
    veo3UnifiedWorkflowAPI,
    veo3SimpleWorkflowAPI
};
