const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

console.log('🔥 [veo3-simple-workflow] Module được load lúc:', new Date().toISOString());

// Hàm tạo video 8s đơn giản
async function createSimple8sVideo(videoPath, options = {}) {
    try {
        console.log(`🎬 [createSimple8sVideo] Tạo video 8s đơn giản từ: ${videoPath}`);
        
        const {
            outputFilename = `veo3_simple_8s_${Date.now()}.mp4`
        } = options;
        
        const serverUrl = 'http://localhost:8888';
        
        // Step 1: Phân tích nội dung video gốc
        console.log(`🔍 [Step 1] Phân tích nội dung video gốc...`);
        const analyzeResponse = await fetch(`${serverUrl}/api/analyze-second-by-second`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: videoPath,
                startSecond: 0,
                duration: 8
            })
        });
        
        const analyzeResult = await analyzeResponse.json();
        if (!analyzeResult.success) {
            throw new Error(`Không thể phân tích video: ${analyzeResult.message}`);
        }
        
        console.log(`✅ [Step 1] Đã phân tích video gốc`);
        
        // Step 2: Tạo timeline từ phân tích
        console.log(`🎬 [Step 2] Tạo timeline từ phân tích...`);
        const timelineResponse = await fetch(`${serverUrl}/api/generate-veo3-timeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                detailedAnalysis: analyzeResult.detailedAnalysis,
                videoInfo: analyzeResult.videoInfo
            })
        });
        
        const timelineResult = await timelineResponse.json();
        if (!timelineResult.success) {
            throw new Error(`Không thể tạo timeline: ${timelineResult.message}`);
        }
        
        console.log(`✅ [Step 2] Đã tạo timeline từ nội dung video gốc`);
        
        // Step 3: Tìm prompt tốt nhất từ phân tích thực tế
        console.log(`🎬 [Step 3] Tìm prompt tốt nhất từ phân tích thực tế...`);
        let bestPrompt = null;
        
        // Debug: In ra tất cả prompts có sẵn
        console.log(`🔍 [Step 3] Debug - Tất cả prompts có sẵn:`);
        for (let i = 0; i < analyzeResult.detailedAnalysis.length; i++) {
            const analysis = analyzeResult.detailedAnalysis[i];
            if (analysis.analysis && analysis.analysis.veo3_prompt) {
                console.log(`🔍 [Step 3] Giây ${analysis.second}: ${analysis.analysis.veo3_prompt.substring(0, 100)}...`);
            }
        }
        
        // Tìm prompt có nội dung thực tế nhất (không phải mock)
        for (let i = 0; i < analyzeResult.detailedAnalysis.length; i++) {
            const analysis = analyzeResult.detailedAnalysis[i];
            if (analysis.analysis && analysis.analysis.veo3_prompt && 
                !analysis.analysis.veo3_prompt.includes('Create a professional video scene') &&
                !analysis.analysis.veo3_prompt.includes('technology and AI concepts') &&
                analysis.analysis.veo3_prompt.length > 50) { // Đảm bảo prompt đủ dài
                bestPrompt = analysis.analysis.veo3_prompt;
                console.log(`✅ [Step 3] Tìm thấy prompt tốt từ giây ${analysis.second}: ${bestPrompt.substring(0, 100)}...`);
                break;
            }
        }
        
        // Nếu không tìm thấy prompt tốt, dùng prompt từ timeline
        if (!bestPrompt) {
            console.log(`⚠️ [Step 3] Không tìm thấy prompt tốt, dùng prompt từ timeline...`);
            bestPrompt = timelineResult.timeline[0].action;
        }
        
        console.log(`🎬 [Step 3] Sử dụng prompt: ${bestPrompt.substring(0, 100)}...`);
        
        // Step 4: Tạo video Veo3 dựa trên nội dung thực tế
        console.log(`🎬 [Step 4] Tạo video Veo3 dựa trên nội dung thực tế...`);
        console.log(`🎬 [Step 4] Prompt sẽ gửi cho Veo3: "${bestPrompt}"`);
        const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: bestPrompt,
                prompt: bestPrompt
            })
        });
        
        const veo3Result = await veo3Response.json();
        if (!veo3Result.success) {
            throw new Error(`Không thể tạo video Veo3: ${veo3Result.message}`);
        }
        
        console.log(`✅ [Step 4] Veo3 video tạo thành công: ${veo3Result.operationName}`);
        console.log(`📝 [Step 4] Prompt dựa trên nội dung thực tế: ${bestPrompt.substring(0, 100)}...`);
        
        // Step 5: Chờ video hoàn thành
        console.log(`⏳ [Step 5] Chờ video Veo3 hoàn thành...`);
        let attempts = 0;
        const maxAttempts = 30; // 5 phút
        
        while (attempts < maxAttempts) {
            console.log(`⏳ [Step 5] Check status lần ${attempts + 1}/${maxAttempts}...`);
            
            const statusResponse = await fetch(`${serverUrl}/api/check-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operationName: veo3Result.operationName
                })
            });
            
            const statusResult = await statusResponse.json();
            if (!statusResult.success) {
                throw new Error(`Không thể check status: ${statusResult.message}`);
            }
            
            console.log(`⏳ [Step 5] Status: ${statusResult.videoStatus}`);
            
            if (statusResult.videoStatus === 'COMPLETED') {
                console.log(`✅ [Step 5] Video hoàn thành!`);
                console.log(`✅ [Step 5] Video URL: ${statusResult.videoUrl}`);
                
                // Step 6: Download video
                console.log(`📥 [Step 6] Download video...`);
                const downloadResponse = await fetch(`${serverUrl}/api/tts/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audioUrl: statusResult.videoUrl,
                        filename: outputFilename
                    })
                });
                
                const downloadResult = await downloadResponse.json();
                if (!downloadResult.success) {
                    throw new Error(`Không thể download video: ${downloadResult.message}`);
                }
                
                console.log(`✅ [Step 6] Video đã download: ${downloadResult.filename}`);
                
                return {
                    success: true,
                    message: `Đã tạo video 8s thành công`,
                    result: {
                        originalVideo: videoPath,
                        duration: 8,
                        veo3Operation: veo3Result.operationName,
                        videoUrl: statusResult.videoUrl,
                        downloadedFile: downloadResult.filename,
                        outputPath: downloadResult.path
                    }
                };
            }
            
            if (statusResult.videoStatus === 'FAILED') {
                throw new Error('Video Veo3 tạo thất bại');
            }
            
            // Chờ 10 giây trước khi check lại
            await new Promise(resolve => setTimeout(resolve, 10000));
            attempts++;
        }
        
        throw new Error('Timeout: Video Veo3 không hoàn thành trong thời gian cho phép');
        
    } catch (error) {
        console.error('❌ [createSimple8sVideo] Lỗi:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// API endpoint
async function createSimple8sVideoAPI(req, res) {
    try {
        console.log(`🎬 [createSimple8sVideoAPI] Bắt đầu tạo video 8s đơn giản...`);
        console.log(`🎬 [createSimple8sVideoAPI] Request body:`, JSON.stringify(req.body, null, 2));
        console.log(`🎬 [createSimple8sVideoAPI] ===== DEBUG START =====`);
        console.log(`🎬 [createSimple8sVideoAPI] Function được gọi!`);
        
        const { videoPath, outputFilename } = req.body;
        
        if (!videoPath) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu videoPath'
            });
        }
        
        // Kiểm tra file tồn tại
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({
                success: false,
                message: 'Video file không tồn tại'
            });
        }
        
        console.log(`🎬 [createSimple8sVideoAPI] Tạo video 8s từ: ${videoPath}`);
        
        const result = await createSimple8sVideo(videoPath, {
            outputFilename
        });
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Không thể tạo video 8s',
                error: result.error
            });
        }
        
        return res.json({
            success: true,
            message: `Đã tạo video 8s thành công`,
            result: {
                ...result.result,
                _debug: {
                    functionCalled: 'createSimple8sVideoAPI from veo3-simple-workflow.js - NEW VERSION WITH DEBUG',
                    timestamp: new Date().toISOString()
                }
            }
        });
        
    } catch (error) {
        console.error('❌ [createSimple8sVideoAPI] Lỗi:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi tạo video 8s',
            error: error.message
        });
    }
}

module.exports = {
    createSimple8sVideo,
    createSimple8sVideoAPI
};
