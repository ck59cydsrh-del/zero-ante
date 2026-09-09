# ミニマルテクノの卓 — current (2026-09-08)

kozakiの指定でUIを全面的に組み直した。参照は **Raster-Noton / Basic Channel / Chain Reaction**
の実在の意匠で、社内では `shogi-rogue/`(sshhooggii) が同じ系統をすでに実装している。
**同じメーカーに見えることを優先し、あちらのトークン設計をそのまま受け継いだ。**

- 地は紙一色 `#EDEDEA`、墨 `#0E0E10`。灰は不透明度の段で、**実測コントラストを併記**してある
  (g70=7.31:1 / g45=4.68:1 本文可 / g26=3.10:1 大きい文字のみ / g16以下は罫専用)
- **差し色は朱一色**。面 `#EF5828` は紙地で2.94:1 なので**文字には使わない**(その上の墨は5.60:1)。
  紙の上に置く朱の文字は `#C43A12`(4.52:1)。sshhooggii の緑とまったく同じ扱い
- 朱が出る場所は4つだけ: **♥♦のスート / 手番の席の縦棒 / 勝ちの瞬間の面 / ALL-IN**
- 極小の文字(10px)に広いトラッキング(.14em)の等幅ラベル。見出しと数字は幾何学サンセリフ(Avenir/Futura)。
  Helvetica/Arial は既定すぎるので使わない
- ヘアラインで区切る。塗らない・囲まない・影もグローも角丸も無し。数字は tabular
- **卓は残すが、緑のフェルトはやめて「卓の平面図」として描く。** 実在のトーナメント卓の図面と同じで、
  外周のレール線と内側のベットラインの**二重の罫だけ**。面は塗らない。
  席はその楕円の上半分に等間隔で並び、**見ている本人の席は置かない**(本人は手前のレールに居る)。
  楕円の下側は手前のレールで切り落とし、卓が自分の側へ続いて見えるようにしてある。
  ここだけ角丸を使うのは、それが装飾ではなく**卓そのものの形**だから
- 動きは linear と一段のみ。**飛沫・光輪・レイ・チップの飛翔・盤面のパルスは全部削除**した。
  効果は「効いた場所を一段だけ反転させる」だけで、面が朱に染まるのは勝ちの瞬間だけ
- スタイルシートは `techno.css` の1枚に統合。以前の style / immersive / clarity-game /
  instrument / circle の5枚重ねは読み込まなくなった(ファイルは履歴として残置)

実測: 1440×900 / 1000×660 で席・中央の塊・卓の外周がひとつも重ならない(矩形交差で判定)。横スクロールなし。
縦が足りない機では席の板を縮め、ポットを場札の**横**へ回して中央の塊を半分の高さにする。
画面上の文字は全て 4.65:1 以上(`getComputedStyle` から算出、目視判定はしていない)。

---

# Circle table — current

Bold compact grotesk typography replaces the monospaced direction. White, vivid green
and orange follow the supplied festival reference without reproducing its artwork.
Seats orbit the green oval, relative to the current local viewer. Pixel cards remain.
Ability receipts now launch a source-to-target ray and target ring, with a short bold
banner. Reduced-motion mode omits the rays and rings.

## Previous minimal rhythm foundation

The active surface is now monochrome, unboxed and aligned like a sequencer: numbered
street steps, a small turn indicator, tabular chip counts and flat action keys. Pixel
cards retain red suits. Ability names stay English, descriptions Japanese. Results are
compact rows. Crucially the action pod inherits theme variables instead of overriding
them with the former green-table palette. Setup is a centered auto-height panel.

## Previous beginner clarity foundation

Circuit ornaments are removed. A continuous green table puts readable turn guidance above
the opponents and the player controls within the lower edge. Desktop pot and community
cards share a row, avoiding opponent overlap. Persistent results show winner, best five
cards and chip deltas. Japanese ability names describe their actions. Local names are
editable; a 600-chip stack and 25/50 blinds increasing every two hands accelerate play.
CHECK, FOLD, CALL, RAISE and ALL-IN each have a distinct optional synthesized cue.

## Earlier Overdrive foundation (circuit styling superseded)

The entire match now lives on one green circuit table. No separate sidebar: the player's
cards, stack, action receipt and English betting controls form the lower edge of the table.
The lower circuit is occluded behind controls to avoid drawing through text. Diamonds have
a narrow stepped silhouette; clubs use three separate lobes and a defined stem.

