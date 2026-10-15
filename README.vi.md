<div align="center">
  <img src="icons/icon128.png" alt="Biểu tượng Spark Study Assistant" width="90" height="90" />

  # Spark Study Assistant

  **Đọc đáp án từ bài tập trước. Chỉ dùng AI khi cần.**

  Tiện ích Chrome giúp đọc, xem lại và điền đáp án cho những dạng bài được hỗ trợ trên National Geographic Learning Spark.

  [![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](#cài-đặt)
  [![Phiên bản](https://img.shields.io/badge/phiên_bản-0.6.0-8C83F4?style=flat-square)](CHANGELOG.md)
  [![JavaScript](https://img.shields.io/badge/JavaScript-thuần-F7DF1E?style=flat-square&logo=javascript&logoColor=111)](#cấu-trúc-dự-án)
  [![Kiểm thử](https://img.shields.io/badge/kiểm_thử-88_đạt-2A946A?style=flat-square)](#kiểm-thử)

  [**Cài đặt**](#cài-đặt) · [**Cơ chế tìm đáp án**](#cơ-chế-tìm-đáp-án) · [**Cấu trúc**](#cấu-trúc-dự-án) · [**English**](README.md)
</div>

---

<div align="center">
<table>
<tr><td align="center"><img src="docs/screenshots/popup-glass-light.png" alt="Popup sáng" width="295" /></td><td align="center"><img src="docs/screenshots/popup-glass-dark.png" alt="Popup tối" width="295" /></td></tr>
<tr><td align="center"><sub>Chế độ sáng</sub></td><td align="center"><sub>Chế độ tối</sub></td></tr>
</table>
</div>

> [!NOTE]
> Các ảnh giao diện sử dụng **dữ liệu mô phỏng**. Bộ đọc QTI đã được kiểm thử trong Chromium với dữ liệu XML mô phỏng cấu trúc của bài Spark gồm năm câu; chưa thể khẳng định mọi dạng bài hoặc mọi tài khoản Spark đều tương thích.

## Có gì mới ở v0.6.0?

**Ưu tiên QTI:** Một số bài tập Spark công bố khai báo đáp án đúng trong XML nhúng vào tệp `data.js`. Extension tìm và đối chiếu các khai báo này với lựa chọn đang hiển thị trên trang **trước khi** gửi yêu cầu AI.

**Mượt hơn:** Các thẻ câu hỏi con không còn áp dụng nhiều lớp làm mờ riêng biệt. Độ mờ kính được giảm hợp lý, hiệu ứng ánh sáng được giới hạn theo từng khung hình và danh sách câu hỏi được dựng vào DOM một lần.

**Không mất tính năng cũ:** Vẫn hỗ trợ nhiều nhà cung cấp AI, so sánh mô hình, sửa đáp án thủ công, tự điền có xác minh và thao tác kiểm tra/chuyển bài khi người dùng xác nhận.

## Cơ chế tìm đáp án

```mermaid
flowchart TD
  A[Đọc bài Spark đang mở] --> B[Tìm data.js ở iframe bài tập]
  B --> C{Có XML QTI hợp lệ?}
  C -->|Có| D[Đọc correctResponse]
  D --> E{ID và các lựa chọn khớp hoàn toàn?}
  E -->|Có| F[Đáp án QTI đã xác minh]
  E -->|Không| G[Câu chưa giải quyết]
  C -->|Không| G
  G --> H{Phương án dự phòng?}
  H -->|Đã cấu hình AI| I[Chỉ gửi câu chưa khớp tới API]
  H -->|Quy tắc cũ| J[Gợi ý từ bộ quy tắc giới hạn]
  F --> K[Xem lại trong popup]
  I --> K
  J --> K
  K --> L[Điền những ô được hỗ trợ]
  L --> M[Tùy chọn Check & Next có xác nhận]
```

Bộ đọc QTI **không** lấy đáp án bằng cách đoán tên trường (xem [tài liệu kỹ thuật](docs/QTI_READER.md)). Chỉ chấp nhận kết quả nếu XML có `responseDeclaration / correctResponse`, `responseIdentifier` hợp lệ và **toàn bộ danh sách lựa chọn** trùng với bài đang hiển thị. Hiện hỗ trợ lựa chọn đơn dạng dropdown và đáp án văn bản được khai báo tường minh. Các dạng sắp xếp/kéo thả hoặc có quy tắc chấm phức tạp chưa được tự suy diễn.

Bộ đọc **không chạy/eval mã `data.js`**: chỉ phân tích chuỗi XML đã mã hóa trong nội dung JavaScript, với giới hạn origin, kích thước và cấu trúc. Dữ liệu QTI xử lý trong trình duyệt; **chỉ câu chưa ánh xạ được mới gửi tới API AI đã chọn**.

| Tình huống | Cách xử lý |
|---|---|
| Tất cả ô đều khớp XML | **Không tốn lượt gọi API**; hiển thị `QTI đã xác minh` |
| Một phần ô khớp | Giữ đáp án QTI; chỉ gửi câu còn lại tới bộ giải dự phòng |
| Không có QTI hoặc QTI sai cấu trúc | Dùng Single AI, Compare AIs hoặc quy tắc cũ theo cài đặt |
| Không xác minh được thao tác điền | Dừng, không tự nộp ngầm |

## Các tính năng

| | Chức năng |
|---|---|
| ◈ | **Đọc QTI trước**, ánh xạ ID và đáp án thực tế |
| ↗ | **AI dự phòng**: nhiều hồ sơ API và so sánh mô hình |
| ✓ | **Xem và sửa đáp án** trước khi điền |
| ⌁ | **Điền có kiểm tra** với dropdown/ô nhập hỗ trợ |
| ⇥ | **Check & Next (thử nghiệm)**: chỉ thực hiện khi người dùng xác nhận |
| ◐ | **Liquid Glass**, sáng/tối/theo hệ thống, 9 màu, vòng màu và mã HEX |
| 文 | **4 ngôn ngữ**: English mặc định, Tiếng Việt, 简体中文, 繁體中文 |

## Cài đặt

1. Tải repository này hoặc chọn **Code → Download ZIP** trên GitHub.
2. Mở **`chrome://extensions/`** trên Chrome/Chromium.
3. Bật **Developer mode**, nhấn **Load unpacked**, chọn thư mục chứa `manifest.json`.
4. Mở bài tập tại [NGL Spark](https://learn.eltngl.com/) và **tải lại tab Spark** sau khi cài hoặc cập nhật tiện ích.
5. Mở extension, thao tác theo thứ tự **Quét → Giải → Xem lại → Điền**. Có thể chọn **Giải & điền** để chạy liên tiếp rồi kiểm tra kết quả trên Spark.

Không cần cài npm hoặc nhập khóa API để đọc đáp án QTI **khi dữ liệu bài tập tương thích**. Bạn cần khóa API/endpoint nếu muốn dùng AI cho các bài chưa có đáp án QTI hoặc ngoài phạm vi bộ quy tắc cũ.

### Cấu hình AI dự phòng

Vào **Settings → AI connections**, thêm hồ sơ API và chọn model. Tại mục **Answers**, chọn **Single AI**, **Compare AIs** hoặc **Legacy rules**. Lựa chọn này chỉ được dùng **sau bước QTI**; một câu đã xác minh bằng QTI sẽ không phải gọi API.

Hiện hỗ trợ endpoint theo giao thức OpenAI-compatible Chat Completions: OpenAI, OpenRouter, Groq, DeepSeek, Gemini tương thích, Ollama chạy bằng máy chủ local và endpoint tùy chỉnh. Chưa trực tiếp hỗ trợ Anthropic Messages hoặc OpenAI Responses API.

### Tùy chỉnh giao diện

<div align="center"><table><tr><td><img src="docs/screenshots/color-studio-light.png" width="410" alt="Bộ chọn màu sáng" /></td><td><img src="docs/screenshots/color-studio-dark.png" width="410" alt="Bộ chọn màu tối" /></td></tr></table></div>

Chọn **Sáng / Tối / Theo hệ thống**; dùng một trong chín màu có sẵn, nhập HEX, chọn qua vòng sắc độ và chỉnh cường độ nền. Các tùy chọn lưu trong `chrome.storage.local`. Hiệu ứng kính tập trung ở bề mặt chính để giảm tình trạng giật khi cuộn; những cài đặt hạn chế chuyển động hoặc độ trong suốt vẫn được tôn trọng.

## Cấu trúc dự án

```text
spark-study-assistant/
│
├── manifest.json                 # Cấu hình Chrome MV3
├── popup.html                    # Giao diện tiện ích
├── popup.js                      # Quét → QTI → dự phòng → xem → điền
├── options.html                  # Bố cục cài đặt
├── options.js                    # Chọn API, ngôn ngữ, giao diện
├── styles.css                    # Typography, màu, Liquid Glass, responsive
├── appearance.js                 # Chế độ sáng/tối và nền
├── color-studio.js               # Bộ màu, vòng màu, HEX
├── i18n.js                       # Nội dung giao diện 4 ngôn ngữ
│
├── content.js                    # Quét DOM từng iframe, điền, chấm/chuyển
├── qti.js                        # Phân tích data.js/XML và ánh xạ đáp án  MỚI
├── background.js                 # Gọi API khi cần
├── providers.js                  # Cấu hình provider, so sánh model
├── solver.js                     # Bộ quy tắc cũ (không phải LLM offline)
│
├── _locales/                     # Ngôn ngữ metadata tiện ích
│   ├── en/  ├── vi/  ├── zh_CN/  └── zh_TW/
├── icons/                        # Biểu tượng có sẵn
├── docs/
│   ├── screenshots/              # Ảnh giao diện minh họa
│   ├── AUTOMATION_DISCOVERY.md   # Hướng dẫn thu thập DOM an toàn
│   ├── QTI_READER.md            # Kiến trúc, kiểm tra và giới hạn QTI
│   ├── GLASS_DESIGN.md           # Quyết định về chất liệu/giao diện
│   └── ...                       # Tài liệu nghiên cứu trước đây
└── tests/                        # Kiểm thử Node không cần thư viện ngoài
    ├── qti.test.js               # XML, đáp án, lỗi ánh xạ, API dự phòng
    ├── providers.test.js
    ├── solver.test.js
    ├── background.test.js
    ├── appearance.test.js
    ├── i18n.test.js
    └── ui.test.js
```

## Kiểm thử

Trên PowerShell, chạy một lần:

```powershell
& {
    Set-Location "$HOME\Downloads\spark-study-assistant"
    node --test
}
```

Bộ kiểm thử xác nhận cách ghép đáp án QTI cho năm câu mẫu, xử lý đầu vào không khớp, câu văn bản, phương án dự phòng và giao diện. Ngoài Node, parser đã được thử với `DOMParser` thật trên Chromium. **Kết quả này chưa thay thế thử nghiệm thực tế với từng dạng bài Spark.**

## Quyền truy cập và giới hạn

- Chỉ đọc nội dung bài trong những iframe Spark được cấp quyền; parser QTI không fetch script khác origin.
- Chỉ câu chưa ánh xạ mới được đưa vào payload API đã chọn; không cố ý gửi cookie, token hoặc URL assignment.
- API key lưu trong Chrome local storage, **không phải kho bí mật có mã hóa chuyên biệt**; tuyệt đối không đưa key vào Git.
- **Check & Next** phải do bạn nhấn và xác nhận. `Check Answers` chưa được chứng minh là nút gửi điểm cuối cùng trong mọi loại bài. Xem [hướng dẫn kiểm tra](docs/AUTOMATION_DISCOVERY.md).
- Không có telemetry, không tải framework UI từ Internet, không có LLM offline hay cơ sở dữ liệu kiến thức lớn.

---

<div align="center">
  <strong>Ít phỏng đoán hơn. Nhiều đáp án có thể kiểm chứng hơn.</strong><br />
  <sub>Dự án độc lập, không trực thuộc hoặc được National Geographic Learning, Spark hay Avallain chứng thực.</sub><br /><br />
  <a href="README.md">English README</a> · <a href="CHANGELOG.md">Changelog</a> · <a href="docs/AUTOMATION_DISCOVERY.md">Giới hạn tự động hóa</a>
</div>
