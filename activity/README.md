# Clawd Pet — Discord Activity

Bản port của clawd-pet (Electron) thành một **Discord Activity**: pet pixel-art đi dạo trong "sân" cố định bên trong khung Activity ở voice channel. Không dùng bot user, chỉ một Application trên Discord Developer Portal.

Bản Electron ở thư mục gốc **không bị sửa**; toàn bộ code nằm trong `activity/`.

## Trạng thái

| Phase | Nội dung | Trạng thái |
|---|---|---|
| 1 | Pet chạy local ở mỗi client, đăng nhập Discord (`identify`), bubble chào tên/avatar | Xong, chưa test trong Discord (cần bước tay bên dưới) |
| 2 | WebSocket, room key = `sdk.instanceId`, cả voice channel thấy chung một pet, nút cho ăn / vuốt ve | Xong, đã test 2 client cục bộ; chưa test nhiều người trong Discord |

## Phase 2: một pet chung cho cả voice channel

Mỗi Activity instance (một voice channel đang chạy Activity) có một `sdk.instanceId` duy nhất. Client gửi nó làm **room key**; server giữ **một `PetBrain` cho mỗi room**.

```
Client A ─┐                        ┌─ tick 30ms: PetBrain.update()
Client B ─┼── WebSocket /ws ──▶ Room ─┤
Client C ─┘     (JSON)              └─ ~15 lần/giây: snapshot {x, ry, tags, care, food} ──▶ mọi client
```

Vì sao **server giữ simulation** (thay vì để một client làm "host"):

- `PetBrain` là TypeScript thuần nên chạy được y nguyên trong Node: một nguồn sự thật, không cần bầu host, host thoát không làm pet đứng hình.
- Người vào sau nhận ngay trạng thái hiện tại trong `welcome`.
- Quy tắc tranh chấp nằm một chỗ: **chỉ một người kéo pet tại một thời điểm** (người thứ hai bị từ chối), hover vuốt ve của bất kỳ ai đều tính, "AFK" nghĩa là *không ai* di chuột 12 giây.

Vì sao **thế giới chuẩn rộng 2000 đơn vị** (`WORLD_WIDTH`): khung Activity mỗi người một cỡ. Nếu sân co giãn theo từng người thì thùng gỗ và vị trí pet lệch nhau giữa các máy. Nên bề ngang cố định (client chỉ scale theo bề ngang khung), còn chiều cao phần trời tùy khung; vị trí dọc gửi dưới dạng `ry` = khoảng cách so với mặt đất.

Phía client:

- `NetSource` nhận snapshot và **nội suy** vị trí (làm mượt, không giật theo 15Hz). Trạng thái/animation (`tags`) đổi ngay.
- Người đang kéo pet thấy pet bám theo chuột ngay (dự đoán cục bộ), người khác thấy qua snapshot.
- Mất kết nối thì tự rơi về pet **local** (pet không bao giờ biến mất), tự nối lại với backoff 1–10 giây.
- Bubble care do server phát (cả room thấy cùng một câu); bubble chào tên chỉ hiện với người đó.

Tính năng mới:

- **Cho ăn**: nút ở góc trái. Một cái bánh rơi từ trên xuống sân; pet đi tới, cúi tay xuống nhặt, nhấc lên, thảy vào miệng (bánh bay theo đường vòng cung và nhỏ dần) rồi nhai. Bị kéo giữa chừng thì bánh rơi lại xuống đất. Mỗi lúc chỉ một cái bánh. Toast "<tên> đã cho ăn" hiện cho cả room. Các điểm tay/miệng nằm trong `anchors` của sprite config.
- **Vuốt ve**: nút ở góc trái (hoặc rê/chạm đầu pet). Toast "<tên> đang vuốt ve".
- Số người trong room hiện cạnh hai nút (rê chuột để xem tên).

Test hai client không cần Discord: mở hai tab `http://localhost:5173/?room=abc&name=An` và `...?room=abc&name=Binh` (cần chạy cả API: `npm run dev`).

