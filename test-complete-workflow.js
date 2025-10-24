const fetch = require('node-fetch');

async function testCompleteWorkflow() {
    console.log('🎬 Testing Complete Workflow for Vietnamese YouTube Video...');
    console.log('📺 YouTube URL: https://www.youtube.com/watch?v=CkBkKc_vhgw');
    
    try {
        const response = await fetch('http://localhost:8888/api/create-video-from-youtube', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                youtubeUrl: 'https://www.youtube.com/watch?v=CkBkKc_vhgw',
                filename: 'kenken_workflow_test'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Complete workflow successful!');
            console.log(`📝 Message: ${result.message}`);
            console.log(`📁 Final video: ${result.finalVideo}`);
            console.log(`📊 Workflow steps:`, JSON.stringify(result.workflow?.steps, null, 2));
            
            if (result.workflow?.files) {
                console.log(`📂 Generated files:`);
                console.log(`  - Audio: ${result.workflow.files.audio || 'N/A'}`);
                console.log(`  - Merged video: ${result.workflow.files.mergedVideo || 'N/A'}`);
                console.log(`  - Muted video: ${result.workflow.files.mutedVideo || 'N/A'}`);
                console.log(`  - Final video: ${result.workflow.files.finalVideo || 'N/A'}`);
            }
            
            console.log('\n🎉 Workflow completed successfully!');
            console.log(`📺 Final video saved at: ${result.finalVideo}`);
            
        } else {
            console.log('❌ Complete workflow failed!');
            console.log(`📝 Error: ${result.message}`);
            console.log(`🔍 Details:`, JSON.stringify(result, null, 2));
            
            if (result.workflow?.error) {
                console.log(`🚨 Workflow error at step: ${result.workflow.error.step}`);
                console.log(`🚨 Error message: ${result.workflow.error.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

testCompleteWorkflow();
