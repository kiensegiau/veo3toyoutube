# 🎬 Tạo Video từ Transcript với Voice-over

Script này tạo video tự động từ transcript YouTube với **voice-over tiếng Việt** được tạo bởi **Veo3**.

## 🆕 Điểm khác biệt so với phiên bản cũ

### ❌ Phiên bản cũ (`create-mh370-32s-video.js`)
- Chia video theo **thời lượng video YouTube** (metadata)
- Tạo video **KHÔNG có voice-over**
- Cần ghép audio riêng sau

### ✅ Phiên bản mới (`create-video-from-transcript.js`)
- Chia video theo **nội dung transcript** (số từ)
- Veo3 tạo video **CÓ SẴN voice-over tiếng Việt**
- Không cần ghép audio, video đã hoàn chỉnh

## 🎯 Cách hoạt động

### Step 1: Lấy Transcript
```javascript
// Lấy transcript tiếng Việt từ YouTube
const transcriptResponse = await fetch(`${serverUrl}/api/get-transcript`, {
    method: 'POST',
    body: JSON.stringify({
        url: youtubeUrl,
        lang: 'vi'
    })
});
```

### Step 2: Chia Transcript thành Segments
```javascript
// Chia theo số từ (mặc định 50 từ/segment = ~8 giây)
const segments = splitTranscriptIntoSegments(transcriptText, 50);

// Ví dụ:
// Segment 1: "Chào mừng các bạn đến với video hôm nay..." (50 từ)
// Segment 2: "Hôm nay chúng ta sẽ tìm hiểu về..." (50 từ)
// ...
```

### Step 3: ChatGPT Phân tích và Tạo Prompts
```javascript
// ChatGPT tạo visual prompt + voice-over cho mỗi segment
{
    "overallTheme": "Cuộc tìm kiếm bí ẩn chuyến bay MH370",
    "colorScheme": "Xanh dương và xám",
    "visualStyle": "Documentary",
    "voiceGender": "female",
    "voiceTone": "calm",
    "segments": [
        {
            "index": 0,
            "voiceOverText": "Chào mừng các bạn đến với video...",
            "visualPrompt": "Hình ảnh máy bay bay qua đại dương...",
            "focus": "Giới thiệu"
        }
    ]
}
```

### Step 4: Tạo Video với Veo3
```javascript
// Prompt kết hợp voice-over + visual
const fullPrompt = `
[Voice-over in Vietnamese: "Chào mừng các bạn đến với video..."]
[Context: Cuộc tìm kiếm bí ẩn chuyến bay MH370. Style: Documentary. Colors: Xanh dương và xám]
Hình ảnh máy bay bay qua đại dương với ánh sáng mờ ảo...
`;

// Veo3 tạo video 8s CÓ VOICE-OVER
await fetch(`${serverUrl}/api/create-video`, {
    body: JSON.stringify({
        input: fullPrompt,
        prompt: fullPrompt
    })
});
```

### Step 5: Monitor và Download
```javascript
// Chờ Veo3 xử lý xong
// Download video (đã có voice-over sẵn)
```

### Step 6: Ghép Videos
```javascript
// Ghép tất cả segments thành 1 video hoàn chỉnh
// Sử dụng ffmpeg concat
```

## ⚙️ Cấu hình

```javascript
// Thời lượng mỗi segment
const SEGMENT_DURATION = 8; // 8 giây

// Số từ mỗi segment (điều chỉnh tùy tốc độ đọc)
const WORDS_PER_SEGMENT = 50; // ~50 từ = 8 giây
```

### 📊 Ước tính thời lượng

| Số từ/segment | Thời lượng/segment | Tốc độ đọc |
|---------------|-------------------|------------|
| 40 từ         | 8s                | Chậm       |
| 50 từ         | 8s                | Trung bình |
| 60 từ         | 8s                | Nhanh      |

## 🚀 Cách sử dụng

### 1. Cài đặt dependencies
```bash
npm install node-fetch
```

### 2. Chuẩn bị cookie
Tạo file `labs-cookies.txt` với cookie từ Chrome Labs:
```
# Cookie từ Chrome Labs
your_cookie_here
```

### 3. Chạy script
```bash
node create-video-from-transcript.js
```