Giới hạn hiện tại (chưa làm, cố ý để đơn giản): WebSocket **không xác thực**: server tin `room` và `name` client gửi. Với server Discord riêng tư thì ổn; nếu mở rộng thì gửi `access_token` trong `join` và server kiểm tra với `GET /users/@me`.

## Port từ Electron như thế nào

Bản Electron không dùng sprite sheet: pet là **một SVG vẽ tay (từng `<rect>`) được animate bằng CSS class** (`states.css` + `keyframes.css`), còn `tick()` trong `main.js` là state machine + physics.

| Phần Electron | Trong Activity |
|---|---|
| `main.js` `tick()` (idle/walk/surf/climb/code/jump/music/soccer/think/coffee/pat/fall/held, AFK, thả rơi + dù) | `src/engine/brain.ts` — `PetBrain`, thuần TypeScript, không DOM, không timer; cùng hằng số (tick 30ms, tốc độ đi, gravity, 35% có dù, 50% sợ) |
| `renderer/pet.js` toggle class `body.<state>` | `PetBrain.tags()` trả về danh sách tag (`fall`, `chute`, `scared`, `hang`...) |
| `index.html` SVG + `states.css` + `keyframes.css` | `src/sprites/clawd.ts` — cây node (rect/group) + poses + animations dạng **data** |
| (CSS animation của trình duyệt) | `src/engine/anim.ts` + `renderer.ts` — vẽ lên `<canvas>`, nội suy keyframe giống CSS |
| Cửa sổ trong suốt, roam taskbar, kéo ra ngoài màn hình, tray, settings, `screen.getCursorScreenPoint` | **Bỏ**. Thay bằng sân cố định bề ngang (`src/engine/yard-layout.ts`) và pointer event trên canvas |
| Care bubble mỗi 60–75 phút (`bubble.html`) | `src/ui/bubble.ts` (DOM) + `src/data/care.ts` — cùng tần suất, cùng 7 câu mặc định |

Khác biệt có chủ đích so với bản desktop:

- **Né con trỏ (dodge) bị bỏ.** Trên desktop con trỏ là thứ duy nhất tương tác với pet; trong Activity bạn cần chuột để kéo/vuốt ve nên pet né sẽ rất khó chịu.
- **AFK** vẫn còn: 12 giây không di chuyển chuột trong khung, pet đi lại gần vị trí chuột cuối.
- **Climb** trước đây leo "trong không khí"; giờ pet đi tới hàng rào gần nhất rồi mới leo.
- **Vật cản**: tảng đá và thùng gỗ. Pet đi qua thì bước lên trên; thả rơi xuống thì đáp lên trên.
- **Vuốt ve**: rê chuột lên đầu (như desktop) hoặc **chạm/click vào đầu** (cho mobile không có hover).
- Mô hình **cat / sheep chưa port** (xem "Thêm pet model mới").

## Cấu trúc

```
activity/
├── server/
│   ├── index.ts             Express: POST /api/token (giữ client secret) + WebSocket /ws
│   └── room.ts              Room (1 PetBrain / room), xử lý message, RoomRegistry
├── src/
│   ├── main.ts              Khởi động, chọn sprite, đăng nhập Discord, vào room
│   ├── game.ts              Vòng lặp, canvas, pointer, bubble, chọn nguồn local/net
│   ├── engine/              Thuần TS, không DOM/Discord (chạy cả ở client lẫn server)
│   │   ├── brain.ts         State machine + physics
│   │   ├── anim.ts          Keyframe sampler (giống CSS keyframes)
│   │   ├── renderer.ts      Vẽ cây node lên canvas, blink, flip (chỉ client)
│   │   ├── yard-layout.ts   Kích thước thế giới 2000 + vật cản (dùng chung client/server)
│   │   └── geometry.ts, types.ts
│   ├── shared/protocol.ts   Kiểu message WebSocket
│   ├── source/              PetSource: local.ts (guest), net.ts (room), types.ts
│   ├── sprites/             clawd.ts + meta.ts (body/tricks, server dùng) + dsl.ts + index.ts
│   ├── yard/yard.ts         Vẽ nền, vật cản, bánh
│   ├── discord/auth.ts      SDK: ready → authorize → /api/token → authenticate
│   ├── ui/                  bubble.ts, hud.ts (nút, số người, toast)
│   └── data/                messages.ts (câu care), care.ts (tần suất local)
├── tsconfig.server.json
└── vite.config.ts
```