32 modules live in rogue.js, a browser/CommonJS engine shared by the UI and tests.
All participants earn a reward: winners draw tiers 2–3 and losers tier 1. CPU rewards use
the same pools; local human rewards are queued individually. Choice has no time limit.
Owned modules are excluded; exhausted pools convert to a stated chip bonus.

Effect receipts include source, target and actual result; installed module buttons expose
the description and last trigger. Information modules expose live readouts. Guard jamming
resolves first; human opponents are valid targets. All-in runout resolves street-by-street
so flop and river abilities execute. Rank rewriting explicitly permits five-of-a-kind.
This is a custom rogue variant, not a claim of complete official-tournament compliance.

Sound uses optional bounded-gain synthesis: short check tick, pitch-dropping attack bass,
and rising victory arpeggio. Win effects have longer hold, more particles and circuit bloom.
Reduced-motion preferences suppress particle movement; sound defaults OFF.

Automated verification: 48 tests, including all 32 module implementations, payout-side
effects, reward eligibility, jam/fog, once-per-hand triggers, all-in lock and rank variants.
Browser: loser COMMON selection, winner RARE selection, CPU jammer disabling both raise
and over-call all-in, and restoration at flop. Further QA is recorded in the handoff.

## Circuit edition — previous

The new references drive a PCB-green play surface with cream circuit traces around
its perimeter, a paper/black control panel, orange action emphasis, and bold editorial
type. The circuit geometry is original and contains no copied logo or text. Pixel suits
remain red/black. A single circuit.css replaces the previous layered production styles.

Actions occupy a reserved row beneath the hand, avoiding layout jumps. Betting sends
chips from the acting player to the pot; announcements pulse the circuit and significant
events emit a brief particle burst. Optional synthesized sound starts OFF. Reduced-motion
preferences suppress chip flight and particles and shorten other animations.

Validated: six-player solo call, two-player flop/all-in/uncontested award and reward
screen, 844 × 390 landscape controls, 1440 × 900 desktop, black/white and sound toggles.
Eight hand-evaluator checks pass. No browser console errors observed in the tested flow.
These checks do not establish full official tournament-rule compliance.

## Previous liquid edition (archived direction)

The supplied reference informed cobalt ink, tactile paper, generous negative space,
and restrained editorial labels. The artwork is original, with no copied text or marks.
Cards remain discrete pixel shapes. Essential controls and figures sit on opaque surfaces.

## Artwork

Asset: `ink-art.png`, generated with the built-in image generation tool.

Prompt: “Create a finished original raster background asset for an editorial poker game,
landscape 1536x1024. Bone white cold paper, deep cobalt blue ink only. One very large
abstract flowing spade silhouette dissolving into liquid ink, soft oversprayed edges and
fine speckled print grain, high quality experimental contemporary Swiss graphic design.
Intensely blue organic spade-like fluid forms occupying left third and far right edge,
central 45 percent predominantly empty white with subtle grain for game cards overlay.
No text, letters, logos, watermarks, cards or UI screenshots.”

## Verification

- Browser: six-player solo game, white/black toggle, preflop call and flop progression.
- Browser: two-player local handoff shows two backs before each reveal.
- Browser: local all-in and call expose five community cards; awarded pot returns to zero.
- Browser: reward selection layout checked in black mode.
- Eight automated checks against the shipped evaluator: categories, ace-low straight,
  no wraparound, suit equality, kicker order, full house, seven-card selection,
  and eight-card selection for the sixth-street variant.
- Action hide timer cancellation prevents stale timers hiding a newer action.
- Turn starts wait for queued announcements to finish.
- Community cards preserve their DOM nodes unless that slot changes, avoiding repeated
  deal animations when another card opens.

Browser checks are representative, not a complete proof of tournament-rule compliance.

## 報酬の演出 (2026-09-08 追記)

kozakiの指示で「ドーパミンが出る演出」を足した。ただし**静かな地は崩さない**。
sshhooggii と同じ作りで、**普段は罫だけが動き、報酬の瞬間にだけ大きさと色が出る**。
静けさがあるから打点が立つ、という順序を逆にしないこと。

- `.stamp` — 卓の中央に殴りつける一語。`cubic-bezier(.15,1.7,.4,1)` で 2.3倍から着地する。
  段は **mid / big / huge**。huge だけ朱の面に墨字で、字は `min(78px,8.6vw)`
- `.pop` — 勝者の席から立ち上がる `+額`。linear で上へ抜ける。段は mid / big / huge
- **段の決まり方**（`winTier`）: 役 / ポットが自分の開始スタックに占める割合 / 連勝、
  のどれかが伸びると一段上がる。フォーカード以上・スタック丸ごと・3連勝で huge
