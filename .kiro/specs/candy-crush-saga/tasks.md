# Kế Hoạch Triển Khai: Candy Crush Saga (Web Mobile)

## Tổng Quan

Triển khai game Candy Crush Saga trên HTML5 Canvas + TypeScript, tối ưu cho mobile. Các task được sắp xếp từ nền tảng (types, data model) đến tính năng phức tạp (animation, particle, visual), đảm bảo mỗi bước đều tích hợp vào hệ thống trước đó.

---

## Tasks

- [x] 1. Thiết lập cấu trúc dự án và định nghĩa kiểu dữ liệu
  - Tạo `src/types.ts` với toàn bộ interface và enum: `CandyType`, `SpecialType`, `CandyAnimState`, `Candy`, `BoardState`, `Match`, `MatchType`, `GameState`, `GameStatus`, `Position`, `SwapPair`, `Grid`, `Direction`, `AnimationClip`, `EasingFn`, `Particle`, `ParticleType`, `FallInfo`, `SwapResult`, `CascadeResult`, `CandyVisual`, `CandyShape`, `DrawOptions`
  - Tạo `src/index.html` với canvas element, meta viewport cho mobile, và script entry point
  - Tạo `src/main.ts` với khởi tạo canvas, khởi tạo GameManager, và vòng lặp requestAnimationFrame
  - _Yêu Cầu: 1.5, 1.6, 11.1_

- [x] 2. Triển khai GameBoard — quản lý lưới kẹo
  - [x] 2.1 Tạo `src/GameBoard.ts` với khởi tạo lưới và API cơ bản
    - Implement `initBoard(rows, cols)`: tạo lưới 9×9, gán kẹo ngẫu nhiên tránh match sẵn theo thuật toán trong design §2.2
    - Implement `getCandy(pos)`, `setCandy(pos, candy)`, `swapCandies(pos1, pos2)`
    - Implement `applyGravity()`: kẹo rơi xuống theo từng cột, null nằm trên cùng (design §2.7)
    - Implement `refill()`: lấp đầy ô null bằng kẹo ngẫu nhiên (design §2.7)
    - Sử dụng bộ đếm id tăng dần để đảm bảo id kẹo duy nhất
    - _Yêu Cầu: 1.1, 1.2, 1.4, 1.5, 1.6, 4.1, 4.2, 4.3_

  - [ ]* 2.2 Viết property test cho GameBoard — khởi tạo không có match sẵn
    - **Property 1: Khởi tạo không có match sẵn**
    - **Validates: Yêu Cầu 1.2**

  - [ ]* 2.3 Viết property test cho GameBoard — id kẹo là duy nhất
    - **Property 3: ID kẹo là duy nhất**
    - **Validates: Yêu Cầu 1.5**

  - [ ] 2.4 Viết property test cho GameBoard — loại kẹo hợp lệ
    - **Property 4: Loại kẹo hợp lệ**
    - **Validates: Yêu Cầu 1.6**

  - [ ] 2.5 Viết property test cho applyGravity — không có ô null giữa các kẹo
    - **Property 10: Gravity đảm bảo không có ô null giữa các kẹo**
    - **Validates: Yêu Cầu 4.1, 4.2**

  - [ ] 2.6 Viết property test cho refill — lấp đầy toàn bộ ô null
    - **Property 11: Refill lấp đầy toàn bộ ô null**
    - **Validates: Yêu Cầu 4.3**