### 4. Kết quả
```
./temp/youtube-transcript-video/
├── segment_0_xxx.mp4          # Video segment 1 (có voice-over)
├── segment_1_xxx.mp4          # Video segment 2 (có voice-over)
├── ...
├── final_video_xxx.mp4        # Video cuối cùng
├── video_list.txt             # File list cho ffmpeg
└── result.json                # Thông tin chi tiết
```

## 📋 Ví dụ Output

### result.json
```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "youtubeUrl": "https://youtu.be/52ru0qDc0LQ",
  "transcriptLength": 15000,
  "wordsPerSegment": 50,
  "segmentDuration": 8,
  "totalSegments": 120,
  "videosDownloaded": 120,
  "estimatedDuration": "960s",
  "finalVideo": "./temp/youtube-transcript-video/final_video_xxx.mp4",
  "overallTheme": "Cuộc tìm kiếm bí ẩn chuyến bay MH370",
  "colorScheme": "Xanh dương và xám",
  "visualStyle": "Documentary",
  "voiceGender": "female",
  "voiceTone": "calm",
  "segments": [
    {
      "index": 0,
      "text": "Chào mừng các bạn đến với video...",
      "voiceOver": "Chào mừng các bạn đến với video...",
      "videoPath": "./temp/youtube-transcript-video/segment_0_xxx.mp4"
    }
  ]
}
```

## 🎨 Tùy chỉnh Voice-over

### Thay đổi giọng nói
Sửa trong ChatGPT prompt:
```javascript
"voiceGender": "male",      // male hoặc female
"voiceTone": "dramatic",    // calm/dramatic/energetic
```

### Thay đổi tốc độ đọc
```javascript
const WORDS_PER_SEGMENT = 60; // Tăng lên = đọc nhanh hơn
```

## ⚠️ Lưu ý quan trọng

### 1. Voice-over của Veo3
- Veo3 **TỰ TẠO giọng nói** dựa trên prompt
- **KHÔNG cần** tạo TTS riêng
- Chất lượng giọng nói phụ thuộc vào prompt

### 2. Giới hạn API
- Veo3 có rate limit (429 error)
- Script có retry mechanism (10 lần)
- Exponential backoff: 4s, 8s, 16s, 32s, ...

### 3. Thời gian xử lý
- Mỗi segment: ~30-60 giây (Veo3 processing)
- 120 segments: ~1-2 giờ
- Chạy song song để tăng tốc

## 🔧 Troubleshooting

### Lỗi 429 (Too Many Requests)
```
⚠️ Segment 110 thất bại lần 1/10: Labs API error: 429
```
**Giải pháp**: Script tự động retry với exponential backoff

### Voice-over không khớp với visual
**Nguyên nhân**: ChatGPT tạo prompt không tốt
**Giải pháp**: Cải thiện system prompt trong Step 3

### Video không có tiếng
**Nguyên nhân**: Veo3 không hiểu prompt voice-over
**Giải pháp**: Kiểm tra format prompt:
```javascript
[Voice-over in Vietnamese: "text here"]
```

## 📊 So sánh 2 phiên bản

| Tính năng | Phiên bản cũ | Phiên bản mới |
|-----------|--------------|---------------|
| Chia video theo | Thời lượng video | Nội dung transcript |
| Voice-over | ❌ Không có | ✅ Có sẵn (Veo3) |
| Ghép audio | ❌ Cần ghép riêng | ✅ Không cần |
| Độ chính xác | Trung bình | Cao (theo transcript) |
| Thời gian xử lý | Nhanh hơn | Chậm hơn (do voice-over) |

## 🎯 Khi nào dùng phiên bản nào?

### Dùng phiên bản CŨ khi:
- Chỉ cần video visual, không cần voice-over
- Muốn xử lý nhanh
- Tự ghép audio sau

### Dùng phiên bản MỚI khi:
- Cần video hoàn chỉnh với voice-over
- Muốn voice-over khớp chính xác với transcript
- Không muốn ghép audio thủ công

## 📝 TODO

- [ ] Thêm tùy chọn giọng nói (nam/nữ, giọng điệu)
- [ ] Hỗ trợ nhiều ngôn ngữ
- [ ] Tối ưu parallel processing
- [ ] Thêm preview trước khi tạo video
- [ ] Hỗ trợ custom background music

## 🤝 Đóng góp

Nếu bạn có ý tưởng cải thiện, hãy tạo issue hoặc pull request!

