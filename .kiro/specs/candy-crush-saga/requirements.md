# Tài Liệu Yêu Cầu: Candy Crush Saga (Web Mobile)

## Giới Thiệu

Tài liệu này mô tả các yêu cầu chức năng và phi chức năng cho game Candy Crush Saga trên trình duyệt web di động. Game cho phép người chơi hoán đổi các viên kẹo liền kề trên lưới để tạo chuỗi 3 kẹo cùng loại trở lên. Game không có điểm kết thúc — người chơi chơi liên tục mà không bị "game over". Hệ thống tự động đảm bảo luôn tồn tại ít nhất một nước đi hợp lệ thông qua cơ chế shuffle.

---

## Bảng Thuật Ngữ

- **Game_Manager**: Thành phần điều phối toàn bộ vòng lặp game, nhận input và gọi các engine xử lý.
- **Game_Board**: Thành phần quản lý lưới kẹo 2D, cung cấp API đọc/ghi vị trí kẹo.
- **Match_Engine**: Thành phần phát hiện và xử lý các chuỗi kẹo khớp (match).
- **Shuffle_Engine**: Thành phần kiểm tra nước đi hợp lệ và xáo trộn lưới khi cần.
- **Score_Manager**: Thành phần tính điểm và lưu điểm cao nhất.
- **Animation_Manager**: Thành phần quản lý hàng đợi và phát các hiệu ứng animation.
- **Visual_Designer**: Thành phần vẽ từng loại kẹo với hình dạng và gradient đặc trưng.
- **Particle_Engine**: Thành phần tạo và cập nhật hệ thống hạt particle.
- **Renderer**: Thành phần vẽ toàn bộ trạng thái game lên HTML5 Canvas.
- **Input_Handler**: Thành phần xử lý sự kiện chạm/kéo từ người dùng.
- **State_Machine**: Thành phần quản lý trạng thái game (IDLE, SWAPPING, MATCHING, v.v.).
- **Kẹo (Candy)**: Một ô trong lưới game, có loại (CandyType) và trạng thái đặc biệt (SpecialType).
- **Match**: Một chuỗi từ 3 kẹo cùng loại liền kề theo hàng hoặc cột.
- **Cascade**: Quá trình tự động phát hiện và xử lý match mới sau khi kẹo rơi xuống lấp đầy ô trống.
- **Swap**: Thao tác hoán đổi vị trí hai kẹo liền kề.
- **Nước đi hợp lệ**: Một swap mà khi thực hiện sẽ tạo ra ít nhất một match.
- **Kẹo sọc (Striped)**: Kẹo đặc biệt tạo ra từ match 4, xóa toàn bộ hàng hoặc cột khi kích hoạt.
- **Kẹo bọc (Wrapped)**: Kẹo đặc biệt tạo ra từ match hình L/T, nổ theo vùng 3×3 khi kích hoạt.
- **Bom màu (Color_Bomb)**: Kẹo đặc biệt tạo ra từ match 5, xóa tất cả kẹo cùng loại khi kích hoạt.
- **Combo**: Chuỗi cascade liên tiếp trong một lần swap, tăng hệ số nhân điểm.
- **Particle**: Hạt hiệu ứng nhỏ (tia lửa, ngôi sao, vòng nổ, vệt sáng) xuất hiện khi kẹo nổ.
- **Tile**: Một ô vuông trên lưới, kích thước tileSize × tileSize pixel.
- **HUD**: Giao diện hiển thị điểm số và combo trên màn hình.

---

## Yêu Cầu

### Yêu Cầu 1: Khởi Tạo Lưới Game

**User Story:** Là người chơi, tôi muốn bắt đầu game với một lưới kẹo hợp lệ, để tôi có thể chơi ngay mà không gặp tình huống bế tắc.

#### Tiêu Chí Chấp Nhận

