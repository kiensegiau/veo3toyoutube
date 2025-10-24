const fetch = require('node-fetch');

async function testDirectAPI() {
    try {
        console.log('🔍 [testDirectAPI] Test gọi API trực tiếp...');
        
        const serverUrl = 'http://localhost:8888';
        
        // Test gọi API create-video trực tiếp với prompt từ phân tích
        console.log('\n🔍 [Test] Gọi API create-video trực tiếp...');
        const response = await fetch(`${serverUrl}/api/create-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: "Trong một khung cảnh đêm tĩnh lặng, một chiếc máy bay trắng với logo và chữ 'Malaysia' màu xanh dương bay trên bầu trời đêm xanh đậm. Đám mây xung quanh mờ nhạt, ánh sáng yếu từ dưới phản chiếu lên cánh máy bay. Góc nhìn từ trên cao, nhìn chếch từ phía sau máy bay, tạo chiều sâu không gian. Không có chuyển động camera, focus chính vào máy bay. Tạo ra cảm giác tĩnh lặng, bình yên với không khí nhẹ nhàng của buổi tối trên không trung. Tạo video 8 giây với khung cảnh tương tự, nhấn mạnh vào sự yên bình và vẻ đẹp của bầu trời đêm.",
                prompt: "Trong một khung cảnh đêm tĩnh lặng, một chiếc máy bay trắng với logo và chữ 'Malaysia' màu xanh dương bay trên bầu trời đêm xanh đậm. Đám mây xung quanh mờ nhạt, ánh sáng yếu từ dưới phản chiếu lên cánh máy bay. Góc nhìn từ trên cao, nhìn chếch từ phía sau máy bay, tạo chiều sâu không gian. Không có chuyển động camera, focus chính vào máy bay. Tạo ra cảm giác tĩnh lặng, bình yên với không khí nhẹ nhàng của buổi tối trên không trung. Tạo video 8 giây với khung cảnh tương tự, nhấn mạnh vào sự yên bình và vẻ đẹp của bầu trời đêm."
            })
        });
        
        console.log('🔍 [Test] Đang chờ response...');
        const result = await response.json();
        console.log('🔍 [Test] Result:', result.success ? '✅ Success' : '❌ Failed');
        
        if (result.success) {
            console.log('🎉 [SUCCESS] Video tạo thành công!');
            console.log('📊 Operation:', result.operationName);
        } else {
            console.log('❌ [ERROR] Tạo video thất bại!');
            console.log('❌ Message:', result.message);
        }
        
    } catch (error) {
        console.error('\n❌ [EXCEPTION] Lỗi:', error.message);
    }
}

console.log('🚀 [START] Bắt đầu test direct API...');
testDirectAPI();
