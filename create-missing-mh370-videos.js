const fetch = require('node-fetch');

// ChatGPT API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

/**
 * Tạo 3 video Veo3 còn thiếu cho MH370
 */
async function createMissingMH370Videos() {
    try {
        console.log('🚀 [MH370] Tạo 3 video Veo3 còn thiếu...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Prompts cho 3 segments còn thiếu (dựa trên phân tích ChatGPT trước đó)
        const missingSegments = [
            {
                segmentIndex: 0,
                timeRange: "0-8s",
                focus: "Khởi đầu cuộc tìm kiếm MH370",
                prompt: "Hình ảnh máy bay Boeing 777 của Malaysia Airlines bay trên bầu trời xanh, với logo hãng rõ ràng. Một dòng chữ hiện lên: 'Cuộc điều tra MH370 bắt đầu'. Phía xa là bầu trời xanh đậm, tạo cảm giác bí ẩn và rộng lớn, phù hợp với phong cách tài liệu."
            },
            {
                segmentIndex: 1,
                timeRange: "8-16s",
                focus: "Biển Đông và sự biến mất bí ẩn",
                prompt: "Chuyển cảnh mượt mà từ máy bay sang hình ảnh biển Đông với làn nước xanh thẫm. Một radar hiển thị trên bề mặt nước, thể hiện tín hiệu máy bay dần mờ nhạt. Màu sắc xanh dương đậm và đen tạo nên cảm giác huyền bí và căng thẳng."
            },
            {
                segmentIndex: 2,
                timeRange: "16-24s",
                focus: "Vệ tinh và tín hiệu 'Handshake'",
                prompt: "Hình ảnh vệ tinh Inmarsat trong không gian, phát ra các tín hiệu 'Handshake'. Các vòng tròn đồng tâm xuất hiện trên bản đồ thế giới, điểm sáng thể hiện vị trí máy bay. Bảng màu xanh dương đậm và trắng tạo ra không khí công nghệ cao và bí ẩn."
            }
        ];
        
        console.log(`🎬 [MH370] Tạo ${missingSegments.length} video Veo3 còn thiếu...`);
        
        // Tạo các video Veo3 song song
        const veo3Promises = missingSegments.map(async (segment) => {
            console.log(`🎬 [MH370] Tạo video segment ${segment.segmentIndex + 1}: ${segment.timeRange}`);
            console.log(`🎬 [MH370] Focus: ${segment.focus}`);
            console.log(`🎬 [MH370] Prompt: ${segment.prompt.substring(0, 100)}...`);
            
            try {
                const veo3Response = await fetch(`${serverUrl}/api/create-video`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: segment.prompt,
                        prompt: segment.prompt
                    })
                });
                
                const veo3Result = await veo3Response.json();
                
                if (veo3Result.success) {
                    console.log(`✅ [MH370] Segment ${segment.segmentIndex + 1} Veo3: ${veo3Result.operationName}`);
                    return {
                        segmentIndex: segment.segmentIndex,
                        timeRange: segment.timeRange,
                        focus: segment.focus,
                        prompt: segment.prompt,
                        operationId: veo3Result.operationName,
                        success: true
                    };
                } else {
                    console.log(`❌ [MH370] Segment ${segment.segmentIndex + 1} thất bại: ${veo3Result.message}`);
                    return {
                        segmentIndex: segment.segmentIndex,
                        timeRange: segment.timeRange,
                        error: veo3Result.message,
                        success: false
                    };
                }
            } catch (error) {
                console.log(`❌ [MH370] Segment ${segment.segmentIndex + 1} lỗi: ${error.message}`);
                return {
                    segmentIndex: segment.segmentIndex,
                    timeRange: segment.timeRange,
                    error: error.message,
                    success: false
                };
            }
        });
        
        // Chờ tất cả Veo3 requests hoàn thành
        const veo3Results = await Promise.all(veo3Promises);
        const successfulOperations = veo3Results.filter(r => r.success);
        
        console.log(`✅ [MH370] Đã gửi ${successfulOperations.length}/3 Veo3 requests`);
        
        if (successfulOperations.length > 0) {
            console.log(`🚀 [MH370] Tất cả Veo3 đang chạy ngầm...`);
            console.log(`🚀 [MH370] Các operation IDs:`);
            successfulOperations.forEach(op => {
                console.log(`🚀 [MH370] - Segment ${op.segmentIndex + 1}: ${op.operationId}`);
            });
            
            console.log(`⏳ [MH370] Video sẽ được tải về trong vài phút...`);
            console.log(`⏳ [MH370] Kiểm tra thư mục public/audio/ để xem video mới`);
            
            return {
                success: true,
                operationsSent: successfulOperations.length,
                operations: successfulOperations
            };
        } else {
            throw new Error('Không có video Veo3 nào được tạo thành công');
        }
        
    } catch (error) {
        console.error(`❌ [MH370] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

console.log('🚀 [START] Tạo 3 video Veo3 còn thiếu cho MH370...');
createMissingMH370Videos().then(result => {
    if (result.success) {
        console.log('🎉 [MH370] Hoàn thành thành công!');
        console.log(`🎉 [MH370] Đã gửi ${result.operationsSent} Veo3 requests`);
        console.log(`⏳ [MH370] Video sẽ được tải về trong vài phút...`);
    } else {
        console.log(`❌ [MH370] Thất bại: ${result.error}`);
    }
});