1. THE Game_Board SHALL khởi tạo lưới kẹo 2D với kích thước mặc định 9 hàng × 9 cột.
2. WHEN Game_Board được khởi tạo, THE Game_Board SHALL đảm bảo không có match sẵn nào tồn tại trên lưới.
3. WHEN Game_Board được khởi tạo, THE Shuffle_Engine SHALL xác nhận tồn tại ít nhất một nước đi hợp lệ trên lưới.
4. WHEN quá trình khởi tạo tạo ra lưới không có nước đi hợp lệ, THE Game_Board SHALL thực hiện lại toàn bộ quá trình khởi tạo.
5. THE Game_Board SHALL gán mỗi kẹo một định danh duy nhất (id) để theo dõi animation.
6. THE Game_Board SHALL phân bổ loại kẹo ngẫu nhiên từ 6 loại: RED, ORANGE, YELLOW, GREEN, BLUE, PURPLE.

---

### Yêu Cầu 2: Xử Lý Input Người Chơi

**User Story:** Là người chơi, tôi muốn chạm và kéo để hoán đổi kẹo, để tôi có thể điều khiển game một cách tự nhiên trên màn hình cảm ứng.

#### Tiêu Chí Chấp Nhận

1. WHEN người chơi chạm vào màn hình, THE Input_Handler SHALL ghi nhận vị trí ô kẹo tương ứng với điểm chạm.
2. WHEN người chơi kéo ngón tay từ một ô sang ô liền kề theo 4 hướng (trên, dưới, trái, phải), THE Input_Handler SHALL gửi sự kiện swap đến Game_Manager.
3. WHEN sự kiện touchmove được nhận, THE Input_Handler SHALL ngăn hành vi cuộn trang mặc định của trình duyệt.
4. WHILE game đang trong trạng thái animation, THE Game_Manager SHALL bỏ qua mọi sự kiện swap mới từ Input_Handler.
5. THE Input_Handler SHALL chỉ nhận diện swap giữa hai ô liền kề trực tiếp (không chéo).

---

### Yêu Cầu 3: Phát Hiện và Xử Lý Match

**User Story:** Là người chơi, tôi muốn các chuỗi kẹo cùng loại được tự động phát hiện và xóa, để tôi nhận được điểm thưởng.

#### Tiêu Chí Chấp Nhận

1. WHEN một swap được thực hiện, THE Match_Engine SHALL quét toàn bộ lưới để tìm tất cả chuỗi kẹo cùng loại liền kề theo hàng ngang và cột dọc có độ dài từ 3 trở lên.
2. WHEN Match_Engine phát hiện các match chồng lấp nhau, THE Match_Engine SHALL gộp chúng thành một match duy nhất.
3. WHEN một swap không tạo ra bất kỳ match nào, THE Game_Manager SHALL hoàn tác swap và trả lưới về trạng thái ban đầu.
4. WHEN Match_Engine phát hiện một chuỗi 4 kẹo theo hàng ngang, THE Match_Engine SHALL phân loại match là MATCH_4 và tạo kẹo STRIPED_H tại vị trí pivot.
5. WHEN Match_Engine phát hiện một chuỗi 4 kẹo theo cột dọc, THE Match_Engine SHALL phân loại match là MATCH_4 và tạo kẹo STRIPED_V tại vị trí pivot.
6. WHEN Match_Engine phát hiện một chuỗi 5 kẹo, THE Match_Engine SHALL phân loại match là MATCH_5 và tạo kẹo COLOR_BOMB tại vị trí pivot.
7. WHEN Match_Engine phát hiện chuỗi hình chữ L, THE Match_Engine SHALL phân loại match là MATCH_L và tạo kẹo WRAPPED tại vị trí pivot.
8. WHEN Match_Engine phát hiện chuỗi hình chữ T, THE Match_Engine SHALL phân loại match là MATCH_T và tạo kẹo WRAPPED tại vị trí pivot.

---

### Yêu Cầu 4: Gravity và Refill

**User Story:** Là người chơi, tôi muốn kẹo rơi xuống lấp đầy ô trống và kẹo mới xuất hiện từ trên, để lưới luôn đầy kẹo sau mỗi lần match.

