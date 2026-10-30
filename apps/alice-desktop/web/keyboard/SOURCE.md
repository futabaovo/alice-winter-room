# 像素键盘模式素材

角色造型参考现有项目有珠 Q 版素材，经内置 ImageGen 生成并调整为三套衣装、四种敲击/待机动作。使用圆润整块手形；企鹅装保留鳍状轮廓。基础图集为 `alice-pixel-atlas-round.png`。1.0.8 新增 `alice-pixel-reactions.png`：书页、合书、扶额、举书检视四类反应，运行时组合为十种快捷键反馈。

TypingPet 的公开项目介绍用于交互方向参考，本功能没有运行依赖其程序或服务，未复制其代码。素材为本项目制作，并非原视频素材的截帧。

## 1.0.8 快捷键差分

参考项目：https://github.com/swoonqx/TypingPet 。Bilibili 参考页面未能直接读取；动作按公开组合键功能说明和本项目角色气质设计，未复刻或提取视频素材。

生成提示词（内置 ImageGen；输入为本项目基础图集）：

```text
Use case: precise-object-edit. Input image is the existing pixel-art Alice Kuonji keyboard companion atlas. Create a companion REACTION atlas with EXACTLY 4 columns and 3 rows, fully transparent background. KEEP the same character design, faces, muted navy/purple palette, rounded SINGLE-MASS mitten hands without fingers, head proportions, clothing, keyboard and front-facing camera. Rows: black fur winter cap and cape; white winter cap with dark bow and white cape; penguin hood suit. Every cell contains the FULL character from hat top to keyboard bottom. Each cell's keyboard has identical width and baseline, head center and hat size fixed across columns. Leave generous transparent gutters between cells; no overlap. Replace typing poses with these 4 distinct subtle character poses, consistently repeated in all three outfits: COLUMN 1: calmly inspecting a small cream page held by one round mitten, other mitten supporting a small dark plum magic book at chest; reserved neutral face. COLUMN 2: holding a CLOSED elegant plum book against chest with both round mittens, eyes gently closed with a tiny proud content expression, no big grin. COLUMN 3: one round mitten touching the side of her temple, other resting on keyboard, eyelids slightly lowered in restrained exasperation, mouth a tiny flat line; no book. COLUMN 4: an OPEN plum book raised below the eyes to partly hide the lower face, both round mittens correctly supporting its outer lower corners; eyes intent, slightly sideways as if searching a page. Hands stay connected to sleeves, penguin outfit uses rounded flippers. Keep hat tops and keyboard bottoms at consistent positions within each row, props inside body width, NO floating stickers/effects/text/labels, NO finger lines. Crisp limited-color pixel art matching reference; actual alpha background.
```

审查后修补企鹅服保存动作中的书本：

```text
Edit this exact transparent 4 columns by 3 rows pixel sprite atlas. Keep all 12 characters, ALL their pixel positions, dimensions, head, face, hat, hood, keyboard, palette and all other panels unchanged. Only repair bottom row, second column: the penguin-costume girl currently has eyes closed and empty flippers at keyboard. She MUST gently hold a CLOSED dark plum magic book upright at her chest with both rounded black flipper mittens at its two lower corners, book gold ornamental border and single small gold diamond motif, matching exactly the book pose in top row second column and middle row second column. Book in front of white belly. Eyes closed peacefully. No extra hands, no fingers. Keep transparent background alpha and exact sheet grid/gutters. Do not remove or alter any other books or poses.
```

实际运行素材按待机高度等比例注册，不通过头部压缩产生动作。背景透明；普通手形为单块圆团，企鹅服为圆润鳍形。

## Ctrl+C / Ctrl+V 精修

`alice-pixel-pages.png` 为六列三行专用动作图集。每套服装依次为翻书、抽出一页、复制为两页、取页、双手托页、轻按键盘。复制不再与粘贴共用同一姿态；两段动作按接触时序配合微光和落页阴影。

生成提示词：

