const fetch = require('node-fetch');

async function testCompleteWorkflow() {
    const base = 'http://localhost:8888';
    
    try {
        console.log('=== TEST QUY TRÌNH HOÀN CHỈNH ===');
        
        // Step 1: Tạo TTS job (không chờ)
        console.log('\n1. Tạo TTS job...');
        const createPayload = {
            text: 'Xin chào! Đây là test quy trình TTS hoàn chỉnh.',
            voice: 'hn_female_ngochuyen_full_48k-fhg',
            format: 'mp3',
            waitForCompletion: false
        };
        
        const createRes = await fetch(`${base}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(createPayload)
        });
        
        const createResult = await createRes.json();
        console.log('✅ Tạo job thành công:', JSON.stringify(createResult, null, 2));
        
        if (!createResult.success) {
            throw new Error('Tạo job thất bại');
        }
        
        // Step 2: Chờ một chút rồi kiểm tra status (giả lập)
        console.log('\n2. Chờ xử lý...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 3: Kiểm tra danh sách audio files
        console.log('\n3. Kiểm tra danh sách MP3...');
        const listRes = await fetch(`${base}/api/tts/list-audio`);
        const listResult = await listRes.json();
        console.log('📁 Danh sách MP3:', JSON.stringify(listResult, null, 2));
        
        // Step 4: Test tạo job với chờ ngắn
        console.log('\n4. Test tạo job với chờ ngắn (10s)...');
        const quickPayload = {
            text: 'Test nhanh',
            voice: 'hn_female_ngochuyen_full_48k-fhg',
            format: 'mp3',
            waitForCompletion: true,
            maxWaitMs: 10000,
            pollIntervalMs: 2000,
            download: true,
            filename: 'test_nhanh.mp3'
        };
        
        const quickRes = await fetch(`${base}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(quickPayload)
        });
        
        const quickResult = await quickRes.json();
        console.log('⚡ Kết quả nhanh:', JSON.stringify(quickResult, null, 2));
        
        // Step 5: Kiểm tra lại danh sách
        console.log('\n5. Kiểm tra lại danh sách MP3...');
        const finalListRes = await fetch(`${base}/api/tts/list-audio`);
        const finalListResult = await finalListRes.json();
        console.log('📁 Danh sách cuối:', JSON.stringify(finalListResult, null, 2));
        
        console.log('\n✅ HOÀN THÀNH TEST QUY TRÌNH!');
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    }
}

testCompleteWorkflow();

