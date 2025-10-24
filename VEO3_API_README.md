# Veo3 Unified API Documentation

## Tổng quan

Hệ thống Veo3 Unified API đã được chuẩn hóa và tối ưu hóa để xử lý video một cách liền mạch. API bao gồm 3 module chính:

1. **Video Splitter** - Tách video thành các đoạn 8s
2. **Frame Analyzer** - Phân tích frames và tạo prompt JSON
3. **Unified Workflow** - Workflow thống nhất

## API Endpoints

### 1. Split Video API
```
POST /api/split-video
```

**Mô tả**: Tách video thành các đoạn 8 giây

**Request Body**:
```json
{
    "videoPath": "./test.mp4",
    "outputDir": "./temp/segments",
    "maxSegments": 200
}
```

**Response**:
```json
{
    "success": true,
    "message": "Đã tách video thành X segments",
    "result": {
        "videoInfo": {
            "duration": 120,
            "width": 1920,
            "height": 1080,
            "fps": 30
        },
        "segments": [
            {
                "index": 0,
                "startTime": 0,
                "endTime": 8,
                "duration": 8,
                "filename": "segment_000_0s-8s.mp4",
                "path": "./temp/segments/segment_000_0s-8s.mp4"
            }
        ]
    }
}
```

### 2. Analyze Frames API
```
POST /api/analyze-frames
```

**Mô tả**: Phân tích frames với ChatGPT Vision

**Request Body**:
```json
{
    "videoPath": "./temp/segments/segment_000_0s-8s.mp4",
    "outputDir": "./temp/frames",
    "frameInterval": 1,
    "maxFrames": 8
}
```

**Response**:
```json
{
    "success": true,
    "message": "Đã phân tích X frames",
    "result": {
        "frames": [...],
        "detailedAnalysis": [...],
        "outputDir": "./temp/frames"
    }
}
```

### 3. Generate Veo3 JSON API
```
POST /api/generate-veo3-json
```

**Mô tả**: Tạo JSON format cho Veo3

**Request Body**:
```json
{
    "detailedAnalysis": [...],
    "videoInfo": {
        "duration": 8,
        "width": 1920,
        "height": 1080,
        "fps": 30
    }
}
```

**Response**:
```json
{
    "success": true,
    "message": "Đã tạo JSON format cho Veo3",
    "result": {
        "timeline": [
            {
                "timeStart": 0,
                "timeEnd": 2,
                "action": "mô tả hành động chi tiết",
                "cameraStyle": "góc máy quay cụ thể",
                "soundFocus": "mô tả âm thanh",
                "visualDetails": "chi tiết visual"
            }
        ]
    }
}
```

### 4. Veo3 Unified Workflow API
```
POST /api/veo3-unified-workflow
```

**Mô tả**: Workflow thống nhất cho video dài

**Request Body**:
```json
{
    "videoPath": "./test.mp4",
    "maxSegments": 200,
    "segmentDuration": 8,
    "frameInterval": 1,
    "maxFrames": 8,
    "outputDir": "./temp/veo3-workflow"
}
```

**Response**:
```json
{
    "success": true,
    "message": "Đã hoàn thành workflow thống nhất cho X segments",
    "result": {
        "summary": {
            "totalSegments": 15,
            "analyzedSegments": 15,
            "videoInfo": {...},
            "outputDir": "./temp/veo3-workflow"
        },
        "segments": [...],
        "resultPath": "./temp/veo3-workflow/veo3-workflow-result.json"
    }
}
```

### 5. Veo3 Simple Workflow API
```
POST /api/veo3-simple-workflow
```

**Mô tả**: Workflow đơn giản cho video 8s

**Request Body**:
```json
{
    "videoPath": "./test.mp4",
    "startSecond": 0,
    "duration": 8,
    "frameInterval": 1,
    "maxFrames": 8,
    "outputDir": "./temp/veo3-simple"
}
```

**Response**:
```json
{
    "success": true,
    "message": "Đã hoàn thành workflow đơn giản cho video 8s",
    "result": {
        "segment": {...},
        "frames": [...],
        "detailedAnalysis": [...],
        "veo3JSON": [...],
        "resultPath": "./temp/veo3-simple/veo3-simple-result.json"
    }
}
```

## Cách sử dụng

### 1. Test API
```bash
node test-veo3-unified.js
```

### 2. Sử dụng trong code
```javascript
const fetch = require('node-fetch');

// Test simple workflow
const response = await fetch('http://localhost:8888/api/veo3-simple-workflow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        videoPath: './test.mp4',
        startSecond: 0,
        duration: 8
    })
});

const result = await response.json();
console.log(result);
```

## Cấu trúc thư mục

```
api/video/
├── veo3-video-splitter.js      # Tách video thành 8s
├── veo3-frame-analyzer.js       # Phân tích frames
├── veo3-unified-workflow.js    # Workflow thống nhất
└── veo3-generator.js           # Tạo video Veo3 (giữ nguyên)
```

## Lưu ý

1. **ChatGPT API Key**: Cần cấu hình `OPENAI_API_KEY` trong environment
2. **FFmpeg**: Cần cài đặt FFmpeg để xử lý video
3. **Thư mục temp**: Tự động tạo thư mục `./temp/` để lưu kết quả
4. **File kết quả**: Tất cả kết quả được lưu vào file JSON để dễ dàng truy cập

## Troubleshooting

- **Lỗi ChatGPT**: Kiểm tra API key và kết nối internet
- **Lỗi FFmpeg**: Đảm bảo FFmpeg đã được cài đặt
- **Lỗi phân tích**: Kiểm tra file video có tồn tại và định dạng đúng
