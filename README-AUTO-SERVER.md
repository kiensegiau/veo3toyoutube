# 🚀 Hệ thống tự động chạy liên tục trên server

## 🎯 Mục tiêu
Tạo hệ thống tự động khởi động và chạy liên tục trên server, không cần can thiệp thủ công.

## 🚀 Cách sử dụng

### **Cách 1: Chạy trực tiếp (Khuyến nghị)**
```bash
node auto-server.js
```

### **Cách 2: Chạy với batch file**
```bash
start-auto.bat
```

### **Cách 3: Chạy với PowerShell**
```powershell
.\start-auto.ps1
```

## 🔄 Tính năng tự động

### ✅ **Tự động khởi động server**
- Server tự động khởi động khi hệ thống bắt đầu
- Tự động khởi động lại nếu server bị crash
- Không cần can thiệp thủ công

### ✅ **Tự động làm mới token**
- Kiểm tra token mỗi 30 phút
- Tự động làm mới khi token sắp hết hạn (dưới 15 phút)
- Cập nhật file `cookies.json` tự động

### ✅ **Tự động phục hồi**
- Tự động khởi động lại nếu có lỗi
- Xử lý lỗi không bắt được
- Hệ thống chạy liên tục 24/7

## 📁 Files hệ thống

```
web/
├── auto-server.js            # Hệ thống tự động chính
├── start-auto.bat            # Batch file để chạy
├── start-auto.ps1            # PowerShell script
├── cookies.json              # File cookies từ Google Labs
├── server-storage.json       # File lưu trữ cookies và token
├── server.js                 # Server chính
└── README.md                 # Hướng dẫn
```

## 🔄 Workflow hoàn chỉnh

### **1. Setup 1 lần**
```bash
# Lấy cookies từ trình duyệt → Save vào cookies.json
# Chạy hệ thống tự động
node auto-server.js
```

### **2. Hệ thống tự động hoạt động**
- **Khởi động server**: Tự động khởi động server
- **Kiểm tra định kỳ**: Mỗi 30 phút
- **Tự động làm mới**: Khi token còn dưới 15 phút
- **Cập nhật file**: `cookies.json` được cập nhật
- **Tự động phục hồi**: Khởi động lại nếu có lỗi

### **3. Kết quả**
- ✅ **Server luôn chạy**: Tự động khởi động và phục hồi
- ✅ **Token không bao giờ hết hạn**: Tự động làm mới
- ✅ **File cookies.json luôn "sống"**: Được cập nhật tự động
- ✅ **Hệ thống chạy 24/7**: Không cần can thiệp

## 🎯 Tính năng chính

### ✅ **Tự động hoàn toàn**
- Khởi động server tự động
- Làm mới token tự động
- Cập nhật file tự động
- Phục hồi từ lỗi tự động

### ✅ **Chạy liên tục**
- Hệ thống chạy 24/7
- Tự động khởi động lại khi crash
- Xử lý lỗi không bắt được
- Không cần can thiệp thủ công

### ✅ **Quản lý dễ dàng**
- Chỉ cần chạy 1 lệnh
- Hệ thống tự động quản lý
- Log chi tiết
- Dễ dàng debug

## 🔧 Cấu hình

### **Thời gian kiểm tra**
- **Interval**: 30 phút
- **Buffer**: 15 phút trước khi hết hạn
- **Restart delay**: 5 giây khi crash

### **Tự động phục hồi**
- **Server crash**: Tự động khởi động lại sau 5 giây
- **System error**: Tự động khởi động lại sau 10 giây
- **Uncaught exception**: Tiếp tục chạy, không thoát

## 🚨 Lưu ý quan trọng

1. **Chỉ cần chạy 1 lần**: `node auto-server.js`
2. **Hệ thống tự động**: Không cần can thiệp thủ công
3. **Chạy liên tục**: Hệ thống chạy 24/7
4. **Tự động phục hồi**: Khởi động lại khi có lỗi

## 🎉 Kết quả

- **✅ Server luôn chạy**
- **✅ Token không bao giờ hết hạn**
- **✅ File cookies.json luôn "sống"**
- **✅ Hệ thống chạy 24/7**
- **✅ Tự động phục hồi từ lỗi**
- **✅ Hoàn toàn tự động**

**Hệ thống đã hoàn hảo! Chỉ cần chạy 1 lần và hệ thống sẽ tự động chạy liên tục trên server!** 🚀