- [x] 3. Triển khai MatchEngine — phát hiện và xử lý match
  - [x] 3.1 Tạo `src/MatchEngine.ts` với phát hiện match cơ bản
    - Implement `findAllMatches(grid)`: quét ngang và dọc, thu thập run ≥ 3, gộp match chồng lấp (design §2.3)
    - Implement `mergeOverlappingMatches(matches)`: gộp các match có kẹo chung
    - Implement `removeMatches(grid, matches)`: xóa kẹo khỏi lưới, trả về grid mới
    - _Yêu Cầu: 3.1, 3.2, 3.3_

  - [ ] 3.2 Viết property test cho findAllMatches — tìm đầy đủ match
    - **Property 7: findAllMatches tìm đầy đủ match**
    - **Validates: Yêu Cầu 3.1, 3.2**

  - [x] 3.3 Implement phân loại match đặc biệt
    - Implement `classifyMatch(candies, direction)`: phân loại MATCH_3/4/5/L/T và SpecialType tương ứng (design §2.9)
    - Implement `isPartOfLShape(candies)`, `isPartOfTShape(candies)` để nhận diện hình L/T
    - Implement `placeSpecialCandy(grid, match)`: đặt kẹo đặc biệt tại pivotPos
    - _Yêu Cầu: 3.4, 3.5, 3.6, 3.7, 3.8, 6.5_

  - [ ] 3.4 Viết property test cho classifyMatch — phân loại match đặc biệt chính xác
    - **Property 9: Phân loại match đặc biệt chính xác**
    - **Validates: Yêu Cầu 3.4, 3.5, 3.6, 3.7, 3.8**

  - [x] 3.5 Implement kích hoạt kẹo đặc biệt
    - Implement logic kích hoạt STRIPED_H: xóa toàn bộ hàng ngang
    - Implement logic kích hoạt STRIPED_V: xóa toàn bộ cột dọc
    - Implement logic kích hoạt WRAPPED: xóa vùng 3×3 xung quanh
    - Implement logic kích hoạt COLOR_BOMB: xóa tất cả kẹo cùng loại với kẹo hoán đổi
    - _Yêu Cầu: 6.1, 6.2, 6.3, 6.4, 6.6_

- [x] 4. Triển khai ShuffleEngine — kiểm tra nước đi và shuffle
  - [x] 4.1 Tạo `src/ShuffleEngine.ts`
    - Implement `hasValidMoves(grid)`: duyệt tất cả swap có thể, early return khi tìm thấy match (design §2.4)
    - Implement `fisherYatesShuffle<T>(arr)`: thuật toán Fisher-Yates in-place
    - Implement `shuffleBoard(grid)`: shuffle + kiểm tra hợp lệ, tối đa 100 lần, fallback initBoard (design §2.5)
    - _Yêu Cầu: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 12.3_

  - [ ] 4.2 Viết property test cho GameBoard — khởi tạo luôn có nước đi hợp lệ
    - **Property 2: Khởi tạo luôn có nước đi hợp lệ**
    - **Validates: Yêu Cầu 1.3, 7.7**

  - [ ] 4.3 Viết property test cho isAdjacent
    - **Property 6: isAdjacent chỉ đúng với ô liền kề trực tiếp**
    - **Validates: Yêu Cầu 2.5**

  - [ ]* 4.4 Viết property test cho shuffleBoard — bảo toàn tập hợp kẹo
    - **Property 16: Shuffle bảo toàn tập hợp kẹo**
    - **Validates: Yêu Cầu 7.4**

  - [ ] 4.5 Viết property test cho shuffleBoard — tạo lưới hợp lệ
    - **Property 17: Shuffle tạo lưới hợp lệ**
    - **Validates: Yêu Cầu 7.3, 7.7**

