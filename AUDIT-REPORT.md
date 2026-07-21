# Báo Cáo Audit Mã Nguồn & Kế Hoạch Phát Triển ToolNet API

**Ngày thực hiện:** 21/07/2026
**Mục tiêu:** Audit mã nguồn ToolNet API để chuẩn bị phát triển nhánh riêng "ToolNet API" độc lập, an toàn và không gây ảnh hưởng đến hệ thống ToolNet API đang chạy.

---

## 1. Executive Summary
Quá trình audit đã diễn ra thành công và an toàn tuyệt đối. Môi trường VPS, trạng thái process, và port của bản ToolNet API hiện tại không bị tác động. Repository mục tiêu `/root/toolnetapi` đã được clone thành công và đang ở trạng thái sẵn sàng để tiếp nhận mã nguồn sau quá trình đổi thương hiệu (rebranding). Kiến trúc của ToolNet API rất phù hợp để fork nhờ cơ chế tách biệt hoàn toàn giữa Source Code và Runtime Data.

## 2. Trạng thái môi trường VPS
- **Hệ điều hành:** Linux CentOS/AlmaLinux 8 (Kernel 4.18.0)
- **CPU:** Intel Core Processor (Broadwell)
- **RAM:** 8.8 GiB (Đã dùng: 3.4 GiB, Trống: 435 MiB, Cache: 5.0 GiB)
- **Ổ cứng (Disk):** 59 GB - **CẢNH BÁO: Đã dùng 95% (chỉ còn trống 3.3 GB).**
- **Node.js:** v24.18.0 | **npm:** 11.16.0
- **PM2:** 7.0.3 | **Git:** 2.43.7
- **Docker:** 26.1.3 | **Docker Compose:** v2.27.0

## 3. Trạng thái `/root/9router`
- **Phương thức chạy:** Quản lý bởi PM2 (`fork_mode`).
- **Trạng thái:** `online` (Tên: `9router`, PM ID: 3, PID: 1552782).
- **Cổng kết nối:** 20128 (Đang được bind bởi `next-server (v1)`).
- ToolNet API hoạt động ổn định và hoàn toàn không bị gián đoạn trong lúc audit.

## 4. Trạng thái `/root/toolnetapi`
- Đã clone thành công từ `https://github.com/LBT-AI/toolnetapi`.
- Trạng thái hiện tại: **Empty repository** (Repo trống, chưa có code).
- Sẵn sàng để thực hiện Phase 1 (import source sau khi rename) mà không lo ghi đè nhầm dữ liệu.

## 5. Kiến trúc ToolNet API
- **Kiến trúc cốt lõi:** Monorepo. Sử dụng **Next.js** làm cả Frontend Dashboard và Backend (MITM Proxy Server kết hợp API Router).
- **CLI Wrapper:** Source Next.js sau khi build (standalone) sẽ được đóng gói bởi `esbuild` vào một ứng dụng CLI (`cli/cli.js`). 
- **Dependencies xử lý thông minh:** Các native module như `sql.js`, `better-sqlite3`, và `systray2` không bị bundle cứng vào source mà được cơ chế `postinstall` tải thẳng vào `~/.9router/runtime/node_modules`. Tính năng này giúp CLI chạy mượt, không lỗi EBUSY (đặc biệt trên Windows).

## 6. Source code và dữ liệu runtime
- **Phiên bản Node.js yêu cầu:** `>=18.0.0`
- **Package Manager:** `npm`
- **Lệnh Development:** `npm run dev`
- **Lệnh Build:** `npm run build` sau đó `npm run pack:cli`
- **Entry point Backend:** Nằm trong thư mục `cli/cli.js`, sẽ gọi đến `custom-server.js` để khởi chạy file standalone Next.js.
- **Frontend & API:** Thư mục `app/src/app` hoặc `pages` (API `/v1` cho chat/completions/models).
- **Routing & Proxy:** Sử dụng cơ chế load balancing nội bộ, đánh dấu node `priority` và lưu cache request.
- **Dữ liệu Runtime:** Mặc định lưu bên ngoài source, nằm ở **`~/.9router/`** (bao gồm `data.sqlite` và cấu hình server).

## 7. Cơ chế secret/credential
- Toàn bộ Provider Connections (API Keys của OpenAI, Anthropic,...), API Keys do máy chủ cấp ra cho người dùng con, OAuth Tokens, dữ liệu log (usage/cost analytics) đều được lưu trữ hoàn toàn trong **`~/.9router/data.sqlite`**.
- Không có cấu hình cứng (hardcode) mang tính nhạy cảm trong source code. Quản lý an toàn.

## 8. Rủi ro bảo mật
- Nguy cơ chép nhầm thư mục `.env` hoặc file `data.sqlite` lên GitHub nếu file `.gitignore` không được thiết lập chặt chẽ.
- VPS đang báo dung lượng 95%. Nếu lưu lượng log hoặc lượng request ghi vào SQLite tăng cao, VPS có thể bị full disk dẫn đến sập toàn bộ các dịch vụ (cả ToolNet API cũ và ToolNet API mới).

