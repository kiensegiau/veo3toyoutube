# Puppeteer Request Logger

Một script Node.js sử dụng Puppeteer để lưu tất cả requests của Chrome browser với khả năng chống phát hiện bot và lưu session.

## Tính năng

- ✅ Intercept tất cả HTTP requests và responses
- ✅ Lưu thông tin chi tiết về mỗi request (URL, method, headers, post data, etc.)
- ✅ Tự động lưu requests theo định kỳ
- ✅ Hỗ trợ lưu requests failed
- ✅ **🥷 Stealth Mode**: Tránh phát hiện bot với random user agents, viewports
- ✅ **🍪 Session Management**: Lưu và load cookies để tránh login lại
- ✅ **⏱️ Random Delays**: Thêm delay ngẫu nhiên giữa các actions
- ✅ **🔒 User Data Persistence**: Lưu Chrome user data để duy trì session
- ✅ Tự động tìm đường dẫn Chrome trên Windows
- ✅ Giao diện console thân thiện với emoji

## Cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

2. Đảm bảo bạn đã cài đặt Google Chrome trên máy tính.

## Sử dụng

### Cách 1: Chạy với URL mặc định (Google)
```bash
npm start
```

### Cách 2: Chạy với URL tùy chỉnh
```bash
node index.js https://example.com
```

### Cách 3: Chạy demo với stealth mode
```bash
node example.js
```

### Cách 4: Sử dụng trong code khác
```javascript
const RequestLogger = require('./index.js');

// Cấu hình với stealth mode và session
const options = {
    stealthMode: true,           // Bật chế độ tránh phát hiện bot
    cookiesFile: 'cookies.json', // File lưu cookies
    userDataDir: './chrome-data' // Thư mục lưu Chrome user data
};

const logger = new RequestLogger(options);
await logger.init();
await logger.navigateToUrl('https://example.com');
// ... làm việc với trang web
await logger.saveRequestsToFile('my-requests.json');
await logger.close();
```

### Cách 5: Tắt stealth mode (nếu cần)
```javascript
const options = {
    stealthMode: false, // Tắt chế độ stealth
    cookiesFile: 'cookies.json',
    userDataDir: './chrome-data'
};
```

## Cấu trúc dữ liệu được lưu

File `requests.json` sẽ chứa:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "totalRequests": 150,
  "requests": [
    {
      "id": "request-1",
      "url": "https://example.com",
      "method": "GET",
      "headers": {...},
      "postData": null,
      "resourceType": "document",
      "timestamp": "2024-01-01T12:00:01.000Z",
      "type": "request"
    },
    {
      "id": "request-1", 
      "url": "https://example.com",
      "status": 200,
      "statusText": "OK",
      "headers": {...},
      "timestamp": "2024-01-01T12:00:01.500Z",
      "type": "response"
    }
  ]
}
```

## Các loại request được lưu

- **request**: Request được gửi đi
- **response**: Response trả về
- **failed**: Request bị lỗi

## 🥷 Stealth Mode

Stealth mode giúp tránh phát hiện bot bằng cách:

- **Random User Agents**: Tự động chọn user agent ngẫu nhiên từ danh sách
- **Random Viewports**: Thay đổi kích thước màn hình ngẫu nhiên
- **Ẩn Automation Properties**: Xóa các dấu hiệu automation như `navigator.webdriver`
- **Override Plugins**: Giả lập plugins thông thường
- **Random Delays**: Thêm delay ngẫu nhiên giữa các actions
- **Realistic Headers**: Sử dụng headers giống browser thật

## 🍪 Session Management

Script tự động lưu và khôi phục session:

- **Cookies**: Lưu tất cả cookies vào file JSON
- **User Data**: Lưu Chrome user data để duy trì session
- **Auto Save**: Tự động lưu cookies sau mỗi navigation
- **Auto Load**: Tự động load cookies khi khởi động

### Cấu trúc file cookies:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "cookies": [
    {
      "name": "session_id",
      "value": "abc123",
      "domain": ".example.com",
      "path": "/",
      "expires": 1640995200,
      "httpOnly": true,
      "secure": true
    }
  ]
}
```

## Tùy chỉnh

### Thay đổi tần suất tự động lưu
```javascript
logger.startAutoSave(5000); // Lưu mỗi 5 giây
```

### Thay đổi tên file output
```javascript
await logger.saveRequestsToFile('custom-requests.json');
```

### Chạy ở chế độ headless
Sửa trong file `index.js`:
```javascript
this.browser = await puppeteer.launch({
    headless: true, // Thay đổi từ false thành true
    // ... các options khác
});
```

## Xử lý lỗi

- Nếu không tìm thấy Chrome, script sẽ báo lỗi và hướng dẫn cài đặt
- Nếu trang web không tải được, script sẽ tiếp tục chạy và lưu các requests khác
- Tất cả lỗi sẽ được log ra console

## Yêu cầu hệ thống

- Node.js 14+
- Google Chrome
- Windows (script được tối ưu cho Windows)

## Troubleshooting

### Lỗi "Không tìm thấy Chrome"
- Đảm bảo Google Chrome đã được cài đặt
- Hoặc sửa đường dẫn Chrome trong hàm `getChromePath()`

### Lỗi "Request timeout"
- Tăng timeout trong `page.goto()` nếu trang web tải chậm
- Kiểm tra kết nối internet

### Lỗi "Permission denied" khi lưu file
- Chạy terminal với quyền Administrator
- Hoặc chọn thư mục khác để lưu file

### Lỗi "Stealth mode không hoạt động"
- Kiểm tra xem `stealthMode: true` đã được set
- Một số trang web có thể vẫn phát hiện được bot
- Thử thay đổi user agent hoặc viewport

### Lỗi "Cookies không được lưu"
- Kiểm tra quyền ghi file trong thư mục hiện tại
- Đảm bảo `cookiesFile` path hợp lệ
- Kiểm tra Chrome có cho phép lưu cookies không

### Lỗi "Session không được khôi phục"
- Kiểm tra file cookies có tồn tại và đúng format không
- Xóa thư mục `userDataDir` và chạy lại để tạo mới
- Đảm bảo cookies chưa hết hạn

### Trang web vẫn yêu cầu login
- Kiểm tra cookies có được lưu đúng domain không
- Thử login thủ công một lần để lưu session
- Kiểm tra trang web có sử dụng các phương thức xác thực khác không

## License

MIT
