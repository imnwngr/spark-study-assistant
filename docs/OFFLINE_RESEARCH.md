# Nghiên cứu bộ giải offline, chưa triển khai (2026-10-14)

**Trạng thái:** chỉ nghiên cứu, không thêm thư viện NLP, model weights, phát âm hay database mới vào build v0.2.0. Bộ giải offline hiện có (`solver.js`) vẫn dựa trên các quy tắc hẹp và dữ liệu ví dụ.

## Phân biệt hai loại offline

1. **Không cần API / không có server / hoàn toàn trong extension:** dữ liệu từ điển + quy tắc, SQLite WASM hoặc mô hình WebGPU/ONNX được đóng gói hay tải về một lần rồi cache. Muốn đảm bảo *cài đặt không cần mạng*, phải phân phối sẵn toàn bộ dữ liệu, runtime và model weights trong gói, không chỉ dựa vào cache.
2. **Không dùng dịch vụ đám mây nhưng có API nội bộ:** Ollama hoặc LanguageTool chạy trên máy và trao đổi qua `localhost`. Vẫn có HTTP API, nhưng câu hỏi không phải gửi lên Internet nếu model đã nằm trên máy. v0.2.0 chỉ hỗ trợ cấu hình Ollama qua giao diện Chat Completions compatible, **không tự cài Ollama/model**.

## Thư viện / dữ liệu đáng thử

