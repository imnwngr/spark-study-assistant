# Spark Study Assistant

Chrome extension (Manifest V3) giúp **đọc bài tập NGL Spark ngay từ trang Dashboard**, gợi ý đáp án và hỗ trợ điền đáp án khi đã xem trước.

**Trạng thái: bản thử nghiệm v0.1.0.** Đã triển khai mã nguồn, kiểm thử bộ giải offline bằng các ca kiểm thử, **chưa kiểm thử end-to-end với một tài khoản Spark đang đăng nhập**. Cấu trúc HTML hoặc hành vi của website có thể khác theo từng bài.

## Cài trên Chrome

1. Giải nén `spark-study-assistant.zip` ra một thư mục cố định.
2. Truy cập `chrome://extensions/` → bật **Developer mode** (Chế độ dành cho nhà phát triển).
3. Chọn **Load unpacked** (Tải tiện ích đã giải nén) → chọn đúng thư mục `spark-study-assistant` chứa `manifest.json`.
4. Mở / tải lại trang `https://learn.eltngl.com/dashboard/assignments/...` và vào một bài tập.
5. Nhấp biểu tượng extension → **Quét trang** → **Giải bài** → kiểm tra đáp án → **Điền đáp án đã chọn**. Hoặc chọn **Giải + điền ngay** để tự động thực hiện cả ba bước trên các loại ô được hỗ trợ (vẫn không tự nộp bài).
6. Tự kiểm tra trên website trước khi nhấn `Check Answers` hoặc nộp bài. Extension **không tự nộp bài**.

Nếu Chrome đang mở Spark từ trước khi cài extension, hãy tải lại trang rồi quét lại.

## Chế độ giải bài

- **Offline (mặc định):** Không cần API key, không gửi câu hỏi ra ngoài. Hỗ trợ những mẫu ngữ pháp, từ vựng, phát âm và sắp xếp từ đã cài quy tắc. Câu chưa đủ chắc chắn sẽ để trống, không đoán bừa. Một số quy tắc dành riêng cho các ví dụ đã gửi khi phát triển và **không phải bộ giải tổng quát**.
- **AI (tùy chọn):** Mở **Cài đặt** (⚙) → nhập OpenAI API key của **chính bạn** → bật **Cho phép gọi OpenAI API** → Lưu. Model mặc định `gpt-4o-mini`, có thể đổi. Extension gửi **chỉ nội dung bài tập đã trích xuất**, không gửi URL chứa token, cookie hay nội dung toàn trang. Có thể phát sinh chi phí API. Tài khoản ChatGPT Plus không tự bao gồm hạn mức API.
- Nếu AI bị lỗi, extension tự dùng offline và hiển thị cảnh báo. Nội dung do AI tạo có thể sai, phải kiểm tra.

## Dạng bài & mức hỗ trợ

| Dạng bài | Trích xuất / giải | Tự điền |
|---|---|---|
| Dropdown (Vocabulary, Pronunciation) | Có, nếu HTML chứa lựa chọn; dùng quy tắc hoặc AI | Có, thử nhấp ô chọn; báo **chưa xác minh** nếu không xác nhận được |
| Ô nhập văn bản (điền động từ, ngữ pháp) | Có, nếu có `input`, `textarea`, `contenteditable` | Có, phát `input` / `change` |
| Sắp xếp từ bằng kéo-thả | Hiển thị và giải nếu phát hiện được / có quy tắc hoặc AI | **Chưa hỗ trợ** kéo-thả tự động; sao chép kết quả để nhập |
| Nhấp chọn từ sai / sửa lỗi | Hiển thị và giải nếu phát hiện được / có quy tắc hoặc AI | **Chưa hỗ trợ** nhấp sửa tự động; sao chép kết quả để nhập |
| Bài dựa trên audio không có transcript | Không thể nghe bằng bản này | Không tự đoán âm thanh |

Không có quyền truy cập trực tiếp iframe từ Dashboard trong JavaScript chạy ở top frame nếu iframe khác origin; vì vậy extension đăng ký **content script trong từng iframe** mà trình duyệt cấp quyền cho `learn.eltngl.com` và `*.avallain.net`. Website dùng iframe từ domain khác chưa có trong `manifest.json` thì cần cập nhật domain được phép.

## Quyền và bảo mật

- `activeTab`: tương tác với tab người dùng chủ động mở.
- `webNavigation`: liệt kê frame trong tab hiện tại.
- `scripting`: khởi tạo content script cho frame khi cần.
- `storage`: giữ cài đặt, kể cả API key (chỉ khi bạn nhập).
- Host `learn.eltngl.com`, `*.avallain.net`: đọc phần bài tập trong các iframe này.
- Host `api.openai.com`: gọi API khi được bạn bật.

API key được lưu bằng `chrome.storage.local`, không hard-code vào tiện ích, nhưng **không phải kho bí mật bảo mật tuyệt đối** trên thiết bị hoặc profile Chrome bị xâm phạm. Không chia sẻ bản extension đã cấu hình API key với người khác. Không có dịch vụ backend riêng. Mã trang học tập được coi là dữ liệu, không phải chỉ dẫn tin cậy.

## Phát triển và kiểm thử

- `manifest.json`: khai báo extension MV3.
- `content.js`: quét phần bài tập và hỗ trợ điền, chạy trên iframe.
- `popup.html`, `popup.js`, `styles.css`: cửa sổ quản lý bài tập.
- `options.html`, `options.js`: cấu hình AI / API key.
- `background.js`: giao tiếp API, xác thực đáp án so với lựa chọn.
- `solver.js`: bộ giải theo quy tắc offline.
- `tests/solver.test.js`: kiểm thử logic độc lập, chạy `node --test tests/solver.test.js`.

### Giới hạn thực tế

Đây là phiên bản đầu tiên dựa trên các ví dụ HTML đã cung cấp. Không thể đảm bảo trang đã xử lý các sự kiện nhấp được tạo từ JavaScript: nếu `setDropdown` không xác nhận được lựa chọn, popup sẽ báo **chưa xác minh**. Tương tự, bộ kiểm thử offline không thay cho thử trên bài thật đã đăng nhập. Khi Spark thay giao diện, các selector có thể cần cập nhật.

Không sử dụng extension để trích xuất cookie, token học tập hay vượt cơ chế kiểm soát quyền truy cập của website.
