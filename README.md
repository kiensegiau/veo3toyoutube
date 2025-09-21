# 🍪 Hệ thống tự động làm mới token - Tối ưu

## 🎯 Mục tiêu
Tạo hệ thống tự động làm mới token và cập nhật file `cookies.json` để tránh file "chết" (hết hạn).

## 🚀 Cách sử dụng

### **Bước 1: Lấy cookies 1 lần từ trình duyệt**
1. Vào Google Labs: https://labs.google/fx/tools/flow
2. Mở Developer Tools (F12)
3. Vào tab Application → Cookies
4. Copy tất cả cookies từ `labs.google`
5. Paste vào file `cookies.json`

### **Bước 2: Chạy hệ thống tự động**
```bash
node manager.js
```
Chọn tùy chọn 1 để chạy hệ thống tự động

### **Bước 3: Hệ thống tự động hoạt động**
- ✅ Kiểm tra token mỗi 30 phút
- ✅ Tự động làm mới khi token sắp hết hạn (dưới 15 phút)
- ✅ Cập nhật file `cookies.json` với cookies mới
- ✅ Tránh file cookies.json bị "chết"

## 📁 Files tối ưu

```
web/
├── cookies.json              # File cookies từ Google Labs (chỉ cần lấy 1 lần)
├── server-storage.json       # File lưu trữ cookies và token
├── server.js                 # Server chính
├── auto-refresh.js           # Hệ thống tự động làm mới token
├── manager.js                # Quản lý hệ thống chính
├── watch-cookies.js          # Theo dõi file tự động
├── package.json              # Dependencies
└── public/
    └── index.html            # Frontend
```

## 🔄 Workflow hoàn chỉnh

### **1. Khởi tạo (chỉ làm 1 lần)**
```bash
# Lấy cookies từ trình duyệt → Save vào cookies.json
# Chạy hệ thống quản lý
node manager.js
# Chọn tùy chọn 1
```

### **2. Hệ thống tự động hoạt động**
- **Kiểm tra định kỳ**: Mỗi 30 phút
- **Tự động làm mới**: Khi token còn dưới 15 phút
- **Cập nhật file**: `cookies.json` được cập nhật với cookies mới
- **Tránh hết hạn**: File không bao giờ "chết"

### **3. Kết quả**
- ✅ **File cookies.json luôn "sống"**: Được cập nhật tự động
- ✅ **Token không bao giờ hết hạn**: Tự động làm mới
- ✅ **Không cần can thiệp**: Hệ thống hoạt động hoàn toàn tự động
- ✅ **Chỉ cần lấy cookies 1 lần**: Từ trình duyệt

## 🎯 Tính năng chính

### ✅ **Tự động hoàn toàn**
- Kiểm tra token mỗi 30 phút
- Làm mới token khi sắp hết hạn
- Cập nhật file `cookies.json` tự động
- Không cần can thiệp thủ công

### ✅ **Tránh file chết**
- File `cookies.json` luôn được cập nhật
- Cookies mới được thêm vào file
- Expiration date được cập nhật
- File không bao giờ hết hạn

### ✅ **Quản lý dễ dàng**
- Menu tương tác
- Kiểm tra trạng thái
- Khởi động/dừng server
- Quản lý processes

## 🔧 Cấu hình

### **Thời gian kiểm tra**
- **Interval**: 30 phút
- **Buffer**: 15 phút trước khi hết hạn
- **Expiry**: 24 giờ cho cookies mới

### **Files được cập nhật**
- `server-storage.json`: Cookies và token hiện tại
- `cookies.json`: File gốc với cookies mới

## 🚨 Lưu ý quan trọng

1. **Chỉ cần lấy cookies 1 lần**: Từ trình duyệt Google Labs
2. **Hệ thống tự động**: Không cần can thiệp thủ công
3. **File không bao giờ chết**: Được cập nhật liên tục
4. **Token luôn hoạt động**: Tự động làm mới

## 🎉 Kết quả

- **✅ File cookies.json luôn "sống"**
- **✅ Token không bao giờ hết hạn**
- **✅ Hệ thống hoạt động 24/7**
- **✅ Chỉ cần setup 1 lần**
- **✅ Hoàn toàn tự động**
- **✅ Tối ưu và gọn nhẹ**

**Hệ thống đã hoàn hảo và tối ưu! File cookies.json sẽ không bao giờ "chết"!** 🚀
