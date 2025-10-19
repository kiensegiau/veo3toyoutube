# YouTube Transcript API Documentation

API này sử dụng Supadata để lấy lời thoại (transcript) từ video YouTube.

## Cài đặt

1. Cài đặt package Supadata:
```bash
npm install @supadata/js
```

2. API key đã được cấu hình sẵn:
```javascript
// API key đã được thiết lập trong code: sd_82fd27e22d9c5a72b3bda8b9aa61de34
// Hoặc có thể override bằng environment variable:
// SUPADATA_API_KEY=your_custom_key
```

## API Endpoints

### 1. Lấy lời thoại video YouTube
**POST** `/api/get-transcript`

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "lang": "en",
  "text": true,
  "mode": "auto"
}
```

**Parameters:**
- `url` (required): URL video YouTube
- `lang` (optional): Ngôn ngữ transcript (default: "en")
- `text` (optional): Trả về text thuần (default: true)
- `mode` (optional): Chế độ xử lý - "native", "auto", "generate" (default: "auto")

**Response:**
```json
{
  "success": true,
  "message": "Transcript retrieved successfully",
  "transcript": "transcript content here...",
  "status": "completed"
}
```

### 2. Kiểm tra trạng thái job transcript
**POST** `/api/check-transcript-job`

**Request Body:**
```json
{
  "jobId": "job_id_from_previous_request"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transcript job completed",
  "status": "completed",
  "transcript": "transcript content here..."
}
```

### 3. Lấy metadata video YouTube
**POST** `/api/get-video-metadata`

**Request Body:**
```json
{
  "videoId": "dQw4w9WgXcQ"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video metadata retrieved successfully",
  "video": {
    "id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "description": "...",
    "duration": 212,
    "viewCount": 1234567890,
    "likeCount": 12345678,
    "channel": {
      "id": "UCuAXFkgsw1L7xaCfnd5JJOw",
      "title": "Rick Astley"
    }
  }
}
```

### 4. Dịch lời thoại video
**POST** `/api/translate-transcript`

**Request Body:**
```json
{
  "videoId": "dQw4w9WgXcQ",
  "lang": "es"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transcript translated successfully",
  "transcript": "transcript translated to Spanish...",
  "language": "es"
}
```

## Cách sử dụng

### 1. Lấy lời thoại đơn giản
```javascript
const response = await fetch('http://localhost:8888/api/get-transcript', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  })
});

const result = await response.json();
console.log(result.transcript);
```

### 2. Xử lý file lớn (async)
```javascript
// Bước 1: Bắt đầu job
const response = await fetch('http://localhost:8888/api/get-transcript', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://www.youtube.com/watch?v=very_long_video'
  })
});

const result = await response.json();

if (result.jobId) {
  // Bước 2: Kiểm tra trạng thái job
  const jobResponse = await fetch('http://localhost:8888/api/check-transcript-job', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jobId: result.jobId
    })
  });

  const jobResult = await jobResponse.json();
  console.log(jobResult.transcript);
}
```

### 3. Dịch lời thoại
```javascript
const response = await fetch('http://localhost:8888/api/translate-transcript', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    videoId: 'dQw4w9WgXcQ',
    lang: 'vi' // Tiếng Việt
  })
});

const result = await response.json();
console.log(result.transcript);
```

## Lỗi thường gặp

### 1. Missing API Key
```
Error: Missing Supadata API key
```
**Giải pháp:** Thiết lập `SUPADATA_API_KEY` environment variable

### 2. Invalid YouTube URL
```
Error: Invalid YouTube URL format
```
**Giải pháp:** Sử dụng URL YouTube hợp lệ (youtube.com/watch?v= hoặc youtu.be/)

### 3. Video not found
```
Error: video-not-found
```
**Giải pháp:** Kiểm tra video ID hoặc URL có đúng không

## Test API

Chạy script test:
```bash
node test-transcript-api.js
```

## Lưu ý

- API key Supadata cần được thiết lập trong environment variable
- Video phải có transcript sẵn có hoặc có thể generate được
- File lớn sẽ được xử lý async với job ID
- Hỗ trợ nhiều ngôn ngữ cho translation