- **数は数え上げる**（`odometer`）。ポットとスタックは直線で数え、数えている間だけ朱になる。
  緩めない方が「増えている」ことが読める
- **連勝は卓の縁の太さ**（`body[data-chain]`）。数字を見ていなくても今どこにいるか分かる
- ALL-IN はポーカーの山場なので、誰が押しても卓に刻む
- 場札は配られた瞬間に `steps(3)` で一度だけ刻まれる。伏せ札ではなく空き枠から入れ替わる

**ランの形を常時見せる**（ローグライク側の旨み）:
- ヘッダに**8階のトラック**。突破済＝墨のベタ／現在＝朱／ボス＝45度の菱形
- **CASH LINE のゲージ**。数字の下の2pxの帯が満ちていく。越えた瞬間だけ `CASH LINE` を刻む
- 手札の帯に**能力ラックの升目**。ビルドが常に見えている

## 視認性の作り直し (2026-09-08 / kozakiの指摘への対応)

「MIXEDとか分かりづらい / 黒い文字が重なる / 演出が速すぎる / 誰が誰に何を使ったか分からない /
自動か手動か分からない」への対応。**kozakiの許可を得て色を増やした**。朱一色の縛りはここで解いている。

**能力の4系統に色を割り当てた**（面と文字で明度を分ける規約はそのまま、実測値つき）:

| 系統 | 面 | 面の上の文字 | 紙の上の文字 |
|---|---|---|---|
| ヒント | `#2563A8` | **紙色**（5.22:1）| `#16457A`（8.26:1）|
| 相手を妨害 | `#EF5828` | 墨（5.60:1）| `#C43A12`（4.52:1）|
| チップ補助 | `#3FAE4A` | 墨（6.76:1）| `#146B12`（5.70:1）|
| カード・ルール変更 | `#F2C200` | 墨（11.47:1）| `#7A5E00`（5.22:1）|

同じ色を**席の能力札・手札帯のラック・能力カード・発動の告知・レシート・効いた席の縁**の
全部に同じ位置で出す。色が系統を語るので、文字を読まなくても種類が分かる。

- **告知は卓を横切る帯**にした（sshhooggii の「盤を横切る反転した帯」と同じ）。
  以前は卓の中央に置いていて**場札を完全に隠していた**（実測で確認）。いまは場札の下に出る。
  勝ち負けのときだけ従来どおり中央で殴る
- 帯には **系統｜自動/手動 → 誰が → 誰に → 能力名 → 何が起きたか** を一列で出す。
  自分に効くものは矢印を出さない（「CPU 2 → CPU 2」は読めない）
- **自動と手動を札で区別**する。手動は朱の面、自動は墨の面。押せる状態の手動能力は点滅する
- **英語の略語をやめた**。`MIXED`→`ふつう`、`POT ODDS 20%`→`コールに必要な勝率 20%`、
  `NEXT 15/30 / 2 HANDS`→`次の参加額 15/30（あと2回）`、`DEALER`→`ディーラー / 最後に動く`
- **告知の長さを戻した**（1100→2100ms）。ただし3枚以上たまっているときだけ0.58倍に縮める。
  1枚のときは読み切れる長さを保ち、連発では詰まらせない
- **チップを描き直した**。13px格子の円盤に縁の切り欠きと中心の抜き。
  額の単位で色が変わる（〜1BB 灰 / 〜3BB 青 / 〜8BB 朱 / それ以上 緑）。実物のカジノと同じ約束

実測: 稼働中の卓で見えている文字要素44個の**重なり0**、告知の帯と場札の重なりなし。

### 決着は卓の上で（フェーズK）

全画面のショウダウン幕は廃止。**中央の共通5枚を隠さない**のが原則。
決着は席そのものが担う——手札が拡大して**同時に**開き、席の下に役名の小さな墨札が出る。
勝者の席だけが反転する。順送りの開示は時間がかかりすぎて却下した。

「いまのルール」のような常時表示は卓の面に置かない。卓の面は席と場札だけのものにして、
状態表示は手前の帯にまとめる。

### 書体（フェーズP）

**IBM Plex** に統一した。Sans JP と Mono の2ファミリー、ウェイトは 400 と 600 だけ。

それまでは `Avenir → Futura → Hiragino → Yu Gothic` と積んでいた。3つ問題があった。

