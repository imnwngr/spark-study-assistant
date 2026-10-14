# Spark Study Assistant

Chrome extension (Manifest V3) giúp **đọc bài tập NGL Spark ngay từ trang Dashboard**, gợi ý đáp án và hỗ trợ điền đáp án khi đã xem trước.

**Trạng thái: bản thử nghiệm v0.2.0.** Đã triển khai mã nguồn, kiểm thử bộ giải offline và logic API bằng các ca kiểm thử, **chưa kiểm thử end-to-end với một tài khoản Spark đang đăng nhập**. Cấu trúc HTML hoặc hành vi của website có thể khác theo từng bài.

## Cài trên Chrome

1. Giải nén `spark-study-assistant.zip` ra một thư mục cố định.
2. Truy cập `chrome://extensions/` → bật **Developer mode** (Chế độ dành cho nhà phát triển).
3. Chọn **Load unpacked** (Tải tiện ích đã giải nén) → chọn đúng thư mục `spark-study-assistant` chứa `manifest.json`.
4. Mở / tải lại trang `https://learn.eltngl.com/dashboard/assignments/...` và vào một bài tập.
5. Nhấp biểu tượng extension → **Quét trang** → **Giải bài** → kiểm tra đáp án → **Điền đáp án đã chọn**. Hoặc chọn **Giải + điền ngay** để tự động thực hiện cả ba bước trên các loại ô được hỗ trợ (vẫn không tự nộp bài).
6. Tự kiểm tra trên website trước khi nhấn `Check Answers` hoặc nộp bài. Extension **không tự nộp bài**.

Nếu Chrome đang mở Spark từ trước khi cài extension, hãy tải lại trang rồi quét lại.

## Chế độ giải bài (v0.2.0)

- **Offline:** Không cần API key, không gửi câu hỏi ra ngoài, vẫn dùng các quy tắc hẹp trong `solver.js`. Độ bao phủ có giới hạn; các câu không chắc chắn được để trống.
- **Một API:** Mở ⚙ **Cài đặt** → thêm hoặc sửa một cấu hình API → đặt endpoint, tên model, API key, chế độ JSON → chọn **Cấu hình chính** → chọn **Một API** → **Lưu cài đặt** và cấp quyền truy cập máy chủ theo yêu cầu Chrome.
- **So sánh API:** Thêm từ hai cấu hình trở lên, bật **Tham gia so sánh** cho từng cấu hình và chọn **So sánh**. Extension gọi các cấu hình đã bật, hiển thị phương án và nhà cung cấp. **Chỉ điền tự động nếu ít nhất hai cấu hình chạy thành công, trả cùng đáp án khác rỗng với confidence không phải low.** Với đáp án khác nhau, nhấn một phương án trong popup để chọn thủ công.
- **Khi API lỗi:** Chế độ Một API hoặc So sánh mà tất cả đều lỗi sẽ chuyển về quy tắc offline và báo lý do. Nếu một số API so sánh lỗi, đáp án còn lại vẫn được hiển thị để bạn chọn nhưng không mặc nhiên coi một kết quả là đồng thuận.

Có tối đa **8 cấu hình**. Các preset: OpenAI, OpenRouter, Groq, DeepSeek, Gemini (đầu cuối tương thích OpenAI), Ollama local và **Tùy chỉnh**. Mỗi cấu hình có URL endpoint hoàn chỉnh, model, key, và định dạng output (`json_schema`, `json_object`, `prompt_only`). Cấu hình API cũ (`apiKey`, `model`, `useAI`) được đọc tự động và chuyển sang danh sách mới khi bạn lưu cài đặt. Không có backend trung gian, extension gửi trực tiếp tới API bạn chọn.

**Phạm vi tương thích:** Chỉ endpoint Chat Completions kiểu OpenAI (`POST .../chat/completions`); không mặc nhiên hỗ trợ Anthropic native, Responses API hay các endpoint theo JSON riêng. Không phải mọi model hỗ trợ `response_format`; nếu gặp HTTP 400 hãy đổi sang **Chỉ prompt**. Tên model preset chỉ là ví dụ, cần chọn model hiện được phép sử dụng ở nhà cung cấp của bạn.

**Ollama local:** là một *local HTTP API*, không phải engine thuần offline chạy bên trong extension. Bạn phải tự cài Ollama và tải model trước; mặc định `http://localhost:11434/v1/chat/completions`, không cần nhập key nếu chạy local. Không gửi câu hỏi lên cloud nếu model và server đều local. Xem [hướng dẫn Ollama](https://docs.ollama.com/api/openai-compatibility).

Sử dụng API bên thứ ba có thể phát sinh chi phí nhiều lần ở chế độ so sánh. ChatGPT Plus không đồng nghĩa có credit cho OpenAI API.

### Nghiên cứu offline thuần, chưa triển khai

Xem [`docs/OFFLINE_RESEARCH.md`](docs/OFFLINE_RESEARCH.md) để so sánh `wink-nlp`, `nspell`, `CMUdict`, `sql.js`, `WebLLM`, `Transformers.js`, và `LanguageTool`. Chưa thêm thư viện, model hoặc database vào extension ở bản này.

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
- Host `api.openai.com`: tương thích cấu hình OpenAI cũ.
- `optional_host_permissions` cho `https://*/*`, `http://localhost/*`, `http://127.0.0.1/*`: Chrome chỉ cấp quyền đến endpoint bạn chủ động lưu khi bật API.
- Khóa API được giới hạn truy cập trong `TRUSTED_CONTEXTS` của extension để content scripts không đọc trực tiếp qua `chrome.storage.local` (trên Chrome hỗ trợ tính năng này).

API key được lưu bằng `chrome.storage.local`, không hard-code vào tiện ích, nhưng **không phải kho bí mật bảo mật tuyệt đối** trên thiết bị hoặc profile Chrome bị xâm phạm. Không chia sẻ bản extension đã cấu hình API key với người khác. Không có dịch vụ backend riêng. Mã trang học tập được coi là dữ liệu, không phải chỉ dẫn tin cậy.

## Phát triển và kiểm thử

- `manifest.json`: khai báo extension MV3.
- `content.js`: quét phần bài tập và hỗ trợ điền, chạy trên iframe.
- `popup.html`, `popup.js`, `styles.css`: cửa sổ quản lý bài tập.
- `options.html`, `options.js`: quản lý nhiều cấu hình API, cấp quyền host theo yêu cầu.
- `background.js`: gửi yêu cầu đến nhiều API tương thích, xử lý lỗi và so sánh kết quả.
- `providers.js`: preset, schema, chuẩn hóa cấu hình, xác thực URL/đáp án và quy tắc đồng thuận.
- `solver.js`: bộ giải theo quy tắc offline.
- `tests/solver.test.js`, `tests/providers.test.js`: kiểm thử logic độc lập, chạy `node --test tests/*.test.js`.

### Giới hạn thực tế

Đây là phiên bản đầu tiên dựa trên các ví dụ HTML đã cung cấp. Không thể đảm bảo trang đã xử lý các sự kiện nhấp được tạo từ JavaScript: nếu `setDropdown` không xác nhận được lựa chọn, popup sẽ báo **chưa xác minh**. Tương tự, bộ kiểm thử offline không thay cho thử trên bài thật đã đăng nhập. Khi Spark thay giao diện, các selector có thể cần cập nhật.

Không sử dụng extension để trích xuất cookie, token học tập hay vượt cơ chế kiểm soát quyền truy cập của website.
