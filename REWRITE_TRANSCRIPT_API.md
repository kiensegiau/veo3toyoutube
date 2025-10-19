# Transcript Rewriting API Documentation

API này sử dụng ChatGPT để viết lại nội dung transcript một cách nhẹ nhàng, tránh vi phạm bản quyền bằng cách chỉ thay đổi ít và giữ nguyên ý nghĩa.

## Tính năng chính

- ✅ Viết lại transcript với 3 mức độ khác nhau
- ✅ Giữ nguyên ý nghĩa và cốt truyện
- ✅ Tránh vi phạm bản quyền
- ✅ So sánh nội dung gốc và đã viết lại
- ✅ Lưu file tự động

## API Endpoints

### 1. Viết lại transcript
**POST** `/api/rewrite-transcript`

**Request Body:**
```json
{
  "filename": "transcript_VcROsS0Q3-g_2025-10-19T08-01-14-461Z.txt",
  "openaiApiKey": "sk-your-openai-api-key-here",
  "intensity": "light"
}
```

**Parameters:**
- `filename` (required): Tên file transcript gốc
- `openaiApiKey` (required): OpenAI API key
- `intensity` (optional): Mức độ viết lại - "light", "medium", "heavy" (default: "light")

**Response:**
```json
{
  "success": true,
  "message": "Transcript rewritten successfully",
  "originalFilename": "transcript_VcROsS0Q3-g_2025-10-19T08-01-14-461Z.txt",
  "rewrittenFilename": "transcript_VcROsS0Q3-g_rewritten_light_2025-10-19T08-15-30-123Z.txt",
  "rewrittenPath": "C:\\Users\\PC\\Documents\\web\\transcripts\\transcript_VcROsS0Q3-g_rewritten_light_2025-10-19T08-15-30-123Z.txt",
  "intensity": "light",
  "originalLength": 60234,
  "rewrittenLength": 59876,
  "changes": {
    "original": "Cảm ơn các bạn đã nghe truyện ở Chu Chu Audio...",
    "rewritten": "Xin chào các bạn, cảm ơn đã lắng nghe câu chuyện tại Chu Chu Audio..."
  }
}
```

### 2. So sánh transcript
**POST** `/api/compare-transcripts`

**Request Body:**
```json
{
  "originalFilename": "transcript_VcROsS0Q3-g_2025-10-19T08-01-14-461Z.txt",
  "rewrittenFilename": "transcript_VcROsS0Q3-g_rewritten_light_2025-10-19T08-15-30-123Z.txt"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transcript comparison completed",
  "comparison": {
    "original": {
      "filename": "transcript_VcROsS0Q3-g_2025-10-19T08-01-14-461Z.txt",
      "length": 60234,
      "wordCount": 12543,
      "preview": "Cảm ơn các bạn đã nghe truyện ở Chu Chu Audio..."
    },
    "rewritten": {
      "filename": "transcript_VcROsS0Q3-g_rewritten_light_2025-10-19T08-15-30-123Z.txt",
      "length": 59876,
      "wordCount": 12498,
      "preview": "Xin chào các bạn, cảm ơn đã lắng nghe câu chuyện tại Chu Chu Audio..."
    },
    "metrics": {
      "wordDifference": 45,
      "wordChangePercentage": "0.36%",
      "lengthDifference": 358,
      "similarity": "99.64%"
    }
  }
}
```

## Mức độ viết lại

### 1. Light (Nhẹ) - Khuyến nghị
- **Thay đổi:** Chỉ thay đổi từ ngữ và cấu trúc câu nhẹ
- **Giữ nguyên:** Toàn bộ ý nghĩa, tên nhân vật, sự kiện
- **Mục đích:** Tránh bản quyền với thay đổi tối thiểu
- **Độ tương đồng:** 95-99%

### 2. Medium (Trung bình)
- **Thay đổi:** Thay đổi cấu trúc câu và từ ngữ vừa phải
- **Giữ nguyên:** Cốt truyện, nhân vật, sự kiện chính
- **Mục đích:** Cân bằng giữa tránh bản quyền và giữ nguyên nội dung
- **Độ tương đồng:** 85-95%

### 3. Heavy (Nặng)
- **Thay đổi:** Thay đổi cấu trúc câu và từ ngữ đáng kể
- **Giữ nguyên:** Cốt truyện và sự kiện chính
- **Mục đích:** Tạo ra phiên bản khác biệt nhiều hơn
- **Độ tương đồng:** 70-85%

## Cách sử dụng

### 1. Viết lại transcript nhẹ nhàng
```javascript
const response = await fetch('http://localhost:8888/api/rewrite-transcript', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filename: 'transcript_VcROsS0Q3-g_2025-10-19T08-01-14-461Z.txt',
    openaiApiKey: 'sk-your-openai-api-key-here',
    intensity: 'light'
  })
});

const result = await response.json();
console.log('File mới:', result.rewrittenFilename);
```

### 2. So sánh nội dung
```javascript
const compareResponse = await fetch('http://localhost:8888/api/compare-transcripts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    originalFilename: 'transcript_goc.txt',
    rewrittenFilename: 'transcript_rewritten.txt'
  })
});

const comparison = await compareResponse.json();
console.log('Độ tương đồng:', comparison.comparison.metrics.similarity);
```

### 3. Liệt kê tất cả file
```javascript
const listResponse = await fetch('http://localhost:8888/api/list-transcripts');
const files = await listResponse.json();
console.log('Có', files.count, 'file transcript');
```

## Lưu ý quan trọng

### ⚠️ Về bản quyền
- API này chỉ thay đổi cách diễn đạt, không thay đổi nội dung
- Vẫn giữ nguyên cốt truyện, nhân vật, sự kiện
- Chỉ thay đổi từ ngữ và cấu trúc câu
- **Không đảm bảo 100% tránh vi phạm bản quyền**

### 🔑 OpenAI API Key
- Cần có OpenAI API key hợp lệ
- Sử dụng model GPT-3.5-turbo (rẻ nhất)
- Chi phí khoảng $0.002/1K tokens

### 📁 Quản lý file
- File gốc được giữ nguyên
- File viết lại có tên mới với suffix `_rewritten_{intensity}_{timestamp}`
- Tất cả file lưu trong thư mục `transcripts/`

## Test API

```bash
# Test với mock data (không cần API key)
node test-rewrite-transcript.js

# Test với OpenAI API (cần API key)
# Uncomment dòng testRewriteTranscript() trong file test
```

## Ví dụ thực tế

**Nội dung gốc:**
> "Cảm ơn các bạn đã nghe truyện ở Chu Chu Audio. Chúc các bạn nghe truyện vui vẻ."

**Nội dung viết lại (Light):**
> "Xin chào các bạn, cảm ơn đã lắng nghe câu chuyện tại Chu Chu Audio. Chúc các bạn có những giây phút thú vị khi thưởng thức."

**Thay đổi:**
- "Cảm ơn các bạn đã nghe" → "Xin chào các bạn, cảm ơn đã lắng nghe"
- "truyện" → "câu chuyện"
- "nghe truyện vui vẻ" → "có những giây phút thú vị khi thưởng thức"

**Kết quả:** Giữ nguyên ý nghĩa, thay đổi cách diễn đạt nhẹ nhàng.
