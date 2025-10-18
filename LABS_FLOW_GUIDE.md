# 🧪 Hướng dẫn sử dụng Google Labs Flow

## 🎯 Vấn đề đã được giải quyết

Bạn đã gặp lỗi "Requesting main frame too early!" khi lấy cookies. **Vấn đề này đã được sửa!**

## ✅ Giải pháp

### **1. Cập nhật hệ thống:**
- ✅ Sửa lỗi "Requesting main frame too early!"
- ✅ Điều hướng trực tiếp đến [https://labs.google/fx/tools/flow](https://labs.google/fx/tools/flow)
- ✅ Chờ trang load hoàn toàn trước khi lấy cookies
- ✅ Cải thiện logic kiểm tra đăng nhập

### **2. Kết quả test:**
- ✅ **Đã lấy được 8 cookies** từ trang Flow
- ✅ **Bao gồm session token** (`__Secure-next-auth.session-token`)
- ✅ **Cookies hợp lệ** và sẵn sàng sử dụng

## 🚀 Cách sử dụng đúng

### **Bước 1: Mở Chrome Labs**
1. Vào web interface: http://localhost:8888
2. Click nút **🚀 Mở Chrome Labs**
3. Chrome sẽ mở và điều hướng đến [https://labs.google/fx/tools/flow](https://labs.google/fx/tools/flow)

### **Bước 2: Đăng nhập Google Labs**
1. Đăng nhập Google account trong Chrome đã mở
2. Đảm bảo bạn đã truy cập được trang Flow
3. Trang sẽ hiển thị "Flow - A new state of creation"

### **Bước 3: Lấy cookies**
1. Click nút **🍪 Lấy Cookies Labs**
2. Hệ thống sẽ tự động lấy cookies từ tab Flow
3. Cookies sẽ được lưu tự động

### **Bước 4: Test cookies (Tùy chọn)**
1. Click nút **🧪 Test Cookies**
2. Nhập cookies để test hoặc để trống
3. Kiểm tra cookies có hoạt động

## 📊 Kết quả mong đợi

### **Khi thành công:**
```json
{
    "success": true,
    "message": "Labs cookies extracted successfully",
    "cookies": "_ga_X2GNH8R5NS=GS2.1.s1760794425$o1$g1$t1760794947$j60$l0$h872556258;__Host-next-auth.csrf-token=...;__Secure-next-auth.session-token=...",
    "cookieCount": 8,
    "isLoggedIn": true,
    "profileName": "GoogleLabs"
}
```

### **Cookies quan trọng:**
- `__Secure-next-auth.session-token` - Session token chính
- `__Host-next-auth.csrf-token` - CSRF token
- `__Secure-next-auth.callback-url` - Callback URL
- `_ga_*` - Google Analytics cookies

## 🔧 Troubleshooting

### **Nếu vẫn gặp lỗi:**

1. **Đảm bảo đã đăng nhập:**
   - Mở Chrome Labs
   - Đăng nhập Google account
   - Truy cập [https://labs.google/fx/tools/flow](https://labs.google/fx/tools/flow)
   - Đảm bảo thấy trang Flow

2. **Chờ trang load hoàn toàn:**
   - Đợi 5-10 giây sau khi mở Chrome
   - Đảm bảo trang Flow đã load xong
   - Sau đó mới lấy cookies

3. **Kiểm tra trạng thái:**
   - Click **ℹ️ Thông tin Profile** để xem trạng thái
   - Đảm bảo "Browser đang mở: ✅ Có"

### **Nếu cookies không hợp lệ:**

1. **Lấy cookies mới:**
   - Đóng Chrome Labs
   - Mở lại Chrome Labs
   - Đăng nhập lại
   - Lấy cookies mới

2. **Kiểm tra session:**
   - Đảm bảo session chưa hết hạn
   - Đăng nhập lại nếu cần

## 🎉 Kết luận

**Vấn đề "Requesting main frame too early!" đã được sửa hoàn toàn!**

- ✅ Hệ thống điều hướng đúng đến trang Flow
- ✅ Chờ trang load hoàn toàn trước khi lấy cookies
- ✅ Lấy được session token hợp lệ
- ✅ Cookies sẵn sàng để tạo video

**Bây giờ bạn có thể lấy cookies từ trang Flow một cách dễ dàng!**

## 📞 Hỗ trợ

Nếu vẫn gặp vấn đề:
1. Kiểm tra Chrome Labs có mở không
2. Đảm bảo đã đăng nhập Google Labs
3. Truy cập [https://labs.google/fx/tools/flow](https://labs.google/fx/tools/flow)
4. Chờ trang load xong rồi lấy cookies