| Công cụ | Cách dùng | Điểm mạnh | Giới hạn với bài NGL Spark |
|---|---|---|---|
| [wink-nlp](https://github.com/winkjs/wink-nlp) | JS chạy ngay trình duyệt: tokenize, POS, lemma, stem, n-gram | Nhẹ, nền tảng cho kiểm tra cấu trúc câu, nhận diện loại từ | **Không tự giải** toàn bộ bài grammar/điền trống: cần bộ luật + từ điển bổ sung |
| [nspell](https://github.com/wooorm/nspell) + [dictionary-en](https://github.com/wooorm/dictionaries) | Kiểm tra chính tả và đề xuất từ | Hữu ích cho lỗi spelling và xác nhận từ hợp lệ | Không hiểu ngữ cảnh `take a break` hoặc agreement; giấy phép từ điển phải xét riêng |
| [CMUdict](https://github.com/cmusphinx/cmudict) | Từ điển âm vị tiếng Anh theo ARPAbet | Phù hợp bài phát âm `-s/-es`, từ có transcript | Chưa có IPA trực tiếp; cần chuyển ARPAbet → quy tắc bài tập; accent ảnh hưởng một số từ |
| [sql.js](https://github.com/sql-js/sql.js) | SQLite WebAssembly, import DB bài học/collocations/rules | Cơ sở tri thức cục bộ, truy vấn cấu trúc, không cần server | Database **không suy luận** nếu câu mới chưa có luật/thông tin; cần duy trì nguồn dữ liệu |
| [WebLLM](https://github.com/mlc-ai/web-llm) | Sinh văn bản LLM ngay trong Chrome bằng WebGPU | Có JSON mode, ví dụ Chrome extension, không cần máy chủ inference | Tải model lớn, tốn RAM/VRAM, khởi động chậm; chất lượng tùy model; cần thử với Manifest V3 |
| [Transformers.js](https://huggingface.co/docs/transformers.js/en/guides/webgpu) | Inference ONNX/WASM/WebGPU trên trình duyệt | NLP/embedding và một số model sinh văn bản; có cache trình duyệt | Phải chọn model phù hợp, lo memory và đóng gói WASM/runtime; không có bộ giải sẵn |
| [LanguageTool](https://github.com/languagetool-org/languagetool) | Công cụ phát hiện lỗi ngữ pháp, có server local hoặc Java | Hữu ích bài sửa lỗi và phát hiện grammar | Không thể chạy Java **trực tiếp** trong Chrome extension; dùng server local sẽ là local API, không phải thuần JS |

Các dự án trên chưa được benchmark với bài tập cụ thể của người dùng; đây là **khả năng suy ra từ tính năng của từng dự án**, không phải cam kết độ chính xác.

## Kiến trúc offline nên thử tiếp theo

**Ưu tiên 1 (nhẹ / minh bạch / hoàn toàn offline):**

- Chuẩn hóa DOM Spark → `{kind, context, options, hint, transcript}`.
- Kiểm tra luật theo ngữ pháp (`do/does`, subject-verb agreement, tần suất, thì hiện tại đơn, thêm `-s/-es`), có khả năng giải thích.
- Từ điển cụm động từ và collocations: `get up`, `stay up`, `take a break`, `do exercise`, ...; dùng SQLite WASM hoặc JSON có chỉ mục.
- CMUdict + ánh xạ ARPAbet cho pronunciation; chỉ suy ra khi có transcript.
- Trả `unknown` nếu nhiều đáp án phù hợp hoặc thiếu dữ kiện (nhất là audio).

**Ưu tiên 2 (giải tốt hơn câu mới):** kết hợp tokenizer/POS (`wink-nlp`), morphological inflection và ranking các đáp án dropdown bằng luật + tần suất/collocations. Thêm bộ dữ liệu kiểm thử riêng (phân chia theo unit/bài để tránh kiểm thử trùng dữ liệu huấn luyện).

**Ưu tiên 3 (tổng quát nhưng nặng):** WebLLM hoặc Transformers.js chạy LLM đã cache trong browser; chỉ chạy khi luật thất bại. Hiển thị độ tin cậy theo kiểm thử thay vì tin tuyệt đối vào độ tự chấm của model. Chú ý vòng đời service worker trong Manifest V3 và quyền WebGPU.

## Kiến trúc tối thiểu đề xuất

```
NGL Spark DOM -> ExerciseParser
    -> RuleEngine (độ tin cậy cao)
    -> Dictionary/Collocation lookup (local JSON/sql.js)
    -> Pronunciation Dictionary (CMUdict)
    -> [tùy chọn: Browser LLM WebGPU]
    -> Candidate answers + evidence
    -> User review -> Fill (never Submit)
```

## Rủi ro kỹ thuật và cấp phép

- Chrome Manifest V3 yêu cầu JS/WASM thực thi phải được đóng gói trong extension; không tải và `eval` mã từ CDN. Model weights phải là **dữ liệu**, không phải mã thực thi lấy từ mạng. Xem [Chrome CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) và [Remote Hosted Code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code).
- Model WebGPU có thể mất hàng trăm MB hoặc nhiều GB và không phù hợp mọi máy; đo kích thước, tốc độ load, RAM và độ chính xác thực tế trước khi chọn.
- Dữ liệu dictionary/CMUdict/model có giấy phép riêng, kể cả khi thư viện mã nguồn là MIT/Apache. Không tự động đóng gói, phát hành lại ngân hàng câu hỏi của nhà xuất bản khi chưa có quyền.
- Tránh đưa bài tập, khóa API và token đăng nhập vào dataset/commit. Mọi tác vụ liên quan khóa cần được kiểm tra cục bộ.
- Không suy luận đáp án bài nghe chỉ từ tên tệp âm thanh khi không có transcript.

## Kế hoạch benchmark trước khi tích hợp

1. Tập hợp 100-300 câu mẫu không chứa dữ liệu nhạy cảm, chia đều dropdown, grammar, pronunciation, order, correction và text gap.
2. So sánh các cấu hình: rule-only; rule+collocation; rule+CMUdict; rule+POS; rule+local model.
3. Đo: accuracy, coverage (tỷ lệ trả lời), unsafe guess rate, RAM, thời gian/câu và kích thước cài đặt. Không tính câu bỏ trống là câu trả lời đúng.
4. Chỉ chọn triển khai khi lợi ích đủ rõ so với kích thước, bộ nhớ và công bảo trì.

### Nguồn gốc

Nghiên cứu dựa vào tài liệu chính thức của các dự án liên kết ở trên; chưa tải hoặc nhúng bất kỳ thư viện, từ điển, cơ sở dữ liệu hay mô hình nào vào extension.
