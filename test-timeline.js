const fetch = require('node-fetch');

async function testTimeline() {
    try {
        console.log('🎬 [testTimeline] Test tạo timeline JSON cho Veo3');
        
        const serverUrl = 'http://localhost:8888';
        
        // Step 1: Phân tích chi tiết 8 giây
        console.log('\n🔍 [Step 1] Phân tích chi tiết 8 giây...');
        const analysisResponse = await fetch(`${serverUrl}/api/analyze-second-by-second`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: './test.mp4',
                startSecond: 0,
                duration: 8
            })
        });
        
        const analysisResult = await analysisResponse.json();
        console.log('🔍 [Step 1] Analysis result:', analysisResult.success ? '✅ Success' : '❌ Failed');
        
        if (!analysisResult.success) {
            console.log('❌ [Step 1] Error:', analysisResult.message);
            return;
        }
        
        // Step 2: Tạo timeline JSON
        console.log('\n🎬 [Step 2] Tạo timeline JSON...');
        const timelineResponse = await fetch(`${serverUrl}/api/generate-veo3-timeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                detailedAnalysis: analysisResult.detailedAnalysis,
                videoInfo: analysisResult.videoInfo
            })
        });
        
        const timelineResult = await timelineResponse.json();
        console.log('🎬 [Step 2] Timeline result:', timelineResult.success ? '✅ Success' : '❌ Failed');
        
        if (timelineResult.success) {
            console.log('🎬 [Step 2] Timeline JSON created successfully');
            
            // Hiển thị timeline JSON
            console.log('\n📋 [Timeline] JSON format hoàn chỉnh:');
            console.log(JSON.stringify(timelineResult.timeline, null, 2));
            
            // Hiển thị chi tiết từng segment
            console.log('\n🎬 [Segments] Chi tiết từng segment:');
            timelineResult.timeline.forEach((segment, index) => {
                console.log(`\n🎬 Segment ${index + 1}:`);
                console.log(`   ⏰ Time: ${segment.timeStart}s - ${segment.timeEnd}s`);
                console.log(`   🎭 Action: ${segment.action}`);
                console.log(`   📹 Camera Style: ${segment.cameraStyle}`);
                console.log(`   🔊 Sound Focus: ${segment.soundFocus}`);
                console.log(`   🎨 Visual Details: ${segment.visualDetails}`);
            });
            
            // Tạo summary
            console.log('\n📊 [Summary] Tổng kết timeline:');
            console.log(`📊 Total segments: ${timelineResult.timeline.length}`);
            console.log(`📊 Total duration: ${timelineResult.timeline[timelineResult.timeline.length - 1]?.timeEnd || 0}s`);
            
            const cameraStyles = timelineResult.timeline.map(s => s.cameraStyle);
            const uniqueCameraStyles = [...new Set(cameraStyles)];
            console.log(`📊 Camera styles: ${uniqueCameraStyles.join(', ')}`);
            
            console.log('\n✅ [Success] Timeline JSON hoàn chỉnh cho Veo3 đã sẵn sàng!');
            console.log('💡 [Next] Có thể sử dụng timeline này để tạo video Veo3');
            
        } else {
            console.log('❌ [Step 2] Error:', timelineResult.message);
        }
        
    } catch (error) {
        console.error('❌ [testTimeline] Lỗi:', error);
    }
}

testTimeline();