- [x] 5. Triển khai ScoreManager — tính điểm và lưu trữ
  - [x] 5.1 Tạo `src/ScoreManager.ts`
    - Implement `calculateScore(matches, combo)`: tính điểm theo loại match × hệ số combo (design §2.8)
    - Implement `addScore(points)`, `getScore()`, `getHighScore()`
    - Implement `saveHighScore()`: lưu vào localStorage key `candy-crush-highscore`
    - Implement đọc highScore từ localStorage khi khởi tạo, fallback về 0 nếu không có
    - _Yêu Cầu: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 13.1, 13.2, 13.3, 13.4_

  - [ ]* 5.2 Viết property test cho calculateScore — tính điểm đúng theo loại match
    - **Property 13: Tính điểm đúng theo loại match**
    - **Validates: Yêu Cầu 5.1, 5.2, 5.3, 5.4**

  - [ ]* 5.3 Viết property test cho calculateScore — hệ số combo tăng đơn điệu
    - **Property 14: Hệ số combo tăng đơn điệu**
    - **Validates: Yêu Cầu 5.5**

  - [ ]* 5.4 Viết property test cho ScoreManager — round-trip lưu/đọc điểm cao nhất
    - **Property 15: Round-trip lưu/đọc điểm cao nhất**
    - **Validates: Yêu Cầu 5.7, 5.8, 13.1, 13.2**

- [x] 6. Triển khai GameManager — điều phối vòng lặp game
  - [x] 6.1 Tạo `src/GameManager.ts` với State Machine và xử lý swap
    - Implement State Machine với 8 trạng thái: IDLE, SWAPPING, MATCHING, REMOVING, REFILLING, CASCADING, CHECKING, SHUFFLING
    - Implement `processSwap(pos1, pos2)`: kiểm tra adjacent, swap, findMatches, trả null nếu không có match (design §2.6)
    - Implement `runCascade(grid)`: vòng lặp cascade — removeMatches → placeSpecial → applyGravity → refill → findMatches (design §2.6)
    - Implement `checkAndShuffle(grid)`: gọi hasValidMoves, trigger shuffle nếu cần
    - Implement `onSwap(pos1, pos2)`: entry point từ InputHandler, bỏ qua khi đang animate
    - _Yêu Cầu: 2.4, 3.3, 4.4, 4.5, 7.1, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9_

  - [ ]* 6.2 Viết property test cho processSwap — swap không hợp lệ không thay đổi lưới
    - **Property 8: Swap không hợp lệ không thay đổi lưới**
    - **Validates: Yêu Cầu 3.3**

  - [ ]* 6.3 Viết property test cho cascade — kết thúc khi không còn match
    - **Property 12: Cascade kết thúc khi không còn match**
    - **Validates: Yêu Cầu 4.5**

  - [ ]* 6.4 Viết property test cho invariant nước đi hợp lệ sau mọi thao tác
    - **Property 18: Invariant nước đi hợp lệ sau mọi thao tác**
    - **Validates: Yêu Cầu 7.1, 7.7**

- [x] 7. Checkpoint — Kiểm tra logic game cốt lõi
  - Đảm bảo tất cả tests pass cho GameBoard, MatchEngine, ShuffleEngine, ScoreManager, GameManager
  - Hỏi người dùng nếu có vấn đề cần làm rõ trước khi tiếp tục phần visual/animation

- [x] 8. Triển khai InputHandler — xử lý touch/mouse
  - [x] 8.1 Tạo `src/InputHandler.ts`
    - Implement `handleTouchInput(canvas, gameManager)`: lắng nghe touchstart, touchend, touchmove (design §2.10)
    - Implement `getTilePosition(touch, canvas)`: chuyển đổi tọa độ pixel → ô lưới (row, col)
    - Implement `getSwapDirection(start, end)`: xác định hướng kéo (4 hướng, không chéo)
    - Gọi `event.preventDefault()` trong touchmove để ngăn cuộn trang
    - Hỗ trợ cả mouse events cho desktop testing
    - _Yêu Cầu: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 8.2 Viết property test cho getTilePosition — chuyển đổi tọa độ pixel → ô lưới
    - **Property 5: Chuyển đổi tọa độ pixel → ô lưới**
    - **Validates: Yêu Cầu 2.1**

