# 🧪 Hướng dẫn sử dụng hệ thống Labs Profile riêng biệt

## 🎯 Tổng quan

Hệ thống đã được nâng cấp với **Labs Profile riêng biệt** - Chrome riêng chỉ cho Google Labs, tự động lấy cookies từ tab Labs.

## ✨ Tính năng mới

### **🔧 Labs Profile Management (Riêng biệt)**
- 🚀 **Chrome riêng biệt** chỉ cho Google Labs
- 🍪 **Tự động lấy cookies** từ tab Labs
- 🧪 **Test cookies** với Google Labs API
- 🔒 **Quản lý browser** mở/đóng
- ℹ️ **Thông tin profile** chi tiết

## 🚀 Cách sử dụng

### **Bước 1: Mở Chrome Labs**
```bash
POST /api/open-labs-browser
{}
```
- Mở Chrome riêng biệt chỉ cho Google Labs
- Tự động điều hướng đến `https://labs.google`
- Profile được lưu tại: `chrome-profile/GoogleLabs`

### **Bước 2: Đăng nhập Google Labs**
- Đăng nhập thủ công vào Google Labs trong Chrome đã mở
- Chỉ cần làm 1 lần, sau đó cookies sẽ được lưu tự động

### **Bước 3: Lấy cookies từ Labs**
```bash
POST /api/extract-labs-cookies
{}
```
- Tự động lấy cookies từ tab Google Labs
- Lọc cookies liên quan đến Labs
- Tự động lưu vào `cookies.json` và `server-storage.json`

### **Bước 4: Test cookies (Tùy chọn)**
```bash
POST /api/test-labs-cookies
{
    "cookies": "cookie_string_here"
}
```
- Test cookies với Google Labs API
- Kiểm tra cookies có hoạt động không

### **Bước 5: Đóng Chrome Labs**
```bash
POST /api/close-labs-browser
{}
```
- Đóng Chrome Labs khi không cần thiết

## 🎮 Sử dụng qua Web Interface

### **1. Mở Chrome Labs**
- Click nút **🚀 Mở Chrome Labs**
- Chrome sẽ mở riêng biệt cho Google Labs
- Đăng nhập Google Labs trong tab đó

### **2. Lấy Cookies**
- Click nút **🍪 Lấy Cookies Labs**
- Hệ thống tự động lấy cookies từ tab Labs
- Cookies được lưu tự động

### **3. Test Cookies**
- Click nút **🧪 Test Cookies**
- Nhập cookies để test (hoặc dùng cookies hiện tại)
- Kiểm tra cookies có hoạt động

### **4. Quản lý Browser**
- Click **ℹ️ Thông tin Profile** để xem thông tin
- Click **🔒 Đóng Chrome Labs** khi xong

## 📊 API Endpoints mới

### **1. Mở Chrome Labs**
```http
POST /api/open-labs-browser
Content-Type: application/json

{}
```

**Response:**
```json
{
    "success": true,
    "message": "Labs browser opened successfully",
    "profileInfo": {
        "profileName": "GoogleLabs",
        "profilePath": "C:\\Users\\PC\\Documents\\web\\chrome-profile\\GoogleLabs",
        "isOpen": true,
        "exists": true
    }
}
```

### **2. Lấy cookies từ Labs**
```http
POST /api/extract-labs-cookies
Content-Type: application/json

{}
```

**Response:**
```json
{
    "success": true,
    "message": "Labs cookies extracted successfully",
    "cookies": "_ga_X2GNH8R5NS=GS2.1.s1760794425$o1$g0$t1760794428$j57$l0$h872556258;...",
    "cookieCount": 8,
    "isLoggedIn": true,
    "profileName": "GoogleLabs"
}
```

### **3. Test cookies**
```http
POST /api/test-labs-cookies
Content-Type: application/json

{
    "cookies": "cookie_string_here"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Labs cookies are valid",
    "status": 200,
    "sessionData": {...}
}
```

