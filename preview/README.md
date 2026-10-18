# オープニング Version 9「夜明け・映画版」制作指示書

方針：**甲**（現行 Version 8 の構成・時刻・音・文字・ロゴを完全維持し、背景だけを実写級映像に差し替える）

- 音源：`assets/intro-sound.mp3`（21.03秒）— 変更禁止
- 文字・ロゴ：HTML／CSSで合成（映像生成サービスに文字を描かせない）
- 検証ページ：`/preview/`（本番トップには一切触れない、検索除外設定済み）
- 確認用：`/preview/?hud=1`（時刻表示）、`/preview/?t=11&hud=1`（11秒から再生）

---

## 1. 確定タイムライン（実測・正）

| 時刻 | 場面 | 背景 | 上に重なるもの（既存のまま） | 音 |
|---|---|---|---|---|
| 0.00〜4.45 | C1 夜明け前の地平線 | **新映像 c1** | 地平線の光の線、集まる光の粒、オレンジの点 | 4.0秒に最初の山 |
| 4.20〜4.90 | 白飛び | 合成（白） | — | |
| 4.85〜6.80 | C3 渦・暗転 | **新映像 c3**（任意） | 渦を巻く光の筋 | 7.0秒に谷 |
| 6.70〜11.30 | C4 宇宙→地球→日本→大阪 | **新映像 c4** | 「大阪 OSAKA, JAPAN」印（10.1〜11.5秒、画面中央） | 10〜11秒で上昇 |
| 11.30〜12.30 | 地図が溶けて街へ | c4 拡大＋ぼかし → c5 | — | |
| 11.45〜19.30 | C5 大阪の夜明け | **新映像 c5** | 13.0「始まりは、夜明けから。」／15.8「経営の相談に、確かな解決策を。」／16.6 ロゴ＋社名 | 16.0秒に最大の山 |
| 18.30〜19.30 | 幕開け→トップへ | — | — | 21.0秒で消音 |

## 2. 納品規格（全カット共通）

| 項目 | 規格 |
|---|---|
| 毎秒コマ数 | 24コマ（現行と同じ） |
| 向き | 横 16:9（ファイル名 `-l`）と 縦 9:16（`-p`）の2本ずつ |
| 生成解像度 | 最大で生成（4K可なら4K）。配信用は私が横1920×1080／縦1080×1920に変換 |
| 長さ | 下表の「必要尺」以上で生成。切り出し・速度調整は私が行う |
| 禁止 | 文字・看板の判読できる文字・ロゴ・人物の顔・架空の未来建築・過剰なネオン |
| 置き場所 | `preview/plates/c1-l.mp4` など（私が変換して配置） |

---

## 3. カット別 生成指示

各カットの英語の指示文を、そのまま映像生成サービスに貼り付けてください。

### C1 夜明け前の地平線（必要尺 4.5秒以上）

**狙い**：完全な暗闇に近い、大阪湾〜生駒の遠い地平線。後から光の粒子を重ねるため、画面はほぼ黒、地平線だけがわずかに見える。
**構図の絶対条件**：地平線は画面の上から56%の高さ・水平。中央に何も置かない（ここにオレンジの点を合成する）。

```text
Extreme wide establishing shot of a distant city horizon in the last minutes before dawn, viewed from very high altitude. The frame is almost entirely deep black and midnight blue; only a razor-thin, perfectly level horizon line sits 56% down the frame, with the faintest cold-blue atmospheric glow above it and a scattering of tiny, distant amber city lights below it. Center of frame left completely clean. Locked-off camera with an imperceptibly slow push-in. Shot on ARRI ALEXA 65, 65mm spherical prime, f/2.8, 180-degree shutter, natural film grain, deep true blacks, humid night air, physically accurate atmospheric perspective. No text, no logos, no people, no lens flares, no CGI look.
```

### C3 渦・暗転（必要尺 2.0秒以上・任意）

**狙い**：光の渦は既存の描画で残す。背景だけ、黒の中に漂う微かな大気の揺らぎを足して奥行きを出す。生成が難しければ省略可（省略時は現行の黒背景）。