## Cài đặt & chạy thử không cần Discord

```bash
cd activity
npm install
npm run dev:web
```

`dev:web` chỉ chạy Vite (đủ để xem pet ở guest mode). Chạy luôn API + WebSocket bằng `npm run dev` (hoặc `npm run dev:tunnel` khi test trong Discord). Server chạy bằng `tsx` nên import trực tiếp được code TypeScript trong `src/engine`. Lưu ý `tsx watch` chỉ theo dõi file code, **đổi `.env` thì phải restart**.

Mở `http://localhost:5173`. Ngoài Discord (không có `?frame_id=` trên URL) app tự chạy **guest mode**: bỏ qua SDK và đăng nhập, pet vẫn chạy đầy đủ. Tiện để chỉnh sprite/hành vi mà không cần tunnel.

Tham số URL để test:

- `?careMin=0.05&careMax=0.08` — bubble nhắc nhở sau 3–5 giây thay vì 60–75 phút (đơn vị: phút).
- `?room=abc&name=An` — vào room dùng chung (cần API chạy); xem "Phase 2".
- `?model=clawd` — chọn sprite (xem `src/sprites/index.ts`).

Ở chế độ dev có `window.__game` (ví dụ `__game.brain.update(60000)` để tua thời gian).

## Chạy trong Discord (Developer Portal + tunnel)

### Vì sao cần tunnel?

Discord client không tải Activity từ `localhost` của bạn. Nó mở một iframe trỏ tới **`<APP_ID>.discordsays.com`** (proxy của Discord), proxy này chuyển request tới URL bạn khai báo trong *URL Mapping*. Máy chủ của Discord không thấy được `localhost`, nên cần một URL HTTPS công khai trỏ về máy bạn. `cloudflared` làm việc đó miễn phí, không cần tài khoản.

### 1. Tạo Application

1. Vào <https://discord.com/developers/applications> → **New Application** → đặt tên.
2. Tab **General Information** → copy **Application ID**. Đây là `CLIENT_ID`.
3. Tab **OAuth2**:
   - **Client Secret → Reset Secret** → copy (chỉ hiện một lần). Đây là `CLIENT_SECRET`.
   - Mục **Redirects** → thêm một URL bất kỳ, ví dụ `https://127.0.0.1`. Flow Activity không redirect thật, nhưng Portal yêu cầu có ít nhất một redirect để dùng Authorization Code.

*Vì sao cần secret?* Bước đổi `code` → `access_token` bắt buộc gửi `client_secret`. Ai có secret có thể mạo danh app của bạn, nên nó chỉ được nằm ở server (`.env`), không bao giờ ở code frontend.

### 2. Bật Activities

1. Tab **Activities** → **Settings** → bật **Enable Activities**.
2. Discord sẽ tự tạo lệnh *Entry Point* ("Launch") để mở Activity.
3. Mục **Installation** → dùng **Install Link** để cài app vào server **Vey Kaelis** (cần quyền *Manage Server*). Chỉ chọn scope `applications.commands`, **không** thêm `bot` — Activity không cần bot user.
4. Trong Discord: *User Settings → Advanced → Developer Mode* (nên bật), và chỉ chủ app / thành viên Team mới chạy được Activity khi app chưa publish — dùng đúng tài khoản chủ app khi test.

### 3. Tạo `.env`

```bash
cp .env.example .env
```