- [x] 9. Triển khai ParticleEngine — hệ thống hạt particle
  - [x] 9.1 Tạo `src/ParticleEngine.ts` với object pool
    - Implement object pool kích thước ~200 để tái sử dụng Particle object
    - Implement `spawnBurst(x, y, color, count, type)`: tạo hạt theo hướng ngẫu nhiên (design §4.3)
    - Implement `spawnTrail(from, to, color, type, count)`: tạo hạt dọc theo đường thẳng
    - Implement `spawnStarburst(x, y, count, colors, type)`: tạo hạt ngôi sao nhiều màu
    - Implement `updateParticles(deltaTime)`: cập nhật vị trí, vận tốc, vòng đời (design §4.3)
    - Implement `renderParticles(ctx)`: vẽ SPARK, STAR, BURST, TRAIL (design §4.3)
    - Giới hạn tối đa 300 hạt đồng thời
    - _Yêu Cầu: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

  - [ ]* 9.2 Viết property test cho updateParticles — vòng đời particle giảm đơn điệu
    - **Property 19: Vòng đời particle giảm đơn điệu**
    - **Validates: Yêu Cầu 10.6, 10.7**

- [x] 10. Triển khai VisualDesigner — vẽ kẹo với hình dạng đặc trưng
  - [x] 10.1 Tạo `src/VisualDesigner.ts` với pipeline vẽ 5 lớp
    - Định nghĩa `CANDY_VISUALS: Record<CandyType, CandyVisual>` với màu sắc và gradient theo bảng màu design §3.1
    - Implement `drawCandy(ctx, candy, cx, cy, radius, opts)`: pipeline 5 lớp (design §3.2)
    - Implement `drawDropShadow(ctx, type, r, color)` (design §3.4)
    - Implement `drawCandyRim(ctx, type, r, color)`: viền ngoài
    - Implement `drawHighlight(ctx, r, color)`: vệt sáng phía trên-trái (design §3.4)
    - Cache CanvasGradient cho từng loại kẹo để tối ưu hiệu năng
    - _Yêu Cầu: 8.7, 8.9, 12.2_

  - [x] 10.2 Implement vẽ từng hình dạng kẹo
    - Implement `drawHeart(ctx, r, visual)`: trái tim với bezier curve (design §3.3)
    - Implement `drawDiamond(ctx, r, visual)`: hình thoi với facets (design §3.3)
    - Implement `drawStar6(ctx, r, visual)`: ngôi sao 6 cánh (design §3.3)
    - Implement `drawClover(ctx, r, visual)`: lá cỏ 4 lá với 4 arc (design §3.3)
    - Implement `drawWaveCircle(ctx, r, visual)`: tròn gợn sóng 8 đỉnh (design §3.3)
    - Implement `drawHexagon(ctx, r, visual)`: lục giác đều (design §3.3)
    - _Yêu Cầu: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 10.3 Implement vẽ icon kẹo đặc biệt
    - Implement `drawSpecialIcon(ctx, special, r)`: vẽ icon STRIPED_H, STRIPED_V, WRAPPED, COLOR_BOMB (design §3.5)
    - _Yêu Cầu: 8.8_

- [x] 11. Triển khai Renderer — vẽ toàn bộ game lên Canvas
  - Tạo `src/Renderer.ts`
  - Implement `constructor(canvas)`: thiết lập context, xử lý devicePixelRatio cho retina
  - Implement `resize(width, height)`: điều chỉnh canvas theo kích thước màn hình
  - Implement `render(state, animState)`: pipeline render đầy đủ (design §4.5) — background → glow → kẹo thường → kẹo được chọn → particles → combo text → HUD
  - Implement `drawHUD(ctx, score, highScore, comboCount)`: hiển thị điểm và combo
  - Kiểm tra hỗ trợ Canvas, hiển thị thông báo lỗi nếu không hỗ trợ
  - _Yêu Cầu: 8.9, 8.10, 12.1, 12.5_