#### Tiêu Chí Chấp Nhận

1. WHEN các kẹo bị xóa khỏi lưới, THE Game_Board SHALL áp dụng gravity để các kẹo phía trên rơi xuống lấp đầy ô trống theo từng cột.
2. AFTER gravity được áp dụng, THE Game_Board SHALL đảm bảo trong mỗi cột không tồn tại ô null nằm giữa hai kẹo (tất cả ô null phải nằm ở phía trên cùng của cột).
3. WHEN một cột có ô null sau khi áp dụng gravity, THE Game_Board SHALL tạo kẹo mới ngẫu nhiên để lấp đầy các ô null từ trên xuống.
4. WHEN lưới đã được refill đầy đủ, THE Match_Engine SHALL kiểm tra lại toàn bộ lưới để phát hiện match mới (cascade).
5. WHILE cascade đang diễn ra, THE Game_Manager SHALL tiếp tục xử lý match, gravity và refill cho đến khi không còn match nào.

---

### Yêu Cầu 5: Hệ Thống Tính Điểm và Combo

**User Story:** Là người chơi, tôi muốn nhận điểm thưởng cho mỗi match và combo, để tôi có động lực cải thiện kỹ năng chơi.

#### Tiêu Chí Chấp Nhận

1. WHEN Match_Engine xóa một match MATCH_3, THE Score_Manager SHALL cộng 60 điểm vào điểm hiện tại.
2. WHEN Match_Engine xóa một match MATCH_4, THE Score_Manager SHALL cộng 120 điểm vào điểm hiện tại.
3. WHEN Match_Engine xóa một match MATCH_5, THE Score_Manager SHALL cộng 200 điểm vào điểm hiện tại.
4. WHEN Match_Engine xóa một match MATCH_L hoặc MATCH_T, THE Score_Manager SHALL cộng 150 điểm vào điểm hiện tại.
5. WHEN cascade xảy ra, THE Score_Manager SHALL nhân điểm của mỗi vòng cascade với hệ số combo tăng dần (vòng 1: ×1, vòng 2: ×2, vòng 3: ×3, ...).
6. WHEN điểm hiện tại vượt qua điểm cao nhất đã lưu, THE Score_Manager SHALL cập nhật điểm cao nhất.
7. THE Score_Manager SHALL lưu điểm cao nhất vào localStorage với key `candy-crush-highscore`.
8. WHEN game được khởi động lại, THE Score_Manager SHALL đọc và hiển thị điểm cao nhất từ localStorage.

---

### Yêu Cầu 6: Kẹo Đặc Biệt

**User Story:** Là người chơi, tôi muốn tạo và kích hoạt kẹo đặc biệt, để tôi có thể xóa nhiều kẹo hơn và đạt điểm cao hơn.

#### Tiêu Chí Chấp Nhận

1. WHEN kẹo STRIPED_H được kích hoạt, THE Match_Engine SHALL xóa toàn bộ hàng ngang chứa kẹo đó.
2. WHEN kẹo STRIPED_V được kích hoạt, THE Match_Engine SHALL xóa toàn bộ cột dọc chứa kẹo đó.
3. WHEN kẹo WRAPPED được kích hoạt, THE Match_Engine SHALL xóa tất cả kẹo trong vùng 3×3 xung quanh kẹo đó.
4. WHEN kẹo COLOR_BOMB được hoán đổi với một kẹo thường, THE Match_Engine SHALL xóa tất cả kẹo cùng loại với kẹo thường đó trên toàn bộ lưới.
5. WHEN kẹo đặc biệt được tạo ra từ một match, THE Game_Board SHALL đặt kẹo đặc biệt tại vị trí pivot của match đó.
6. WHEN kẹo đặc biệt bị xóa trong một cascade, THE Match_Engine SHALL kích hoạt hiệu ứng của kẹo đặc biệt đó trước khi tiếp tục cascade.

