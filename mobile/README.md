# Clawd Pet — Mobile (Expo)

App React Native/Expo: pet sống trong một khung cố định bên trong app (không phải widget hệ thống, không chạy nền ngoài home screen) — mở app lên là thấy pet đi lại/làm trò trong khung đó.

**v1.1.0**

## Chạy thử

```bash
cd mobile
npm install
npm start
```

Quét QR bằng app **Expo Go** (Android/iOS), hoặc:

```bash
npm run android   # cần Android Studio/emulator hoặc máy thật qua adb
npm run ios       # cần macOS + Xcode
npm run web       # xem nhanh trong trình duyệt, không cần điện thoại
```

Mỗi lệnh trên đều tự chạy `build:pet-html` trước khi khởi động Expo — xem mục dưới.

## Cách hoạt động

Pet là một trang HTML/SVG/CSS chạy trong `react-native-webview`, gần như port nguyên bản renderer của bản desktop (Electron) sang chạy độc lập trong WebView — không có main process, không IPC, toàn bộ state machine (đi lại, tricks, kéo-thả, bong bóng nhắc nhở) gộp chung vào một file `engine.js` chạy ngay trong trang.

`react-native-webview`'s `source={{ html }}` chỉ nhận **một string HTML duy nhất** (cách duy nhất chạy multi-file HTML/CSS/JS giống nhau trên Android/iOS/Expo Go) — nên không thể `<link>`/`<script src>` tới file rời lúc runtime như bên desktop. Giải pháp: viết code trong `src/widget/assets/pet-web/` như bình thường (nhiều file, dễ đọc/sửa), rồi build script gộp hết thành một string:

```bash
node scripts/build-pet-html.js
```

lệnh này đọc `index.html` + `css/*.css` + `engine.js`, inline hết vào `src/widget/petHtml.js` (**auto-generated, đừng sửa tay file này** — sửa xong ở `pet-web/` rồi chạy lại lệnh trên, hoặc cứ `npm start` vì đã tự chạy sẵn).

## Chọn pet & tricks

Giống bản desktop — chọn trong màn **Cài đặt** (nút ⚙ góc phải): **Clawd** (mèn con gốc), **Mèo**, hoặc **Cừu**. `index.html` chứa sẵn cả 3 template (`<script type="text/svg-template" id="tpl-clawd/cat/sheep">`), `engine.js` đọc `petModel` lúc boot và swap đúng template vào `#creature` — đổi model trong Settings sẽ remount lại WebView (key theo `petModel`) để load đúng con.

Trick pool cũng gate theo model y hệt desktop (`engine.js`, hàm `nextAction()`):
- **Clawd**: đủ 8 trick — `code`, `music`, `soccer`, `jump`, `climb`, `surf`, `think`, `coffee`.
- **Mèo**: `jump`, `climb`, `think`, cộng thêm `butterfly` (rình rồi vồ một con bướm bay lượn).
- **Cừu**: `jump`, `climb`, `think`.

Chân (và đuôi của mèo) được cắt ra từ `cat.png`/`sheep.png` gốc bằng `clip-path` rồi ghép lại thành mảnh riêng animate được — xem chi tiết kỹ thuật ở [README gốc](../README.md#project-structure).

## Project structure

```
App.js                        Điều hướng Home ↔ Settings, load/save config
index.js                      Expo entry point
app.json                      Cấu hình Expo (tên, icon, version)
scripts/
  build-pet-html.js            Gộp pet-web/ thành src/widget/petHtml.js
src/
  screens/
    HomeScreen.js               Hiển thị WidgetBox + nút mở Settings
    SettingsScreen.js           Tên pet, chọn model, câu chào, khoảng nhắc
  storage/
    config.js                   AsyncStorage load/save config
  widget/
    WidgetBox.js                Bọc react-native-webview, đẩy settings vào
    petHtml.js                  AUTO-GENERATED — đừng sửa tay
    assets/pet-web/
      index.html                 3 template SVG (clawd/cat/sheep) + khung stage/bubble
      engine.js                  Toàn bộ state machine + renderer, chạy trong WebView
      css/                       base.css / states.css / keyframes.css — sync 1:1 với
                                  bản desktop (renderer/css/), copy nguyên khi có thay đổi
```

## Hạn chế hiện tại

- Không có màn hình "chọn pet lần đầu" riêng như desktop — gộp thẳng vào Settings cho gọn, vì app không có khái niệm first-run wall.
- Đổi `petModel` trong Settings sẽ làm WebView remount (nháy một chút) — chấp nhận được vì template chỉ chọn một lần lúc engine boot, không hot-swap sống được.
- Không có AFK/dodge theo con trỏ chuột (không có khái niệm cursor trên mobile) — luôn dùng trick pool ngẫu nhiên.
- Chưa test thật trên thiết bị Android/iOS — mới verify bằng cách dựng lại đúng string `PET_HTML` và mở trong trình duyệt. Báo lại nếu chạy qua Expo Go bị khác.

## Contributing

- Sửa gì trong `src/widget/assets/pet-web/` xong nhớ chạy `node scripts/build-pet-html.js` (hoặc `npm start`) trước khi test — sửa `petHtml.js` trực tiếp sẽ bị ghi đè lần build sau.
- Thêm trick mới: thêm vào mảng `tricks` trong `nextAction()` (`engine.js`), gate theo `model` nếu trick cần prop mà không phải con nào cũng có, rồi thêm `body.<state>` tương ứng vào `css/states.css` — nhớ đồng bộ ngược lại cả bản desktop (`main.js` + `renderer/css/states.css`) nếu muốn trick áp dụng cho cả hai.