## 9. Danh sách file dự kiến cần sửa (Rebranding)
- `package.json` và `cli/package.json`: Đổi `name` thành `toolnetapi`, đổi CLI command, mô tả.
- `cli/cli.js`: Đổi thư mục runtime từ `.9router` thành `.toolnetapi`, đổi cổng mặc định (ví dụ sang 20130 để tránh trùng 20128).
- Cập nhật logo/favicon trong `public/`.
- `README.md`: Viết lại tài liệu cho dự án ToolNet API.
- Đổi tên các metadata, Title, UI brand color trong config của Next.js và Tailwind.

## 10. Yêu cầu giấy phép (License)
- ToolNet API sử dụng **MIT License**.
- **Yêu cầu:** Giữ nguyên thông báo bản quyền `Copyright (c) 2024-2026 decolua and contributors` bên trong tệp `LICENSE` của ToolNet API.
- **Đề xuất:** Cập nhật file `LICENSE` hoặc `README.md` với dòng: *"ToolNet API is developed based on ToolNet API. Original copyright (c) decolua."* để tuân thủ luật mà vẫn tạo được thương hiệu riêng.

## 11. Phương án repository ToolNet API (Bảo mật GitHub)
File `.gitignore` phải loại trừ ít nhất các thành phần sau:
```text
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.toolnetapi/
.9router/
data.sqlite
*.sqlite3
*.log
node_modules/
.next/
out/
```
Repository CHỈ chứa source tĩnh, logic, scripts, và `.env.example`. Không lưu runtime hay key.

## 12. Quy trình cài đặt trên máy mới (Đề xuất cho ToolNet API)
1. **Clone repository:** `git clone https://github.com/LBT-AI/toolnetapi.git && cd toolnetapi`
2. **Kiểm tra môi trường:** Đảm bảo Node.js >= 18.
3. **Cài đặt:** `npm install`
4. **Cấu hình:** Copy `.env.example` thành `.env` (thiết lập HOST, PORT).
5. **Build:** `npm run build && npm run pack:cli`
6. **Khởi chạy nền (PM2):** `pm2 start cli/cli.js --name "toolnetapi" -- --tray --port 20130`
7. **Health check & Setup:** Truy cập dashboard qua cổng 20130, kết nối API Keys, và tích hợp AI.

## 13. Lộ trình Phát triển (Roadmap)
- **Phase 1: Rebranding & Isolate (Chuẩn bị source)**
  - Đổi thương hiệu (ToolNet API), icon, theme.
  - Sửa CLI port (20130) và Runtime Data Directory (`~/.toolnetapi`).
  - Push lên GitHub bảo mật.
- **Phase 2: Configuration & Deployment (Triển khai độc lập)**
  - Tối ưu hóa biến môi trường. Tách bạch hoàn toàn khỏi bản gốc đang chạy.
  - Setup PM2 trên cổng mới và kiểm tra.
- **Phase 3: Integration (Tích hợp Hệ sinh thái AI)**
  - Thiết lập kết nối tương thích cho OpenCode, Kilo Code, và OpenClaw.

## 14. Kế hoạch kiểm thử
- Chạy `npm run dev` trên cổng phụ (VD: 3000) để xác nhận UI/Dashboard ToolNet API hoạt động.
- Gọi test thử 1 lệnh cURL vào `/v1/chat/completions` để đảm bảo proxy LLM định tuyến chính xác.

## 15. Kế hoạch rollback (Hoàn tác)
Do ToolNet API sẽ lưu dữ liệu vào thư mục riêng (`~/.toolnetapi`) và chạy trên cổng riêng (VD: 20130), nó **độc lập hoàn toàn** với ToolNet API gốc.
Nếu có sự cố, chỉ cần: `pm2 delete toolnetapi`, xóa thư mục `~/.toolnetapi` và checkout code Git lại commit cũ là hệ thống sạch như mới, không ảnh hưởng `9router`.

---

## 16. Các câu hỏi cần xác nhận trước khi làm Phase 1
1. **Cổng mặc định:** Bạn muốn ToolNet API chạy trên cổng nào để tránh xung đột với cổng `20128` của ToolNet API hiện tại? (Tôi đề xuất `20130`).
2. **Thư mục dữ liệu (Runtime Data):** Bạn muốn lưu tại `~/.toolnetapi` (Home) hay lưu thẳng vào `/root/toolnetapi/data`?
3. **Tiến hành Phase 1:** Bạn có muốn tôi bắt đầu chỉnh sửa bản clone (trong thư mục /tmp) và copy nó vào `/root/toolnetapi` để đổi tên/logo thành ToolNet API ngay bây giờ không?