- [x] 12. Triển khai AnimationManager — hệ thống animation đầy đủ
  - [x] 12.1 Tạo `src/AnimationManager.ts` với hàng đợi animation và easing functions
    - Implement `Easing`: linear, easeInOut, easeOutBack, easeOutBounce, spring (design §4.1)
    - Implement hàng đợi animation với `AnimationClip`, đảm bảo không chồng chéo
    - Implement `update(deltaTime)`: cập nhật tất cả clip đang chạy
    - Implement `isAnimating()`: trả về true khi có clip đang chạy
    - _Yêu Cầu: 9.13, 11.1_

  - [x] 12.2 Implement idle và select animation
    - Implement `startIdleAnimations(candies)`: idle bounce với golden ratio phase offset (design §4.2.1)
    - Implement `stopIdleAnimations()`: dừng idle khi bắt đầu action
    - Implement `playSelectAnimation(candy)`: phóng to 1.18× → 1.12× + glow pulse (design §4.2.2)
    - Implement `playDeselectAnimation(candy)`: thu về 1.0× trong 100ms
    - _Yêu Cầu: 9.1, 9.2_

  - [x] 12.3 Implement swap và invalid swap animation
    - Implement `queueSwapAnimation(pos1, pos2)`: di chuyển song song 200ms easeInOut (design §4.2.3)
    - Implement `queueInvalidSwapAnimation(pos1, pos2)`: di chuyển 30% + rung 3 lần 350ms (design §4.2.4)
    - _Yêu Cầu: 9.3, 9.4_

  - [x] 12.4 Implement match explosion và fall animation
    - Implement `queueMatchAnimation(matches)`: flash 50ms → scale 1.4× + fade 200ms (design §4.2.5)
    - Implement `queueFallAnimation(fallingCandies)`: rơi với tốc độ 80ms+0.6ms/px + bounce + squash (design §4.2.6)
    - _Yêu Cầu: 9.5, 9.6_

  - [x] 12.5 Implement shuffle, combo và special candy animation
    - Implement `queueShuffleAnimation(candies, newPositions)`: thu nhỏ → xoáy → bay ra staggered 15ms/kẹo (design §4.2.7)
    - Implement `playComboAnimation(comboCount, pos)`: label phóng to + mờ dần 700ms + screen shake khi combo ≥ 4 (design §4.2.8)
    - Implement `playStripedActivation(candy, dir)`: tia sáng quét 300ms (design §4.2.9)
    - Implement `playWrappedActivation(candy)`: 2 vòng tròn nở ra 550ms (design §4.2.9)
    - Implement `playColorBombActivation(candy, targetType)`: tia sét đến từng mục tiêu (design §4.2.9)
    - _Yêu Cầu: 9.7, 9.8, 9.9, 9.10, 9.11, 9.12_

- [x] 13. Kết nối toàn bộ hệ thống trong main.ts
  - Khởi tạo tất cả module: GameBoard, MatchEngine, ShuffleEngine, ScoreManager, AnimationManager, VisualDesigner, ParticleEngine, Renderer, InputHandler
  - Khởi tạo GameManager với tất cả dependency
  - Thiết lập vòng lặp requestAnimationFrame: update AnimationManager + ParticleEngine → render
  - Kết nối InputHandler với canvas và GameManager
  - Xử lý window resize để cập nhật Renderer
  - _Yêu Cầu: 1.1, 8.10, 11.1, 12.1_

- [x] 14. Checkpoint cuối — Kiểm tra toàn bộ hệ thống
  - Đảm bảo tất cả tests pass, hỏi người dùng nếu có vấn đề cần làm rõ.

---

## Ghi Chú

- Task đánh dấu `*` là tùy chọn, có thể bỏ qua để triển khai MVP nhanh hơn
- Mỗi task tham chiếu yêu cầu cụ thể để đảm bảo traceability
- Property tests sử dụng thư viện fast-check (TypeScript) để kiểm tra tính đúng đắn
- Các checkpoint đảm bảo kiểm tra tăng dần sau mỗi nhóm tính năng