### **4. Đóng Chrome Labs**
```http
POST /api/close-labs-browser
Content-Type: application/json

{}
```

**Response:**
```json
{
    "success": true,
    "message": "Labs browser closed successfully"
}
```

### **5. Thông tin profile**
```http
GET /api/labs-profile-info
```

**Response:**
```json
{
    "success": true,
    "profileInfo": {
        "profileName": "GoogleLabs",
        "profilePath": "C:\\Users\\PC\\Documents\\web\\chrome-profile\\GoogleLabs",
        "isOpen": false,
        "exists": true
    }
}
```

## 🔄 Workflow hoàn chỉnh

### **Tự động hóa hoàn toàn:**

1. **Mở Chrome Labs** → `POST /api/open-labs-browser`
2. **Đăng nhập thủ công** → Đăng nhập Google Labs trong Chrome
3. **Lấy cookies tự động** → `POST /api/extract-labs-cookies`
4. **Test cookies** → `POST /api/test-labs-cookies` (tùy chọn)
5. **Tạo video** → Sử dụng cookies đã lấy
6. **Đóng Chrome Labs** → `POST /api/close-labs-browser`

### **Script tự động:**

```bash
# 1. Mở Chrome Labs
curl -X POST http://localhost:8888/api/open-labs-browser \
  -H "Content-Type: application/json" \
  -d '{}'

# 2. Đăng nhập thủ công trong Chrome đã mở

# 3. Lấy cookies tự động
curl -X POST http://localhost:8888/api/extract-labs-cookies \
  -H "Content-Type: application/json" \
  -d '{}'

# 4. Test cookies
curl -X POST http://localhost:8888/api/test-labs-cookies \
  -H "Content-Type: application/json" \
  -d '{"cookies": "cookie_string_here"}'

# 5. Đóng Chrome Labs
curl -X POST http://localhost:8888/api/close-labs-browser \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 🎯 Ưu điểm của hệ thống mới

### **So với hệ thống cũ:**
- ❌ **Cũ:** Chrome chung cho tất cả
- ✅ **Mới:** Chrome riêng biệt cho Labs

- ❌ **Cũ:** Lấy cookies từ tất cả profiles
- ✅ **Mới:** Chỉ lấy cookies từ tab Labs

- ❌ **Cũ:** Có thể bị conflict với YouTube
- ✅ **Mới:** Hoàn toàn tách biệt

- ❌ **Cũ:** Khó quản lý
- ✅ **Mới:** Quản lý dễ dàng qua web interface

### **Tính năng mới:**
- 🚀 **Chrome riêng biệt** - Không ảnh hưởng đến Chrome chính
- 🍪 **Cookies chính xác** - Chỉ lấy cookies từ tab Labs
- 🧪 **Test real-time** - Kiểm tra cookies ngay lập tức
- 🔒 **Quản lý browser** - Mở/đóng dễ dàng
- ℹ️ **Thông tin chi tiết** - Theo dõi trạng thái profile
- 🎨 **UI đẹp** - Giao diện trực quan, dễ sử dụng

## ⚠️ Lưu ý quan trọng

1. **Chrome Labs phải được mở** trước khi lấy cookies
2. **Đăng nhập Google Labs** trong Chrome đã mở
3. **Chỉ lấy cookies từ tab Labs** - không lấy từ tab khác
4. **Đóng Chrome Labs** khi không cần thiết để tiết kiệm tài nguyên
5. **Cookies sẽ tự động hết hạn** - cần lấy lại định kỳ

## 🎉 Kết luận

**Hệ thống Labs Profile riêng biệt đã sẵn sàng sử dụng!**

- ✅ **Chrome riêng biệt** cho Google Labs
- ✅ **Tự động lấy cookies** từ tab Labs
- ✅ **Web interface** dễ sử dụng
- ✅ **API endpoints** hoàn chỉnh
- ✅ **Quản lý browser** thông minh

**Chỉ cần đăng nhập 1 lần, sau đó hệ thống sẽ tự động lấy cookies và tạo video!**
