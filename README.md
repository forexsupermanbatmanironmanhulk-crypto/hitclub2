# Lumen Play — Social Casino Demo Coin

Ứng dụng Nuxt + Cloudflare Worker/D1 cho game giải trí dùng Lumen Coin (LC) **không có giá trị tiền tệ**. Không tích hợp thanh toán, không nạp/rút tiền thật, không chuyển đổi tài sản. Người chơi nhận LC khi tạo tài khoản.

Hiện có Sic Bo Aurora realtime: một room tối đa 100 người, mở cược 60 giây, server tung ba xúc xắc, hiện kết quả 10 giây rồi tự mở ván mới.

## 1. Yêu cầu

- Node.js 20 trở lên (khuyến nghị Node 22+).
- pnpm 11 trở lên: `npm install --global pnpm`
- Tài khoản Cloudflare nếu cần D1 remote hoặc deploy.

## 2. Cài source lần đầu

Mở PowerShell tại thư mục project:

```powershell
cd D:\hmq\hitclub
pnpm install
```

Tạo hai file cấu hình local từ template:

```powershell
Copy-Item .env.example .env
Copy-Item apps\worker\.dev.vars.example apps\worker\.dev.vars
```

Mở `apps/worker/.dev.vars` và thay `JWT_SECRET` bằng chuỗi ngẫu nhiên tối thiểu 32 ký tự. Ví dụ tạo một giá trị an toàn:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 3. Tạo và khởi tạo D1 local

Mặc dù chạy local, hãy tạo một D1 name để sau này có thể dùng cùng cấu hình khi deploy:

```powershell
pnpm exec wrangler login
pnpm exec wrangler d1 create lumen-play
```

Lệnh `d1 create` in ra `database_id`. Mở `apps/worker/wrangler.jsonc`, thay:

```json
"database_id": "REPLACE_WITH_D1_DATABASE_ID"
```

bằng ID vừa nhận.

Tạo tables và dữ liệu khởi đầu cho local D1:

```powershell
pnpm d1:migrate:local
pnpm d1:seed:local
```

`migrate` chỉ cần chạy một lần cho mỗi database, hoặc khi có migration mới. `seed` có thể chạy lại an toàn.

## 4. Chạy local

Mở hai terminal tại `D:\hmq\hitclub`.

Terminal 1 — Worker, D1 local và Durable Object:

```powershell
pnpm worker:dev
```

Terminal 2 — website Nuxt:

```powershell
pnpm dev
```

Mở `http://localhost:3000`, đăng ký tài khoản, chọn **Sic Bo Aurora** rồi đặt cược bằng LC demo.

Nuxt mặc định gọi Worker tại `http://127.0.0.1:8787`. Nếu Worker ở URL khác, sửa `NUXT_PUBLIC_API_BASE` trong `.env` và khởi động lại Nuxt.

## 5. Cấp quyền admin local

Đăng ký tài khoản trước, sau đó chạy lệnh dưới đây và thay email bằng email đã đăng ký:

```powershell
pnpm exec wrangler d1 execute lumen-play --local --config apps/worker/wrangler.jsonc --command "UPDATE users SET role = 'admin' WHERE email = 'you@example.com';"
```

Đăng xuất rồi đăng nhập lại để thấy mục **Quản trị**.

## 6. Deploy Cloudflare

1. Đăng nhập: `pnpm exec wrangler login`.
2. Xác nhận `database_id` trong `apps/worker/wrangler.jsonc` là D1 remote của bạn.
3. Đổi `APP_ORIGIN` trong `wrangler.jsonc` thành domain frontend production.
4. Đặt `DEMO_PAYMENTS_ENABLED` thành `"false"` trong production.
5. Tạo secret JWT:

```powershell
pnpm exec wrangler secret put JWT_SECRET --config apps/worker/wrangler.jsonc
```

6. Apply schema remote, seed và deploy Worker:

```powershell
pnpm d1:migrate:remote
pnpm exec wrangler d1 execute lumen-play --remote --file apps/worker/seed.sql --config apps/worker/wrangler.jsonc
pnpm worker:deploy
```

Lần deploy đầu sẽ tạo Durable Object `GameRoom` theo migration khai báo trong `wrangler.jsonc`.

7. Đặt URL Worker trả về vào `.env` trước khi build/deploy Nuxt:

```env
NUXT_PUBLIC_API_BASE=https://your-worker.your-account.workers.dev
```

Sau đó build frontend:

```powershell
pnpm build
```

## Lệnh thường dùng

```powershell
pnpm build                 # kiểm tra production build Nuxt
pnpm worker:dev            # chạy API/D1/DO local
pnpm d1:migrate:local      # apply migration local
pnpm d1:migrate:remote     # apply migration remote
pnpm d1:seed:local         # nạp seed local
pnpm worker:deploy         # deploy Worker
```

## Cấu trúc source

```text
app.vue                                  # UI Nuxt, lobby, auth, ví và Sic Bo
assets/css/main.css                      # giao diện
apps/worker/src/index.ts                 # API, JWT, D1 và Durable Object game room
apps/worker/migrations/0001_initial.sql  # schema D1
apps/worker/seed.sql                     # cấu hình và room demo ban đầu
apps/worker/wrangler.jsonc               # binding D1, Durable Object, biến môi trường
```

## An toàn triển khai

- Không thêm cổng thanh toán, QR thanh toán thật hoặc địa chỉ ví thật.
- Giữ `DEMO_PAYMENTS_ENABLED="false"` trên production.
- Không commit `.env` hoặc `apps/worker/.dev.vars`; chúng chứa URL/private secret riêng.
- Để reset local D1 trong lúc phát triển, xóa thư mục `apps/worker/.wrangler/state` rồi chạy lại migrate và seed.
