# 🎓 FAP GPA Calculator - Tiện ích tính điểm GPA FPT University

Extension dành cho trình duyệt Chrome / Edge / Brave / Cốc Cốc, tự động tính toán điểm trung bình tích lũy (GPA), tín chỉ và dự đoán điểm tốt nghiệp trực tiếp trên trang **Báo cáo bảng điểm transcript** của hệ thống FAP (`https://fap.fpt.edu.vn/Report/Transcript`).

---

## ✨ Tính năng nổi bật

1. **Tự động tính GPA Tích lũy (Hệ 10 & Hệ 4)**:
   - Hiển thị ngay trên đầu trang bảng điểm FAP mà không cần nhập thủ công.
   - Hỗ trợ công thức tính điểm chuẩn của trường Đại học FPT:
     $$\text{GPA} = \frac{\sum (\text{Điểm} \times \text{Tín chỉ})}{\sum \text{Tín chỉ}}$$

2. **Theo dõi Tín chỉ & Xếp loại tốt nghiệp**:
   - Thống kê tổng số tín chỉ đã tích lũy (bao gồm các môn Passed không có điểm số như `LAB211`).
   - Xếp loại học lực hiện tại (Xuất sắc, Giỏi, Khá, Trung bình).

3. **Bộ lọc thông minh theo quy chế FPT**:
   - ✅ **Bỏ qua môn Thể chất (VOV)**: Mặc định bật theo quy chế đào tạo (môn điều kiện, không tính GPA).
   - ✅ **Tùy chọn môn OJT (10 tín chỉ)**: Cho phép bật/tắt để xem GPA khi có và không có điểm thực tập OJT.
   - ✅ **Môn ngoài khung CTĐT**: Tùy chọn tính hoặc bỏ qua các môn ngoài chương trình.
   - ✅ **Bật/tắt từng môn riêng lẻ**: Kiểm tra tác động của từng môn học tới điểm tổng.

4. **📅 Thống kê chi tiết từng Học kỳ (Semester Breakdown)**:
   - Xem điểm GPA riêng của từng kỳ (Fall 2023, Spring 2024, Summer 2024, Fall 2024...).
   - Xem tiến độ GPA lũy kế qua từng kỳ.

5. **🔮 Công cụ Dự đoán điểm tốt nghiệp (GPA Simulator)**:
   - Tự động nhận diện các môn **Đang học** và các môn **Chưa học** ở các kỳ tiếp theo.
   - Cho phép nhập thử điểm dự kiến (hoặc gán nhanh mục tiêu 8.0, 8.5, 9.0) để biết chính xác GPA khi tốt nghiệp sẽ là bao nhiêu.

6. **🚀 Nút nổi tiện lợi (Floating Pill) & Popup**:
   - Khi cuộn trang xem bảng điểm dài, nút nổi góc dưới màn hình luôn hiển thị GPA và số tín chỉ đạt.
   - Popup extension hỗ trợ xem nhanh và nút sao chép tóm tắt kết quả.

---

## 🛠️ Hướng dẫn cài đặt vào trình duyệt (Chrome / Edge / Cốc Cốc)

1. **Mở trang quản lý tiện ích**:
   - Trên **Google Chrome / Brave / Cốc Cốc**: Nhập `chrome://extensions` vào thanh địa chỉ rồi nhấn Enter.
   - Trên **Microsoft Edge**: Nhập `edge://extensions` vào thanh địa chỉ rồi nhấn Enter.

2. **Bật Chế độ dành cho nhà phát triển (Developer mode)**:
   - Bật công tắc **"Chế độ dành cho nhà phát triển"** (hoặc *Developer mode*) ở góc trên bên phải màn hình.

3. **Tải tiện ích đã giải nén**:
   - Nhấn nút **"Tải tiện ích đã giải nén"** (hoặc *Load unpacked*).
   - Chọn thư mục:
     ```
     e:\ProjectE\NewProject\ExtensionGPA
     ```
   - Nhấn **Select Folder** (Chọn thư mục).

4. **Sử dụng**:
   - Truy cập vào trang bảng điểm FAP: [https://fap.fpt.edu.vn/Report/Transcript](https://fap.fpt.edu.vn/Report/Transcript)
   - Bảng Dashboard GPA sẽ tự động xuất hiện ngay phía trên danh sách môn học!

---

## 📁 Cấu trúc thư mục tiện ích

```
ExtensionGPA/
├── manifest.json       # Cấu hình Chrome Extension Manifest V3
├── content.js          # Logic trích xuất dữ liệu bảng điểm, tính GPA & giao diện Dashboard
├── content.css         # Giao diện hiện đại đồng bộ với giao diện FAP (hỗ trợ Light/Dark mode)
├── popup.html          # Giao diện popup khi nhấp vào icon extension trên toolbar
├── popup.js            # Xử lý sự kiện và kết nối dữ liệu cho popup
├── popup.css           # Định kiểu cho popup
├── test_preview.html   # File HTML mẫu để kiểm tra giao diện và tính toán trực tiếp
├── icons/              # Bộ biểu tượng (16x16, 48x48, 128x128)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # Hướng dẫn sử dụng
```
