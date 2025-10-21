const { chunkedTTS } = require('./api/tts/vibee-tts');

async function testChunkedTTS() {
    console.log('🧪 Testing chunkedTTS with long text...');
    
    // Tạo text dài để test
    const longText = `
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
    
    console.log(`📝 Text length: ${longText.length} characters`);
    
    try {
        const result = await chunkedTTS(longText, 'hn_female_xuanthu_new', 'test_long_audio.mp3');
        
        if (result.success) {
            console.log('✅ ChunkedTTS test successful!');
            console.log(`📁 Audio saved to: ${result.savedTo}`);
            console.log(`🔗 Public path: ${result.publicPath}`);
            console.log(`📊 Chunks processed: ${result.chunksProcessed}`);
            console.log(`📏 Total length: ${result.totalLength} characters`);
        } else {
            console.log('❌ ChunkedTTS test failed!');
            console.log(`Error: ${result.message}`);
        }
    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

testChunkedTTS();
