const fetch = require('node-fetch');

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

/**
 * Tạo 1 video Veo3 đơn giản cho MH370
 */
async function createSingleMH370Video() {
    try {
        console.log('🚀 [MH370] Tạo 1 video Veo3 đơn giản...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Prompt đơn giản cho MH370
        const prompt = "Hình ảnh máy bay Boeing 777 của Malaysia Airlines bay trên bầu trời xanh, với logo hãng rõ ràng. Một dòng chữ hiện lên: 'Cuộc điều tra MH370 bắt đầu'. Phía xa là bầu trời xanh đậm, tạo cảm giác bí ẩn và rộng lớn, phù hợp với phong cách tài liệu.";
        
        console.log(`🎬 [MH370] Prompt: ${prompt.substring(0, 100)}...`);
        
        // Tạo video Veo3
        console.log('🎬 [MH370] Tạo video Veo3...');
        const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: prompt,
                prompt: prompt
            })
        });
        
        const veo3Result = await veo3Response.json();
        
        if (veo3Result.success) {
            console.log(`✅ [MH370] Video Veo3: ${veo3Result.operationName}`);
            console.log(`⏳ [MH370] Video đang được tạo...`);
            console.log(`⏳ [MH370] Kiểm tra thư mục public/audio/ để xem video mới`);
            
            return {
                success: true,
                operationId: veo3Result.operationName,
                prompt: prompt
            };
        } else {
            console.log(`❌ [MH370] Veo3 thất bại: ${veo3Result.message}`);
            return {
                success: false,
                error: veo3Result.message
            };
        }
        
    } catch (error) {
        console.error(`❌ [MH370] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

console.log('🚀 [START] Tạo 1 video Veo3 đơn giản cho MH370...');
createSingleMH370Video().then(result => {
    if (result.success) {
        console.log('🎉 [MH370] Hoàn thành thành công!');
        console.log(`🎉 [MH370] Operation ID: ${result.operationId}`);
    } else {
        console.log(`❌ [MH370] Thất bại: ${result.error}`);
    }
});
