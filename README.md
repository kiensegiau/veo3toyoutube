# 🎬 AI Video Generator v2.0

**Google Labs Veo 3.1 với Tự động Cookie Management**

## ✨ Tính năng chính

- 🚀 **Tạo video AI** với Google Labs Veo 3.1
- 🍪 **Tự động quản lý cookies** - Không cần can thiệp thủ công
- 🔄 **Auto restart** khi có thay đổi code
- 📱 **Giao diện web** thân thiện
- 🎯 **Veo 3.1 model** - Chất lượng cao nhất

## 🚀 Khởi động nhanh

### Cách 1: Sử dụng file batch (Khuyến nghị)
```bash
# Double-click file start-server.bat
# Hoặc chạy trong terminal:
start-server.bat
```

### Cách 2: Sử dụng npm
```bash
# Cài đặt dependencies
npm install

# Khởi động server
npm start

# Hoặc development mode (auto restart)
npm run dev
```

## 🌐 Truy cập

- **Web Interface**: http://localhost:8888
- **API Documentation**: Xem trong giao diện web

## 🎯 Cách sử dụng

1. **Mở Chrome Labs**: Nhấn "🚀 Mở Chrome Labs"
2. **Đăng nhập Google**: Đăng nhập tài khoản Google của bạn
3. **Tạo video**: Nhập prompt và nhấn "🎬 Tạo Video"
4. **Tự động**: Hệ thống sẽ tự động lấy cookies và tạo video

## 📁 Cấu trúc project

```
├── server.js                 # Main server
├── labs-profile-manager.js   # Chrome Labs management
├── chrome-profile-manager.js # Chrome profile utilities
├── chrome-profile-utils.js   # Profile helper functions
├── public/
│   ├── index.html           # Web interface
│   └── videos/              # Generated videos
├── chrome-profile/           # Chrome profiles
├── logs/                    # Request logs
└── start-server.bat         # Quick start script
```

## 🔧 API Endpoints

- `POST /api/create-video` - Tạo video từ text
- `POST /api/check-status` - Kiểm tra trạng thái video
- `POST /api/open-labs-browser` - Mở Chrome Labs
- `POST /api/extract-labs-cookies` - Lấy cookies từ Labs
- `GET /api/labs-profile-info` - Thông tin profile

## 🛠️ Yêu cầu hệ thống

- **Node.js** >= 16.0.0
- **Google Chrome** (để automation)
- **Windows** (batch script)

## 📝 Ghi chú

- Cookies được tự động cập nhật mỗi khi tạo video
- Chrome Labs sẽ tự động mở khi cần
- Video được lưu trong `public/videos/`
- Logs được lưu trong `logs/`

## 🎉 Hoàn thành!

Hệ thống đã sẵn sàng tạo video Veo 3.1 hoàn toàn tự động!