```text
Edit/derive from the two supplied existing transparent pixel-art Alice keyboard companion sheets. Create a NEW registered transparent sprite atlas exclusively for Ctrl+C copying a book page and Ctrl+V placing a page onto the keyboard. EXACT GRID: 6 columns x 3 rows, 18 complete sprites, all front view, generous completely transparent gutters. Same pixel art and exact character identity, proportions, outfit palette, round single-mass mitten hands (never fingers), and cream/lavender keyboard in every cell. Row1 black furry winter hat/cape; row2 ivory winter hat with violet bow and ivory cape; row3 penguin hood with orange beak and black flipper hands. Every cell's head, hat, bangs, face and keyboard stay registered to the identical positions and scale. The body stays connected. No extra arms, no visible wrist gaps. Change only hand/forearm/book/page poses with small restrained expressions.
COLUMN 1 COPY OPEN: holds a small dark plum gold-ornamented magic book OPEN at lower chest with both rounded mittens supporting it, eyes looking slightly down. Book must remain well below eyes.
COLUMN 2 COPY EXTRACT: right mitten supports same book near center chest, left mitten pinches bottom of ONE upright cream page drawn partly out of book toward viewer-left, page touching mitten; left arm bent naturally.
COLUMN 3 COPY DUPLICATE: right mitten supports same book at chest, left mitten holds TWO clearly separate overlapping cream pages fanned gently left, both held at lower corner. A tiny restrained pleased closed-mouth face, no grin. The two sheets must be readable as two in ALL THREE outfits.
COLUMN 4 PASTE READY: NO BOOK. Left mitten holds ONE upright cream page at center lower chest. Right mitten ready just above keyboard. Serious calm eyes.
COLUMN 5 PASTE LOWER: NO BOOK. BOTH rounded mittens hold bottom left/right edges of ONE cream page at a forward angle, lowered close above the keyboard but with a visible small gap. Both forearms naturally extend out from sleeves, no detached hands. Page should be broad enough to see its small violet decorative strokes.
COLUMN 6 PASTE CONTACT: NO BOOK, NO PAGE. Both round mittens gently pressed onto keyboard near center as if the page just magically merged into it. Slight downcast gaze, no smile. This is a dedicated TWO-HAND press, not the original alternating typing pose.
Keep all frames stylistically identical to the input art, complete characters and keyboards with no cropping. Do not draw text, labels, UI, particles, sparkle overlays, borders or extra loose disconnected papers. Alpha transparent background. Crisp pixel silhouettes. White-costume and penguin rows must have all the same specified objects and actions as first row.
```

第二次检查修补企鹅复制时的书本：

```text
Precisely edit this transparent 6-column by 3-row sprite atlas. Only fix the bottom row (penguin costume), THIRD column (closed eyes holding two cream pages). This cell is missing the dark plum open magic book. Add the SAME small gold-bordered dark plum OPEN book at her center chest supported by her right black flipper mitten, matching bottom row column2 and the third-column poses in rows1 and2. The left flipper still holds TWO overlapping cream pages at the left. Book visible and supported, no extra hands. Preserve every other pixel/pose/head/hat/keyboard in all other seventeen cells as much as possible. Keep this exact 6x3 grid, full alpha transparency, exact dimensions and registration. No text, no new effects.
```

最终手形编辑提示词（内置 ImageGen）：

```text
Use case: precise-object-edit. Edit target: the supplied transparent 4-column by 3-row pixel-art character animation atlas. Change ONLY the hand silhouettes in the first two rows (black winter outfit and white winter outfit). Replace ALL detailed finger gloves with clean, round chibi mitten/paw shapes: each hand is one compact rounded bean-shaped mass, smooth continuous contour, NO finger lobes, NO finger separation lines, NO knuckle dots, NO claws. Keep a tiny subtle thumb suggestion only if needed, otherwise one simple oval hand. The paws should attach naturally to the sleeves, rest just above the keyboard in idle, and alternately move down to tap the keys in columns 2 and 3. Keep their size compact and consistent, with simple two-tone dark violet shading and crisp pixel outlines. The third row penguin flippers should stay unchanged. Preserve exactly the faces, hair, head size, outfits, expressions, keyboards, colors, 4x3 layout, registration and transparent background. Column order: idle, left tap, right tap, eyes closed. Do not add text or other props. The visual goal is cute simple rhythmic typing hands seen in pixel desktop companions, not anatomically detailed hands.
```