---

### Yêu Cầu 7: Shuffle Tự Động

**User Story:** Là người chơi, tôi muốn game tự động xáo trộn khi không còn nước đi, để tôi không bao giờ bị bế tắc và có thể chơi liên tục.

#### Tiêu Chí Chấp Nhận

1. WHEN cascade kết thúc và không còn match, THE Shuffle_Engine SHALL kiểm tra xem có tồn tại ít nhất một nước đi hợp lệ trên lưới không.
2. WHEN Shuffle_Engine xác định không còn nước đi hợp lệ, THE Shuffle_Engine SHALL tự động xáo trộn lưới bằng thuật toán Fisher-Yates.
3. AFTER shuffle, THE Shuffle_Engine SHALL đảm bảo lưới mới không có match sẵn và có ít nhất một nước đi hợp lệ.
4. AFTER shuffle, THE Shuffle_Engine SHALL đảm bảo tập hợp kẹo trên lưới không thay đổi (chỉ thay đổi vị trí).
5. WHEN shuffle lần đầu vẫn không tạo ra lưới hợp lệ, THE Shuffle_Engine SHALL lặp lại shuffle tối đa 100 lần.
6. WHEN sau 100 lần shuffle vẫn không hợp lệ, THE Shuffle_Engine SHALL khởi tạo lại toàn bộ lưới bằng Game_Board.
7. WHILE game đang ở trạng thái IDLE, THE Shuffle_Engine SHALL đảm bảo hasValidMoves(grid) luôn trả về true.

---

### Yêu Cầu 8: Hệ Thống Hiển Thị Kẹo

**User Story:** Là người chơi, tôi muốn nhìn thấy các viên kẹo với hình dạng và màu sắc đặc trưng đẹp mắt, để trải nghiệm game thú vị và hấp dẫn hơn.

#### Tiêu Chí Chấp Nhận

1. THE Visual_Designer SHALL vẽ kẹo RED dưới dạng hình trái tim với gradient từ `#FF6B7A` đến `#B01E30`.
2. THE Visual_Designer SHALL vẽ kẹo ORANGE dưới dạng hình thoi với gradient từ `#FFB347` đến `#C45E00`.
3. THE Visual_Designer SHALL vẽ kẹo YELLOW dưới dạng hình ngôi sao 6 cánh với gradient từ `#FFE94D` đến `#C4A000`.
4. THE Visual_Designer SHALL vẽ kẹo GREEN dưới dạng hình lá cỏ 4 lá với gradient từ `#5EE87A` đến `#1A8A28`.
5. THE Visual_Designer SHALL vẽ kẹo BLUE dưới dạng hình tròn với viền gợn sóng và gradient từ `#4AABFF` đến `#004A8F`.
6. THE Visual_Designer SHALL vẽ kẹo PURPLE dưới dạng hình lục giác với gradient từ `#C47FD5` đến `#6C3483`.
7. THE Visual_Designer SHALL vẽ mỗi kẹo theo pipeline 5 lớp: bóng đổ → thân kẹo → viền ngoài → highlight → icon đặc biệt.
8. WHEN kẹo là loại đặc biệt (STRIPED_H, STRIPED_V, WRAPPED, COLOR_BOMB), THE Visual_Designer SHALL vẽ icon tương ứng lên trên thân kẹo.
9. THE Renderer SHALL hỗ trợ retina display bằng cách nhân kích thước canvas với devicePixelRatio.
10. THE Renderer SHALL tự động điều chỉnh kích thước canvas theo kích thước màn hình thiết bị.

---

### Yêu Cầu 9: Hệ Thống Animation

**User Story:** Là người chơi, tôi muốn thấy các hiệu ứng animation mượt mà cho mọi hành động trong game, để trải nghiệm game sinh động và thú vị.

#### Tiêu Chí Chấp Nhận

