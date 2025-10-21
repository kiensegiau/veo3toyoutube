const fetch = require('node-fetch');

async function testDirectVietnamese() {
    console.log('🧪 Testing TTS with direct Vietnamese text...');
    
    try {
        const vietnameseText = `
        Xin chào các bạn, đây là Ken Ken Audio. Hôm nay chúng ta sẽ cùng nhau khám phá những câu chuyện thú vị và bổ ích. 
        Trong cuộc sống hàng ngày, chúng ta thường gặp phải nhiều tình huống khác nhau. Có những lúc vui vẻ, có những lúc buồn bã, 
        nhưng quan trọng nhất là chúng ta phải biết cách đối mặt và vượt qua những khó khăn đó. 
        
        Câu chuyện hôm nay kể về một cậu bé tên Minh, cậu ấy sống ở một ngôi làng nhỏ ven biển. Minh rất thích đi biển và 
        thường xuyên ra bờ biển để ngắm hoàng hôn. Một ngày nọ, khi Minh đang đi dạo trên bãi biển, cậu phát hiện ra một con cá 
        nhỏ bị mắc kẹt trong một hốc đá. Con cá trông rất yếu ớt và sắp chết vì thiếu nước.
        
        Minh cảm thấy rất thương cảm cho con cá và quyết định cứu nó. Cậu cẩn thận đưa tay vào hốc đá và nhẹ nhàng bế con cá ra ngoài. 
        Sau đó, Minh đem con cá ra biển và thả nó xuống nước. Con cá vui mừng bơi đi và quay lại nhìn Minh như để cảm ơn.
        
        Từ đó trở đi, Minh hiểu rằng việc giúp đỡ những sinh vật khác không chỉ mang lại niềm vui cho chúng mà còn làm cho bản thân 
        cảm thấy hạnh phúc hơn. Cậu quyết định sẽ tiếp tục giúp đỡ những con vật gặp khó khăn mà cậu gặp phải.
        
        Câu chuyện này dạy chúng ta rằng lòng tốt và sự quan tâm đến những sinh vật khác là những đức tính quý báu. 
        Khi chúng ta giúp đỡ người khác, chúng ta không chỉ mang lại niềm vui cho họ mà còn làm cho cuộc sống của chính mình 
        trở nên ý nghĩa và hạnh phúc hơn.
        
        Cảm ơn các bạn đã lắng nghe câu chuyện hôm nay. Hẹn gặp lại các bạn trong những câu chuyện tiếp theo của Ken Ken Audio. 
        Chúc các bạn một ngày tốt lành!
        `.trim();
        
        console.log(`📝 Vietnamese text length: ${vietnameseText.length} characters`);
        
        const response = await fetch('http://localhost:8888/api/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: vietnameseText,
                voice: 'hn_female_ngochuyen_full_48k-fhg',
                format: 'mp3',
                waitForCompletion: true,
                filename: 'test_vietnamese_direct.mp3'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Vietnamese TTS test successful!');
            console.log(`📁 Audio saved: ${result.downloaded?.path || 'N/A'}`);
            console.log(`🔗 Public path: ${result.downloaded?.publicPath || 'N/A'}`);
            console.log(`📊 File size: ${result.downloaded?.bytes || 'N/A'} bytes`);
        } else {
            console.log('❌ Vietnamese TTS test failed!');
            console.log(`Error: ${result.message}`);
        }
    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

testDirectVietnamese();
