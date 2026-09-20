# Clawd Pet — Live Wallpaper (Android)

Pet sống ngay sau icon ở home screen, tự bị app khác/bong bóng chat che khi mở lên (cơ chế mặc định của live wallpaper, không phải overlay always-on-top).

**v1.1** — xem lịch sử thay đổi ở cuối file.

## Mở project

Project viết tay ban đầu (chưa có Gradle wrapper), Android Studio đã tự generate wrapper + `.idea/` khi mở lần đầu — cả hai bị `.gitignore` loại khỏi repo, máy khác mở lại vẫn tự tạo được.

1. Cài **Android Studio** (Gradle đi kèm sẵn).
2. `File → Open` → chọn thư mục `android-wallpaper/`.
3. Nếu hỏi "Gradle wrapper not found, create one?" → **OK**. Đợi sync xong.
4. **File → Settings → Build, Execution, Deployment → Build Tools → Gradle** → Gradle JDK chọn bản có sẵn (`jbr-17` hoặc tương đương) — không dùng JDK quá mới (25+), Kotlin plugin hiện tại không tương thích.

## Chạy / cài trên điện thoại

- **Chạy trực tiếp từ Android Studio**: bật USB debugging trên điện thoại (Settings → About phone → bấm 7 lần vào Build number → Developer Options → USB debugging), cắm dây, chọn máy trong dropdown → Run ▶️.
- **Đóng gói .apk để cài tay / gửi người khác**: Build → Build App Bundle(s)/APK(s) → **Build APK(s)** → file ra ở `app/build/outputs/apk/debug/app-debug.apk`. Người nhận mở file đó trên điện thoại → lần đầu Android chặn, vào thông báo bấm "Cho phép từ nguồn này" cho đúng app đang mở file (File Manager/Zalo/Drive...) → cài lại.
- Máy nhận cần Android 8.0 (API 26) trở lên.

## Dùng app

1. Mở app → 3 nhóm nút: **Chọn ảnh nền** (tuỳ chọn), **Cài đặt** (tên pet/câu chào/khoảng nhắc), **Đặt làm hình nền**.
2. Bấm "Đặt làm hình nền" → Android hiện màn xác nhận **của hệ thống** (không phải app tự vẽ, không cách nào bỏ qua bước này — quy định bảo mật OS) → Set wallpaper.
3. Về home screen: pet đi lại/nhảy ngẫu nhiên, thỉnh thoảng hiện bong bóng câu chào theo lịch đã cấu hình. Mở app khác → bị che. Quay về home → vẫn còn đó.
4. Kéo pet bằng ngón tay → thả ra → rơi xuống. Chạm giữ vùng đầu → pet vuốt ve (tim bay).

### Về việc mất hình nền cũ

Live wallpaper **chiếm đúng slot hình nền** của máy — không có cách nào giữ 2 wallpaper cùng lúc, đây là giới hạn cứng của Android. Cách né: bấm "Chọn ảnh nền" và chọn lại đúng ảnh bạn đang dùng làm nền trước đó — pet sẽ chạy đè lên trên, nhìn không khác gì trước, chỉ thêm con pet. Gỡ cài đặt app cũng làm mất wallpaper hiện tại (Android tự trả về nền mặc định khi service cung cấp wallpaper biến mất) — ảnh gốc vẫn còn nguyên trong máy, chỉ là hết active.

## Biết trước — giới hạn hiện tại

- **6 state**: idle, walk, jump, held (kéo), fall (thả), pat (vuốt đầu), think (câu chào). Chưa có code/coffee/music/soccer/climb/surf/parachute.
- **Kéo-thả phụ thuộc launcher**: đã bật `setTouchEventsEnabled(true)`, nhưng không phải launcher nào cũng forward đủ chuỗi touch move cho live wallpaper — một số chỉ gửi tap. Giới hạn của launcher, không sửa được từ phía app.
- **Chưa build/test bằng máy dev** — code viết dựa trên đọc kỹ API, build/test thật đều do user tự làm qua Android Studio. Báo lại nếu có lỗi biên dịch.
- **Kích thước pet**: `PET_SCREEN_FRACTION` trong `ClawdWallpaperService.kt` (đang 0.18 ≈ 18% chiều ngang màn hình).
- **Khoảng đệm đáy** (né thanh tìm kiếm/dock launcher): `EXTRA_BOTTOM_MARGIN_DP` cùng file (đang 110dp) — launcher có dock cao hơn thì tăng số này lên.

## Lịch sử thay đổi

- **v1.1**: thêm màn Settings (tên pet, câu chào, khoảng nhắc) + `Mode.THINK` hiện bong bóng thoại thật; nút chọn ảnh nền để giữ hình nền cũ; trừ system-bar insets + khoảng đệm đáy để pet không kẹt dưới nav bar/dock launcher; thu pet nhỏ lại (0.30 → 0.18); icon app pixel-art (adaptive icon).
- **v1.0**: bản đầu — pet roam tự do trên home screen dạng live wallpaper, kéo-thả/pat qua touch, tự dừng khi bị app khác che.
