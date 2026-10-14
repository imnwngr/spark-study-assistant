<div align="center">

<img src="icons/icon128.png" alt="Biểu tượng Spark Study Assistant" width="86" height="86" />

# Spark Study Assistant

**Không gian kính trong suốt, tập trung cho NGL Spark.**

Đọc bài · So sánh đáp án AI · Kiểm tra · Điền bài · Chấm và chuyển bài

[**English**](README.md) · [**Tiếng Việt**](README.vi.md) · [**Thiết kế**](docs/GLASS_DESIGN.md) · [**Lịch sử cập nhật**](CHANGELOG.md)

<img alt="Chrome Manifest V3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-2563EB?style=flat-square" />
<img alt="Phiên bản 0.5.0" src="https://img.shields.io/badge/version-0.5.0-171717?style=flat-square" />
<img alt="Không cần build" src="https://img.shields.io/badge/build-none-3A8B63?style=flat-square" />
<img alt="4 ngôn ngữ" src="https://img.shields.io/badge/languages-4-8B5CF6?style=flat-square" />

</div>

---

## Học tập tập trung, ít thao tác thừa

Spark Study Assistant là **Chrome Extension cài trực tiếp trên máy**, hỗ trợ một số dạng bài của [National Geographic Learning Spark](https://learn.eltngl.com/). Extension đọc nội dung bài tập trong các iframe được cấp quyền, có thể gọi AI qua API để gợi ý đáp án, rồi cho phép bạn kiểm tra và điền vào trang.

Giao diện dùng ngôn ngữ **Liquid Glass**: các lớp kính trong, viền phản sáng, độ mờ có kiểm soát, dock thao tác riêng và màu nền theo sở thích. Bố cục và trạng thái tương tác được thiết kế theo [Hallmark](https://github.com/nutlope/hallmark), trên nền HTML/CSS/JavaScript thuần.

<table align="center">
<tr><td align="center"><img src="docs/screenshots/popup-glass-light.png" alt="Popup chế độ sáng" width="300" /></td><td align="center"><img src="docs/screenshots/popup-glass-dark.png" alt="Popup chế độ tối" width="300" /></td></tr>
<tr><td align="center"><small>Giao diện sáng</small></td><td align="center"><small>Giao diện tối</small></td></tr>
</table>

> [!NOTE]
> Ảnh chụp dùng **dữ liệu mô phỏng**, không lấy từ tài khoản Spark thật. Chưa kiểm chứng hoạt động với tất cả loại bài trên nền tảng.

## Những chức năng chính

| Tính năng | Hoạt động |
|---|---|
| **Đọc bài tập** | Tìm phần bài tập trong các iframe được cấp quyền; nhận diện dropdown, ô nhập và một số dạng tĩnh. |
| **Nhiều nhà cung cấp AI** | Lưu endpoint và model riêng cho OpenAI, OpenRouter, Groq, DeepSeek, Gemini, Ollama local API và endpoint tùy chỉnh. |
| **So sánh đáp án** | Đối chiếu kết quả các model; nếu bất đồng thì bạn chọn phương án. |
| **Chỉnh sửa trước khi điền** | Mở từng câu, sửa nội dung hoặc chọn đáp án. |
| **Điền có xác minh** | Báo rõ mục đã điền, chưa chắc chắn, bỏ qua hoặc phải làm thủ công. |
| **Nộp & chuyển bài — thử nghiệm** | Chỉ thực hiện sau khi bạn nhấn nút, xác nhận và trang có đủ điều kiện. |
| **Bốn ngôn ngữ** | English (mặc định), Tiếng Việt, 简体中文, 繁體中文. |
| **Giao diện và màu nền** | Sáng, Tối, Theo hệ thống; 9 màu dựng sẵn, vòng chọn màu, HEX, bảng màu hệ thống, thanh cường độ và xem trước trực tiếp. |
| **Quy tắc offline cũ** | Giữ để tương thích, không mở rộng ở phiên bản này; ưu tiên giải bài bằng API. |

### Cài đặt extension

1. Tải hoặc clone repository.
2. Mở `chrome://extensions/` trên Chrome hoặc Chromium.
3. Bật **Developer mode** và chọn **Load unpacked**.
4. Trỏ đến thư mục chứa `manifest.json`.
5. Mở một bài trên `learn.eltngl.com`; nếu trang Spark đã mở trước khi cài, hãy tải lại.
6. Nhấn extension và thao tác **Quét bài → Giải bài → Kiểm tra → Điền**. Có thể dùng **Giải & điền** khi bài thuộc dạng đã hỗ trợ.

Không cần `npm install` hay bước build. **Sử dụng AI qua API cần có endpoint/khóa phù hợp và có thể phát sinh phí.** Gói ChatGPT không bao gồm mặc định hạn mức OpenAI API.

### Đổi ngôn ngữ và giao diện

Vào **Settings → General**, chọn ngôn ngữ và chế độ Sáng / Tối / Theo hệ thống, rồi nhấn **Save changes** (tùy ngôn ngữ đang hiển thị). Khi cài mới, giao diện mặc định là **English**, không phụ thuộc ngôn ngữ trình duyệt. Tùy chọn lưu trong `chrome.storage.local` và áp dụng cho cả hai trang.

### Tùy chỉnh màu nền Liquid Glass

Mở **Settings → Xưởng màu (Color studio)**, hoặc cuộn đến **Một không gian mang dấu ấn riêng** trong mục General. Bộ chỉnh màu có các tính năng:

- **9 màu có sẵn**; nhấp màu để xem trước ngay.
- **Vòng chọn sắc độ**, hỗ trợ chuột, các phím mũi tên và Shift + mũi tên để điều chỉnh nhanh.
- Nhập **mã HEX sáu ký tự**, mở bảng màu mặc định của Chrome, và chỉnh **Cường độ nền** từ 0–100%.
- Dùng **Khôi phục mặc định** để trở về màu Glacier. Bấm **Lưu thay đổi** để áp dụng cho cả popup và Settings.

<table align="center"><tr><td><img src="docs/screenshots/color-studio-light.png" alt="Bộ chỉnh màu nền sáng" width="480" /></td><td><img src="docs/screenshots/color-studio-dark.png" alt="Bộ chỉnh màu nền tối" width="480" /></td></tr></table>

**Giới hạn kỹ thuật:** Đây là hiệu ứng kính CSS (`backdrop-filter`, lớp màu trong suốt, viền phản sáng), không phải API Liquid Glass gốc của Apple. Popup Chrome không thể làm mờ trực tiếp trang web đằng sau thanh công cụ Chrome. Nếu hệ thống bật giảm hiệu ứng trong suốt hoặc tăng tương phản, nền sẽ tự đơn giản hóa. Màu bạn chọn chỉ lưu tại `chrome.storage.local`, không được gửi đến dịch vụ AI.

### Cấu hình API

Vào **Settings → AI connections** để thêm cấu hình, điền endpoint, model ID, API key và chọn tham gia so sánh. Trong mục **Answers**, chọn **Một AI**, **So sánh AI**, hoặc **Quy tắc cũ**. Nhấn Lưu và cấp quyền endpoint nếu Chrome yêu cầu.

Chỉ hỗ trợ giao thức **Chat Completions tương thích OpenAI** (`POST …/chat/completions`). Chưa hỗ trợ trực tiếp Anthropic Messages hay OpenAI Responses API. Một số model cần chuyển sang định dạng **Prompt only**. Ollama là dịch vụ local riêng, không phải LLM nhúng trong extension.

## Nộp và chuyển bài — tính năng thử nghiệm

Popup có nút **Nộp & bài tiếp**. Đây là thao tác **chủ động**, hoàn toàn tách khỏi nút **Giải & điền**.

1. Xem đáp án, chọn **Điền đáp án đã chọn**.
2. Nút nộp chỉ được bật nếu **toàn bộ mục nhận diện được đều đã điền và xác nhận thành công**. Bài không hỗ trợ tự điền, thao tác bỏ qua hoặc chưa chắc chắn sẽ chặn bước nộp.
3. Extension hỏi xác nhận trước khi nhấn nút **Check Answers** của Spark (`[data-event="check"]`).
4. Nếu nhận diện được trạng thái kiểm tra đã thay đổi, và bạn bật tùy chọn **Chuyển sang bài tiếp** trong Settings, extension mới thử nhấn nút **Next learning object** (`[data-event="forward_lo"]`).
5. Không có dấu hiệu xác nhận hoặc nút Next phù hợp? Extension **dừng lại**, không tự chọn nút khác và ngăn gửi lặp trong cùng phiên quét.

> [!WARNING]
> **Chưa thể khẳng định `Check Answers` chính là thao tác gửi điểm cuối cùng của mọi bài tập.** HTML đã xem còn có nút `Results` và `Next`, nhưng thiếu dữ liệu sau khi chấm. Vì vậy đây là **bản thử nghiệm tùy chọn**; không cam kết điểm số được gửi hoặc bài tiếp theo luôn mở thành công. Xem [cách lấy dữ liệu DOM an toàn](docs/AUTOMATION_DISCOVERY.md) để hỗ trợ hoàn thiện.

## Các dạng bài và giới hạn

| Dạng bài | Đọc / giải | Tự điền |
|---|---|---|
| Dropdown (Vocabulary, Pronunciation có transcript) | Có nếu HTML có lựa chọn | Thử chọn và xác minh |
| Ô văn bản (động từ, ngữ pháp) | Có | Thử nhập và xác minh |
| Sắp xếp từ bằng kéo-thả | Một số dạng có gợi ý | **Thủ công**; chưa tự kéo-thả |
| Sửa lỗi bằng nhấp từ | Một số dạng có gợi ý | **Thủ công**; chưa hỗ trợ tự nhấp |
| Audio không có transcript | Chưa hỗ trợ | Chưa hỗ trợ |
| iframe ngoài danh sách domain cho phép | Cần kiểm tra quyền/selector | Chưa bảo đảm |

## Quyền riêng tư

- **Dữ liệu API:** chỉ chủ động gửi câu hỏi, lựa chọn và dữ liệu bài tập cần thiết. Không đưa cookie, token đăng nhập Spark hoặc đường dẫn assignment vào payload AI.
- **API key:** lưu bằng `chrome.storage.local`, giới hạn `TRUSTED_CONTEXTS` trên Chrome hỗ trợ. Không phải kho bí mật tuyệt đối nếu thiết bị bị xâm nhập; đừng commit khóa riêng lên GitHub.
- **Quyền endpoint:** URL HTTPS hoặc loopback local được kiểm tra, quyền host được yêu cầu khi bạn lưu cấu hình đang dùng. Chỉ dùng endpoint đáng tin cậy.
- **Không tự nộp ngầm:** bạn phải nhấn nút nộp và xác nhận. Tùy chọn chuyển bài tiếp được cấu hình riêng.
- **Giới hạn thật:** một số sự kiện nhấp mô phỏng bằng JavaScript có thể không được trang học tập chấp nhận; cần kiểm thử trên phiên Spark thật.

## Cấu trúc mã nguồn

```text
spark-study-assistant/
├── popup.html / popup.js        # Popup: quét / giải / kiểm tra / điền
├── options.html / options.js    # API, ngôn ngữ, chế độ hiển thị, quy trình
├── i18n.js                      # en, vi, zh-CN, zh-TW
├── styles.css                   # Token màu, typography, responsive
├── content.js                   # Quét từng iframe, điền, Check & Next
├── background.js                # Gọi API và xử lý lỗi
├── providers.js / solver.js     # Cấu hình, so sánh AI, quy tắc cũ
├── _locales/                    # Bản địa hóa thông tin Chrome Extension
├── docs/                        # Thiết kế và hướng dẫn lấy dữ liệu DOM
└── tests/                       # Bài kiểm thử Node
```

Chạy bài kiểm thử:

```bash
node --test tests/*.test.js
```

Không thêm trình theo dõi, font online hay runtime UI của bên thứ ba. Nghiên cứu offline trước đây được giữ trong [`docs/OFFLINE_RESEARCH.md`](docs/OFFLINE_RESEARCH.md); phiên bản này không tích hợp thư viện hoặc model offline mới.

---

<div align="center">

**Ưu tiên đáp án có thể kiểm tra, không phải những cú nhấp âm thầm.**

[English →](README.md) · [Nguyên tắc thiết kế](docs/GLASS_DESIGN.md) · [Giới hạn tự động hóa](docs/AUTOMATION_DISCOVERY.md)

<sub>Tiện ích độc lập, không phải sản phẩm chính thức hay được National Geographic Learning / Spark bảo trợ.</sub>

</div>