```env
VITE_DISCORD_CLIENT_ID=<Application ID>
DISCORD_CLIENT_SECRET=<Client Secret>
PORT=3001
```

*Vì sao client id có tiền tố `VITE_` còn secret thì không?* Vite chỉ đưa các biến bắt đầu bằng `VITE_` vào bundle trình duyệt. Client ID là thông tin công khai (có trong URL OAuth) nên đưa vào frontend được; secret thì tuyệt đối không.

### 4. Chạy app + tunnel

```bash
npm run dev:tunnel
```

Lệnh này chạy đồng thời Vite (cổng 5173) và Express (cổng 3001). Vite proxy `/api/*` sang Express, nên trình duyệt chỉ cần gọi `/api/token` (cùng origin, hợp CSP của Discord).

`dev:tunnel` chạy Vite với `--mode tunnel` để websocket HMR dùng cổng 443; nếu không, qua proxy HTTPS của Discord client HMR sẽ cố nối vào cổng dev và có thể làm trang tự reload liên tục.

Cài và mở tunnel ở terminal khác:

```bash
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:5173
```

Nó in ra một URL dạng `https://tên-ngẫu-nhiên.trycloudflare.com`. **URL này đổi mỗi lần chạy lại**, nên mỗi lần phải cập nhật bước 5.

### 5. URL Mapping

Tab **Activities → URL Mappings**:

| Prefix | Target |
|---|---|
| `/` | `tên-ngẫu-nhiên.trycloudflare.com` (chỉ domain, **không** có `https://`) |
| `/discord-cdn` *(tùy chọn)* | `cdn.discordapp.com` |

- Dòng `/` là bắt buộc: nó bảo proxy "mọi request tới `<APP_ID>.discordsays.com/...` hãy lấy từ tunnel của tôi".
- Dòng `/discord-cdn` chỉ để hiện **avatar** trong bubble chào. CSP của Activity chặn gọi thẳng domain ngoài, nên ảnh phải đi qua `/.proxy/discord-cdn/...`. Không thêm cũng không sao: bubble chỉ hiện tên, không có avatar.

Font (Be Vietnam Pro) và mọi asset được bundle trong build, không gọi domain ngoài.

### 6. Mở Activity

Vào một voice channel của Vey Kaelis → biểu tượng **Activities** (tên lửa) → chọn app của bạn. Lần đầu Discord hỏi quyền `identify`; sau khi đồng ý, pet nói "Chào <tên>!".

## Luồng Discord SDK (phase 1)

`src/discord/auth.ts`:

1. `new DiscordSDK(CLIENT_ID)` + `await sdk.ready()` — chờ handshake với Discord client (iframe ↔ client qua postMessage).
2. `sdk.commands.authorize({ scope: ['identify'], response_type: 'code', prompt: 'none' })` — Discord client hiện hộp xin quyền, trả về một `code` dùng một lần.
3. `POST /api/token { code }` (server) — server gọi `https://discord.com/api/oauth2/token` kèm `client_secret`, trả `{ access_token }`.
4. `sdk.commands.authenticate({ access_token })` — báo cho Discord client biết phiên này đã đăng nhập; trả về thông tin user.
5. `Game.say("Chào <tên>!")` — chỉ dùng tên/avatar cho bubble. Pet vẫn chạy local ở mỗi client.

Nếu bước đăng nhập lỗi, pet vẫn chạy (guest) và hiện bubble báo lỗi; chi tiết lỗi ở console của Discord (Ctrl+Shift+I).

## Thêm pet model mới (cừu, thỏ, mèo)

Engine không biết gì về từng model. Chỉ cần:

1. Tạo `src/sprites/<tên>.ts` export một `SpriteConfig` (xem `clawd.ts` làm mẫu):
   - `root`: cây `group` / `rect` / `image` (`image` dùng `import url from './x.png'` để bundle; hỗ trợ `clip`).
   - `names` đặt tên các node (`bob`, `arm-l`, `leg-a`, `eye`, ...) để pose trỏ tới.
   - `poses`: key là tổ hợp tag nối bằng `.` (ví dụ `"fall.chute"`); cascade giống CSS — nhiều tag hơn thì thắng. Mỗi pose có `show` / `hide` / `anim` / `stop` / `set` / `origin`.
   - `tricks`: tên các trick model này làm (`code`, `jump`, `music`, `soccer`, `climb`, `surf`, `think`, `coffee`, `butterfly`).
   - `body`, `hitbox`, `headZone`, `flipAxisX`, `faces`.
2. Đăng ký vào `src/sprites/index.ts`.
3. Mở `?model=<tên>`.

Mẹo: cat/sheep ở bản Electron là ảnh PNG tĩnh + CSS `clip-path`, nên khi port chỉ cần node `image` + `clip` và animate các group bao quanh (`bob`, `tail`...).

## Việc bạn phải tự làm tay (phase 1)

- [ ] Tạo Application, lấy Application ID + Client Secret, thêm redirect `https://127.0.0.1`.
- [ ] Bật Activities, cài app vào server Vey Kaelis (scope `applications.commands`, không chọn `bot`).
- [ ] `cp .env.example .env` và điền `VITE_DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`.
- [ ] `npm run dev:tunnel`, `cloudflared tunnel --url http://localhost:5173`.
- [ ] Dán domain tunnel vào URL Mapping `/` (và `/discord-cdn` → `cdn.discordapp.com` nếu muốn avatar). Làm lại mỗi lần đổi tunnel.
- [ ] Mở Activity trong voice channel và kiểm tra: pet hiện, bubble chào đúng tên, kéo/thả/vuốt ve được.
- [ ] Nếu lỗi: Ctrl+Shift+I trong Discord client → Console / Network (kiểm tra `/api/token`).

### Phase 2

- [ ] Dừng `npm run dev:tunnel` đang chạy (Ctrl+C) và chạy lại: script API đã đổi từ `node --watch` sang `tsx watch`, và Vite cần nạp proxy `/ws` mới. **Tunnel `cloudflared` giữ nguyên, không cần đổi URL Mapping.**
- [ ] Mở Activity trong voice channel cùng một người nữa (hoặc hai tài khoản): cả hai thấy **cùng một pet**, số người hiện cạnh nút.
- [ ] Bấm **Cho ăn** / **Vuốt ve** ở máy này, kiểm tra máy kia thấy bánh, pet đi ăn, toast tên người bấm.
- [ ] Hai người cùng kéo pet: người thứ hai bị từ chối (pet không giật).
- [ ] Nếu không thấy số người / pet đứng yên: Ctrl+Shift+I → Network → lọc `ws`: kết nối `/ws` phải ở trạng thái 101. Client tự thử cả `/ws` lẫn `/.proxy/ws`; báo mình URL nào thành công/thất bại.

## Đã kiểm tra / chưa kiểm tra

- Đã (phase 2): hai tab trình duyệt cùng room qua server thật: đồng bộ trạng thái, cho ăn (đi → ăn → xong), vuốt ve, từ chối kéo thứ hai, thả rơi, mất server → rơi về local → tự nối lại ~5 giây; `tsc` cả client lẫn server sạch.
- Chưa (phase 2): nhiều người trong Discord thật, đường WebSocket qua proxy của Discord, độ trễ khi kéo qua tunnel.
- Đã (phase 1): `tsc --noEmit` sạch; chạy trong trình duyệt ở guest mode (render, bubble, kéo-thả-rơi, pose code / fall+chute+scared); mô phỏng 400k tick không ra khỏi sân và chạm đủ mọi trick; server trả 400 khi thiếu `code` và gọi được endpoint thật của Discord.
- Chưa: chạy bên trong Discord (cần Portal + tunnel của bạn), các pose music / soccer / coffee / surf / climb mới chỉ kiểm tra qua state machine chứ chưa nhìn bằng mắt, avatar qua `/discord-cdn`.
