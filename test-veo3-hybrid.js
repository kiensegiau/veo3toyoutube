const fetch = require('node-fetch');

// Test script cho Veo3 Hybrid workflow
async function testVeo3HybridWorkflow() {
    try {
        console.log('🚀 [testVeo3HybridWorkflow] Bắt đầu test Veo3 Hybrid workflow');
        
        const videoPath = './test.mp4'; // Video test của bạn
        const serverUrl = 'http://localhost:8888';
        
        // Test 1: Extract frames
        console.log('\n📸 [Test 1] Extract frames từ video...');
        const extractResponse = await fetch(`${serverUrl}/api/extract-frames`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: videoPath,
                count: 8,
                interval: 8,
                quality: 'medium'
            })
        });
        
        const extractResult = await extractResponse.json();
        console.log('📸 [Test 1] Extract frames result:', extractResult.success ? '✅ Success' : '❌ Failed');
        if (extractResult.success) {
            console.log(`📸 [Test 1] Extracted ${extractResult.frames.length} frames`);
            console.log(`📸 [Test 1] Video info: ${extractResult.videoInfo.duration}s, ${extractResult.videoInfo.width}x${extractResult.videoInfo.height}`);
        } else {
            console.log('❌ [Test 1] Error:', extractResult.message);
            return;
        }
        
        // Test 2: Analyze video with ChatGPT
        console.log('\n🤖 [Test 2] Phân tích video với ChatGPT...');
        const analyzeResponse = await fetch(`${serverUrl}/api/analyze-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: videoPath,
                frames: extractResult.frames
            })
        });
        
        const analyzeResult = await analyzeResponse.json();
        console.log('🤖 [Test 2] Analyze video result:', analyzeResult.success ? '✅ Success' : '❌ Failed');
        if (analyzeResult.success) {
            console.log('🤖 [Test 2] Analysis completed');
            console.log('🤖 [Test 2] Transcript length:', analyzeResult.transcript.length);
            if (analyzeResult.analysis) {
                console.log('🤖 [Test 2] Analysis scenes:', analyzeResult.analysis.scenes?.length || 'N/A');
            }
        } else {
            console.log('❌ [Test 2] Error:', analyzeResult.message);
            return;
        }
        
        // Test 3: Create Veo3 videos
        console.log('\n🎬 [Test 3] Tạo Veo3 videos...');
        const veo3Response = await fetch(`${serverUrl}/api/create-veo3-videos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                analysis: analyzeResult.analysis || { scenes: [] },
                options: {}
            })
        });
        
        const veo3Result = await veo3Response.json();
        console.log('🎬 [Test 3] Create Veo3 videos result:', veo3Result.success ? '✅ Success' : '❌ Failed');
        if (veo3Result.success) {
            console.log(`🎬 [Test 3] Created ${veo3Result.result.successfulVideos}/${veo3Result.result.totalVideos} Veo3 videos`);
            console.log('🎬 [Test 3] Operation names:', veo3Result.result.veo3Videos.map(v => v.operationName).join(', '));
        } else {
            console.log('❌ [Test 3] Error:', veo3Result.message);
        }
        
        // Test 4: Complete Hybrid workflow
        console.log('\n🚀 [Test 4] Complete Hybrid workflow...');
        const hybridResponse = await fetch(`${serverUrl}/api/veo3-hybrid-workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: videoPath,
                options: {
                    frameCount: 8,
                    frameInterval: 8,
                    outputFilename: `veo3_hybrid_test_${Date.now()}.mp4`
                }
            })
        });
        
        const hybridResult = await hybridResponse.json();
        console.log('🚀 [Test 4] Hybrid workflow result:', hybridResult.success ? '✅ Success' : '❌ Failed');
        if (hybridResult.success) {
            console.log('🚀 [Test 4] Workflow completed successfully');
            console.log('🚀 [Test 4] Next steps:', hybridResult.nextSteps);
        } else {
            console.log('❌ [Test 4] Error:', hybridResult.message);
        }
        
        console.log('\n🎉 [testVeo3HybridWorkflow] Test hoàn thành!');
        
    } catch (error) {
        console.error('❌ [testVeo3HybridWorkflow] Lỗi:', error);
    }
}

// Chạy test
if (require.main === module) {
    testVeo3HybridWorkflow();
}

module.exports = { testVeo3HybridWorkflow };