1. WHILE game ở trạng thái IDLE, THE Animation_Manager SHALL phát animation idle bounce cho tất cả kẹo với chu kỳ ~3.5 giây, biên độ scale ±3% và dịch chuyển dọc ±2px.
2. WHEN người chơi chọn một kẹo, THE Animation_Manager SHALL phát animation phóng to kẹo lên 1.18× trong 80ms rồi thu về 1.12× trong 120ms, kèm hiệu ứng glow pulse liên tục.
3. WHEN một swap hợp lệ được thực hiện, THE Animation_Manager SHALL phát animation di chuyển hai kẹo đến vị trí của nhau trong 200ms với easing easeInOut.
4. WHEN một swap không hợp lệ được thực hiện, THE Animation_Manager SHALL phát animation kẹo di chuyển một phần về phía kẹo kia rồi quay lại với hiệu ứng rung nhẹ trong tổng 350ms.
5. WHEN kẹo bị xóa do match, THE Animation_Manager SHALL phát animation flash trắng 50ms, sau đó phóng to 1.4× và mờ dần trong 200ms.
6. WHEN kẹo rơi xuống sau gravity, THE Animation_Manager SHALL phát animation rơi với tốc độ 80ms + 0.6ms/px khoảng cách, kèm bounce 6px và squash scaleY 85% khi chạm đáy.
7. WHEN shuffle được kích hoạt, THE Animation_Manager SHALL phát animation thu nhỏ tất cả kẹo về trung tâm (300ms), hiệu ứng xoáy (200ms), rồi bay ra vị trí mới theo thứ tự staggered 15ms/kẹo (300ms).
8. WHEN combo đạt từ 2 trở lên, THE Animation_Manager SHALL hiển thị nhãn combo với animation phóng to và mờ dần trong 700ms.
9. WHEN combo đạt từ 4 trở lên, THE Animation_Manager SHALL phát hiệu ứng rung màn hình với cường độ tỉ lệ với số combo.
10. WHEN kẹo STRIPED được kích hoạt, THE Animation_Manager SHALL phát animation tia sáng quét qua toàn bộ hàng hoặc cột trong 300ms.
11. WHEN kẹo WRAPPED được kích hoạt, THE Animation_Manager SHALL phát animation vòng tròn nở ra hai lần (bán kính 1.5× và 2.5× tileSize) trong tổng 550ms.
12. WHEN kẹo COLOR_BOMB được kích hoạt, THE Animation_Manager SHALL phát animation tia sét bay đến từng kẹo mục tiêu với độ trễ tỉ lệ theo khoảng cách.
13. THE Animation_Manager SHALL đảm bảo các animation không chồng chéo nhau bằng cách sử dụng hàng đợi animation.

---

### Yêu Cầu 10: Hệ Thống Particle

**User Story:** Là người chơi, tôi muốn thấy hiệu ứng hạt particle khi kẹo nổ, để trải nghiệm game có chiều sâu và cảm giác thỏa mãn hơn.

#### Tiêu Chí Chấp Nhận

1. WHEN kẹo bị xóa do match, THE Particle_Engine SHALL tạo 8 hạt SPARK tại vị trí kẹo với màu tương ứng loại kẹo.
2. WHEN combo xảy ra, THE Particle_Engine SHALL tạo hạt STAR với số lượng tỉ lệ theo số combo (10 hạt cho combo ×2, 20 hạt cho combo ×3 trở lên).
3. WHEN shuffle được kích hoạt, THE Particle_Engine SHALL tạo 20 hạt BURST tại trung tâm lưới.
4. WHEN kẹo STRIPED được kích hoạt, THE Particle_Engine SHALL tạo 20 hạt TRAIL dọc theo đường quét.
5. WHEN kẹo WRAPPED được kích hoạt, THE Particle_Engine SHALL tạo 16 hạt BURST tại vị trí kẹo.
6. THE Particle_Engine SHALL cập nhật vị trí, vận tốc và vòng đời của mỗi hạt theo deltaTime mỗi frame.
7. THE Particle_Engine SHALL tự động xóa hạt khi vòng đời (life) giảm về 0.
8. THE Particle_Engine SHALL giới hạn tổng số hạt đồng thời tối đa 300 hạt để đảm bảo hiệu năng trên mobile.
9. THE Particle_Engine SHALL tái sử dụng object hạt thông qua object pool với kích thước ~200 để tránh garbage collection.