```text
Pure cinematic black void with an extremely subtle, slowly rotating veil of dark atmospheric haze and faint warm dust motes drifting toward the center, as if the camera is inside the eye of a quiet vortex. 95% of the frame is near-black. Locked-off camera, slow clockwise rotation of the haze only. Shot on ARRI ALEXA 65, natural film grain, no bright objects, no text, no CGI look.
```

### C4 宇宙→地球→日本→大阪（必要尺 5.7秒以上）

**狙い**：夜の地球を宇宙から捉え、東側（画面右下）に夜明けの境目のオレンジの縁。日本列島へ寄り、雲を抜けて関西の夜景へ降下。最後の1秒は**大阪の中心部が画面のちょうど中央**に来ること（ここに「大阪」の印を合成する）。
**注意**：1本で作れない場合は「前半（宇宙→日本）」「後半（雲を抜けて大阪へ）」の2本で生成してください。私が継ぎ目なくつなぎます。

```text
Continuous photoreal orbital descent. Begins in black space with the night side of Earth filling the lower frame, a thin blue atmospheric limb and a warm orange dawn terminator glowing on the lower-right edge. The camera pushes steadily toward the Japanese archipelago, its city lights forming the recognizable coastline, then accelerates down through thin high-altitude clouds into a night aerial over the Kansai region, ending perfectly centered and locked on central Osaka's dense amber grid of lights beside Osaka Bay. Real NASA ISS night-photography realism, accurate geography, no fantasy elements. Smooth exponential zoom, no shake. ARRI ALEXA 65 look, natural film grain, deep blacks, physically accurate atmosphere. No text, no labels, no borders, no logos.
```

前半だけの場合の追記：`Ends with Japan centered at mid-altitude.`
後半だけの場合の冒頭：`Starts at mid-altitude above Japan at night,` 以降同文。

### C5 大阪の夜明け（必要尺 8.5秒以上）★最重要

**狙い**：現行の映像と**同じ構図**（手前に大川の水面と川沿いの灯り、右中央に大阪城天守、奥に高層ビル群）を、実写と見分けがつかない質感で作り直す。夜の群青から、地平線にアンバー・金・薄いばら色の朝焼けが滲み出る。
**作り方**：参考画像を「開始画像」「終了画像」として指定できるサービスでは、`preview/ref/c5-l-first.jpg`（開始）と `c5-l-last.jpg`（終了）を使う（縦は `c5-p-…`）。
**構図の絶対条件**：画面上部30%は空のみ（13.0秒の文字がここに乗る）。画面中央は明るくしすぎない（15.8秒の大きな文字が乗る）。

```text
Photoreal cinematic aerial of Osaka at the exact moment night turns to dawn, matching the reference composition: the Okawa river in the foreground reflecting warm riverside lights, the illuminated main keep of Osaka Castle on its stone walls at right-center surrounded by trees, and the real Osaka high-rise skyline behind it. Over the shot the sky transitions from deep midnight blue to a horizon blooming with amber, gold and a delicate rose morning glow; first golden rim light catches the rooftops and glass edges of the tallest towers; office windows and streetlights stay softly lit; thin ground fog drifts between buildings for atmospheric depth. The upper 30% of the frame is open sky only. Perfectly stabilized, very slow forward drift. Shot on ARRI ALEXA 65 with Cooke Anamorphic/i 65mm, f/2.8, 180-degree shutter, subtle elegant horizontal anamorphic streaks on the brightest lights only, natural film grain, physically accurate atmospheric scattering, zero CGI plasticity. No text, no readable signs, no logos, no people close-up, no fictional buildings, no neon cyberpunk.
```

---

## 4. 生成後の流れ

1. 生成した映像（カットごと、横・縦）を私に渡す
2. 私が：必要尺に切り出し → 24コマ化 → 色調を現行に合わせて統一 → 粒子感・周辺減光 → 横縦×2形式に変換 → `preview/plates/` に配置
3. `/preview/?hud=1` で音と合わせて確認
4. 承認後に本番へ反映（本番の `index.html` の差し替えは承認まで行わない）

素材が届いていない場面は、自動的に現行の描画で再生されます（一部だけ先に差し替えて確認可能）。