1. **意匠が決まっていなかった。** Avenir が載っていない機ではラテンが和文書体に落ちる。
   つまり「機種ごとに別の書体で表示されるページ」を作っていた
2. **参照と方向が逆だった。** 掲げていた Raster-Noton / Chain Reaction の実物は
   ネオグロテスクとタイプライターで、Avenir や Futura のような幾何学系の
   丸く柔らかい骨格とは反対側にある
3. **ラテンと和文が別設計**なので、同じ級数・同じウェイトでも濃度が揃わなかった

Plex は IBM の技術文書とコードのために Bold Monday が引いた面で、
「計器盤・仕様書」という卓の言い分とそのまま重なる。Mono はタイプライターの
骨格を残していて、Chain Reaction の袋（タイプライター組み）と同じ手触りになる。
Sans JP は和文とラテンが同じ設計なので、太さと濃度が揃う。

**組みの規約**

- `font-feature-settings:"palt" 1,"tnum" 1` を地に敷く。palt は和文の詰め
  （既定の全角ベタ組みはこの級数だと間延びする）、tnum は数字の幅揃え
  ——チップは毎手カウントアップするので、幅が動くと数字自体が揺れて読めない
- **詰めは em で書く。** px 指定は級数を変えた瞬間に比が壊れる（0件まで直した）
- **極小ラベルの詰めを2種に分けた。** 欧文だけのラベルは大文字＋`.14em`
  （計器盤の声はここで出る）。和文が混ざるものは `.06em`。
  `.14em` は欧文の大文字組みの作法で、和文に当てるとバラバラに見える
- **和文が入る極小ラベルは 9px を禁じ、10px を下限にした。**
  同じ級数でも和文は画数ぶん潰れる
- `-webkit-font-smoothing:antialiased` を外した。紙地の明るい面では
  400 が痩せて弱くなる。素の描画のほうが本来の太さが出る

### 呼び名

卓の相手から「CPU」を消し、**席2〜席6**にした。カジノの Seat 1..9 と同じ数え方で、
画面のどこにも機械の名前を残さない。ログ・相手の能力表・順位表もこれで揃う。

### 決着の板（フェーズN）

終わりは卓の上で作ってから板を出す。順序は **FINAL → チップが降る → 席の反転 →
勝者名 → 順位表**。板が先に出ると、何が起きて終わったのかが見えない。

最終順位表は罫だけの表。順位はモノの極小、名前はサンセリフ、チップは大きく右寄せ。
勝者の行だけ朱地に反転し、飛んだ席は 0.4 に落として「脱落」を添える。
行は上から 90ms ずつ steps で立ち上げる（イージングは使わない）。

### ローカル通信の合図

中継を置かない以上、手渡しの手順そのものが画面になる。①②の番号を振り、
出すコードと貼るコードを取り違えられない形にした。状態は常に一語で朱く出す
（未接続／コードを作成中／相手のコード待ち／接続できました／切断されました）。

### 系統シナジーの見せ方（フェーズO）

効いているものは**系統色の面**、あと1枚のものは**破線の枠に灰**。同じ行に並べて、
「持っているもの」と「あと少しのもの」が一目で分かれる形にした。
名前（追撃・厚み・暴走…）はサンセリフの太字、系統名は極小のモノ。

相手のシナジーは相手の能力表に**塗りつぶしのバッジ**で置く。自分のものより強い
コントラストにしてあるのは、相手の脅威のほうが先に目に入るべきだから。

### 揺れ

`steps()` で刻む。なめらかな揺れは安っぽくなる。使うのは ALL-IN・ALL-IN 対決・
大きい山・系統の完成・決着の5つだけ。増やすと読めない画面になる。
`prefers-reduced-motion` では止める。

### 卓の上に出す字（フェーズR）

**素の字を卓の上に置かない。** 席・札・罫の上に落ちた瞬間に読めなくなる。
下地は3種だけ:

- **墨の反転** — 通常の一語（役名、回戦の区切り）
- **緑** — 守りが働いたとき。攻めと同じ見え方だと、どちらが起きたか読めない
- **朱** — 決着と最大級

枠は 2px の墨。1px の灰では卓の罫に紛れる。

### 縦持ちの端末

卓の楕円は横幅の意匠なので、600px 以下では**組み方そのものを変える**。
席は3列のグリッドに畳み、名前・チップ・直近の行動だけ残す。
ヘッダの段見出しは落とす（卓の帯が同じことを言っている）。
操作盤は親指の届く下端に貼る。