---

### Yêu Cầu 11: Vòng Lặp Game và State Machine

**User Story:** Là người chơi, tôi muốn game phản hồi chính xác và nhất quán với mọi thao tác của tôi, để trải nghiệm game mượt mà và không bị lỗi.

#### Tiêu Chí Chấp Nhận

1. THE Game_Manager SHALL duy trì vòng lặp game sử dụng requestAnimationFrame, không sử dụng setInterval.
2. THE State_Machine SHALL quản lý các trạng thái: IDLE, SWAPPING, MATCHING, REMOVING, REFILLING, CASCADING, CHECKING, SHUFFLING.
3. WHEN State_Machine ở trạng thái IDLE và người chơi thực hiện swap, THE State_Machine SHALL chuyển sang trạng thái SWAPPING.
4. WHEN swap tạo ra match, THE State_Machine SHALL chuyển tuần tự qua các trạng thái MATCHING → REMOVING → REFILLING → CASCADING.
5. WHEN swap không tạo ra match, THE State_Machine SHALL quay về trạng thái IDLE sau khi hoàn tác animation.
6. WHEN CASCADING không tìm thấy match mới, THE State_Machine SHALL chuyển sang CHECKING.
7. WHEN CHECKING xác nhận có nước đi hợp lệ, THE State_Machine SHALL chuyển về IDLE.
8. WHEN CHECKING xác nhận không có nước đi hợp lệ, THE State_Machine SHALL chuyển sang SHUFFLING.
9. WHEN SHUFFLING hoàn tất, THE State_Machine SHALL chuyển về IDLE.

---

### Yêu Cầu 12: Hiệu Năng và Tối Ưu Hóa

**User Story:** Là người chơi trên thiết bị di động, tôi muốn game chạy mượt mà, để tôi có trải nghiệm chơi game tốt ngay cả trên thiết bị cấu hình thấp.

#### Tiêu Chí Chấp Nhận

1. THE Renderer SHALL sử dụng HTML5 Canvas thay vì DOM để tránh reflow/repaint khi animate nhiều kẹo đồng thời.
2. THE Visual_Designer SHALL cache CanvasGradient cho từng loại kẹo và tái sử dụng qua các frame thay vì tạo mới mỗi frame.
3. THE Shuffle_Engine SHALL sử dụng early return trong hasValidMoves ngay khi tìm thấy nước đi hợp lệ đầu tiên.
4. THE Animation_Manager SHALL sử dụng sin wave đơn giản cho idle animation thay vì tween riêng cho từng kẹo.
5. IF trình duyệt không hỗ trợ HTML5 Canvas, THEN THE Renderer SHALL hiển thị thông báo lỗi cho người dùng.

---

### Yêu Cầu 13: Lưu Trữ Dữ Liệu

**User Story:** Là người chơi, tôi muốn điểm cao nhất của mình được lưu lại giữa các phiên chơi, để tôi có thể theo dõi tiến bộ của mình.

#### Tiêu Chí Chấp Nhận

1. THE Score_Manager SHALL lưu điểm cao nhất vào localStorage với key `candy-crush-highscore` ngay khi điểm hiện tại vượt qua điểm cao nhất.
2. WHEN game khởi động, THE Score_Manager SHALL đọc điểm cao nhất từ localStorage và hiển thị trên HUD.
3. IF localStorage không khả dụng hoặc không có dữ liệu, THEN THE Score_Manager SHALL sử dụng giá trị mặc định là 0 cho điểm cao nhất.
4. THE Game_Manager SHALL không gửi bất kỳ dữ liệu người dùng nào lên server (toàn bộ logic chạy client-side).
