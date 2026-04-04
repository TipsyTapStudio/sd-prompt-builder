# SD Prompt Builder - PRD v1.1

## プロジェクト情報

| 項目 | 内容 |
|---|---|
| リポジトリ名 | `sd-prompt-builder` |
| オーナー | Tipsy Tap Studio |
| ライセンス | TBD |
| URL（予定） | `https://tipsytapstudio.github.io/sd-prompt-builder/` |

## 概要

Stable Diffusion 向けの構造化プロンプトを、セクションごとのフォームUIで組み立て・生成するWebアプリ。
手書きより楽で、かつ構造化テンプレートのルールに沿ったプロンプトを出力する。

A1111 の外でプロンプトの企画・設計・管理を行い、生成時にコピーして貼るワークフローを想定。
A1111 を起動していなくてもブラウザだけでプロンプトの整理・メモ・保存ができる。

## 背景・動機

- SD プロンプトはテキストベタ書きだと長くなり、セクション間の整合性が崩れやすい
- A1111 の Styles 機能やテンプレ系 Extension はタイトル・メモが書けず管理しづらい
- A1111 が起動していないと触れない制約がある
- 構造化テンプレートを策定し、セクション分類・ウェイト管理・Dynamic Prompts 記法のルールを整備した
- このテンプレートをUIに落とし込むことで、プロンプト作成の効率化と品質安定を実現する

## ターゲットユーザー

- Stable Diffusion（主に A1111 / Forge）でリアル系・イラスト系の画像生成を行うユーザー
- 自分自身（Tipsy Tap Studio）の制作ワークフローでの利用が主

---

## 構造化プロンプト仕様

### セクション定義（Positive）

生成プロンプトは以下の順序で構成する。順序はトークンの前方ほど影響が強い SD の特性を考慮。

| # | セクション名 | 役割 | 必須/任意 |
|---|---|---|---|
| 1 | Quality & Technical | 品質・技術的指定（モデルへの前提条件） | 必須 |
| 2 | Style / Aesthetic | 画風・スタイル指定 | 任意 |
| 3 | Face & Hair | 顔・髪型・髪色・表情 | 必須 |
| 4 | Body | 体型・プロポーション | 必須 |
| 5 | Outfit | 衣装・アクセサリー | 必須 |
| 6 | Composition & Pose | 構図・アングル・ポーズ・小道具 | 必須 |
| 7 | Effects / Expression | 漫画的演出・エフェクト（汗・効果音等） | 任意 |
| - | **BREAK** | 被写体と環境の分離 | 必須 |
| 8 | Environment & Lighting | 背景・場所・天候・光源 | 必須 |
| 9 | Lora | LoRA 指定 | 任意 |

### セクション定義（Negative）

| # | セクション名 | 役割 |
|---|---|---|
| N1 | General Quality | 品質除外（worst quality, blurry 等） |
| N2 | Body & Anatomy | 破綻防止（bad hands, extra fingers 等） |
| N3 | Skin & Realism | のっぺり防止（smooth skin, plastic skin 等） |
| N4 | Lighting | ライティング除外（flat lighting 等） |
| N5 | Composition (situational) | 構図除外（状況依存：standing, lying down 等） |

### BREAK の配置ルール

- 被写体セクション（Composition & Pose / Effects まで）と環境セクション（Environment & Lighting）の間に BREAK を挿入
- 人物と背景の特徴混合を防止する目的

---

## 記法ルール

### 括弧の使い分け

| 記法 | 用途 | 例 |
|---|---|---|
| `(tag:weight)` | SD ウェイト指定 | `(brown hair:1.3)` |
| `{a \| b \| c}` | Dynamic Prompts バリエーション / テンプレートのプレースホルダー | `{smile \| grin \| laugh}` |

### ウェイト指定ガイドライン

- **引き算のアプローチ**: まずウェイトなしで生成し、足りない要素だけピンポイントでウェイトを追加
- デフォルト（1.0）で十分な要素には付けない
- ウェイトを付ける場合も 1.2〜1.3 程度に抑える
- 「全部強調＝何も強調していない」状態を避ける
- LoRA は 0.5〜1.0 が安定帯。1.5 以上はアーティファクト・破綻リスク

### Dynamic Prompts 記法（参考）

```
# 基本（1つ選択）
{artist1|artist2|artist3}

# 複数選択（2つ選ぶ）
{2$$artist1|artist2|artist3}

# 範囲（1〜3個ランダム）
{1-3$$artist1|artist2|artist3}

# 確率ウェイト（artist1 が 2 倍選ばれやすい）
{2::artist1|artist2}

# joiner 変更（カンマの代わりに and）
{2$$and$$floral|striped|checkered}

# Wildcard（外部テキストファイル参照）
__poses__

# Variables（プロンプト横断で値を統一）
${time=!{morning|noon|sunset|night}}
beach, ${time} sky, ${time} lighting,
```

#### Dynamic Prompts 運用上の注意

- Combinatorial generation ON 時は `{}` の箇所数 × 選択肢数の掛け算で総枚数が決まる（batch count は無視される）
- 複数箇所の `{}` は独立してランダム選択される
- 比較目的なら `{}` は 1 箇所に限定し、他の要素は固定する方が結果を評価しやすい
- 複数軸の比較は xyz plot との併用が安定

---

## 分類ルール

プロンプト要素をどのセクションに配置するかの判断基準。

| 要素の性質 | 配置先セクション |
|---|---|
| 身体の状態（汗、涙、赤面、濡れ肌） | Body / Face & Hair（表現される場所に応じて） |
| 身につけるもの（服、アクセサリー） | Outfit |
| 手に持つもの・使うもの（マグカップ、傘、スマホ） | Composition & Pose（動作とセットで記述） |
| 周囲にあるもの（テーブルの花瓶、背景の看板） | Environment |
| 漫画的演出（効果音、集中線、ハート） | Effects / Expression |
| カメラアングル・フレーミング | Composition & Pose |

**判断の原則**: 「それは身体に属するか、行動に属するか、環境に属するか」

---

## サンプルプロンプト

### ビーチ × リアル系

```
### Quality & Technical
masterpiece, best quality, ultra high res, RAW photo, photorealistic,
detailed skin texture, visible pores, skin fuzz,
detailed shadow, sharp focus, depth of field,

### Face & Hair
1 girl, (brown hair:1.3), bangs, (low twintails:1.3), smile, looking at viewer,

### Body
small breasts, slim waist,

### Outfit
vivid pastel color micro bikini with cute pattern,

### Composition & Pose
slight low angle, (close-up upper body:1.2), peace sign, head tilt,

BREAK

### Environment & Lighting
beach, coastline, dark blue sky, cumulonimbus cloud, noon,
natural sunlight, harsh sunlight, dappled light on skin,
rim lighting, light and shadow on face,

---

### Negative - General Quality
worst quality, low quality, normal quality, blurry, out of focus,
jpeg artifacts, lowres, watermark, signature, text, error, cropped, duplicate,

### Negative - Body & Anatomy
bad anatomy, bad hands, extra fingers, missing fingers, extra limbs,
deformed, disfigured, mutated, ugly,

### Negative - Skin & Realism
smooth skin, plastic skin, airbrushed skin,
cgi, 3d render, illustration, painting, drawing,

### Negative - Lighting
flat lighting, flat shading,
```

### 砂浜に寝ているポーズ（変更箇所のみ）

```
### Composition & Pose
(from above:1.2), (lying on back:1.3), arms spread out, relaxed pose,

### Environment & Lighting
(on sand:1.3), beach, coastline, ...

### Negative - Composition (situational)
standing, sitting,
```

---

## 体型タグリファレンス

### 細さのグラデーション

| タグ | 印象 |
|---|---|
| `skinny` | かなり痩せ、骨っぽくなりがち |
| `slim` | 細身、場合によって細すぎる |
| `slender` | すらっとした健康的な細さ |
| `slim waist` | ウエストだけ細い（全体には影響しにくい） |
| `soft body` / `healthy body` | 柔らかさ・健康的な肉付き |

### 体型プリセット

```
# 小柄・華奢系
petite, slim waist, soft body,

# 高身長・モデル系
tall girl, slender, slim waist, long legs,

# 標準・健康的
slim waist, healthy body,
```

### 身長の印象制御

- 体型タグ（Body）とアングル・フレーミング（Composition & Pose）の両方をセットで調整
- `low angle` → 背が高く見える / `high angle` → 小さく見える
- `close-up upper body` では身長の印象はほぼ伝わらない
- 年齢の数値指定は非推奨（モデルによる解釈のブレが大きい）

---

## リアル系クオリティアップ Tips

### Positive に追加すべきタグ

```
RAW photo, photorealistic,
detailed skin texture, visible pores, skin fuzz,
depth of field,
harsh sunlight, dappled light on skin, rim lighting, light and shadow on face,
```

### Negative に追加すべきタグ

```
smooth skin, plastic skin, airbrushed skin,
flat lighting, flat shading,
cgi, 3d render, illustration, painting, drawing,
```

### 構図内の人物占有率を上げる方法

1. `upper body` → `close-up upper body` でフレーミングを寄りに
2. 背景タグのウェイトを下げる（1.0 デフォルトに戻す）
3. Negative に `wide shot, distant view, full body landscape` を追加
4. 被写体のウェイトと背景のウェイトのバランスを意識

---

## アプリ機能要件

### MVP（Phase 1）

- [ ] セクションごとの入力フォーム（Positive / Negative 両方）
- [ ] 各セクションにテキストエリアでプロンプトを記入
- [ ] セクション順序はテンプレートに準拠（並び替え不要）
- [ ] 「プロンプト生成」ボタンでセクションを結合し、BREAK を含む最終プロンプトを出力
- [ ] Positive / Negative それぞれのコピーボタン
- [ ] セクション見出し（### コメント）を出力に含めるかどうかのトグル
- [ ] よく使うタグのプリセットボタン（セクションごと）
- [ ] プリセットのカテゴリ例:
  - Quality & Technical: `masterpiece, best quality` / `RAW photo, photorealistic` / `detailed skin texture, visible pores`
  - Face & Hair: 髪色、髪型、表情
  - Body: 体型プリセット（小柄系 / モデル系 / 標準系）
  - Composition & Pose: アングル、フレーミング、ポーズ
  - Negative: 基本セット / リアル系追加セット
- [ ] プロンプトの保存・読み込み（LocalStorage）
  - タイトルとディスクリプションを付けて保存
  - 保存済みプロンプト一覧からの読み込み
  - 保存済みプロンプトの削除
- [ ] プロンプト一覧の表示（タイトル・説明・更新日時）

### Phase 2（検討中）

- [ ] Dynamic Prompts `{}` 記法の生成支援 UI（選択肢をカンマ区切りで入力 → `{a|b|c}` に変換）
- [ ] サジェスト機能（セクションに応じた候補タグを表示）
- [ ] 日本語 → 英語タグ翻訳補助
- [ ] プリセットのカスタマイズ（ユーザーが自分で追加・編集）
- [ ] JSON ファイルとしてエクスポート / インポート（バックアップ・移行用）

### Phase 3（将来構想）

- [ ] Wildcard ファイルの管理 UI
- [ ] Variables `${}` の設定 UI
- [ ] プロンプト履歴管理
- [ ] 画像メタデータ（PNGInfo）からのプロンプト読み込み・構造化

---

## データモデル

### LocalStorage 設計

永続化は LocalStorage を使用。DB は不要。

- 容量: ドメインあたり 5〜10MB（プロンプト 1 件あたり数 KB、数百件保存可能）
- キー: `sd-prompt-builder:prompts` に全プロンプトを JSON 配列で格納
- 読み書き速度: テキストデータのみのため十分高速

#### データ構造

```json
{
  "id": "20250403_001",
  "title": "ビーチ × ツインテール × リアル系",
  "description": "夏ビーチの基本テンプレ。髪型バリエーション探索用",
  "created_at": "2025-04-03T15:00:00",
  "updated_at": "2025-04-03T15:30:00",
  "sections": {
    "quality": "masterpiece, best quality, ultra high res, ...",
    "style": "",
    "face_hair": "1 girl, (brown hair:1.3), bangs, ...",
    "body": "small breasts, slim waist,",
    "outfit": "vivid pastel color micro bikini with cute pattern,",
    "composition": "slight low angle, (close-up upper body:1.2), ...",
    "effects": "",
    "environment": "beach, coastline, dark blue sky, ...",
    "lora": ""
  },
  "negative_sections": {
    "general_quality": "worst quality, low quality, ...",
    "body_anatomy": "bad anatomy, bad hands, ...",
    "skin_realism": "smooth skin, plastic skin, ...",
    "lighting": "flat lighting, flat shading,",
    "composition": ""
  }
}
```

#### LocalStorage キー設計

| キー | 内容 |
|---|---|
| `sd-prompt-builder:prompts` | 保存済みプロンプト配列（JSON） |
| `sd-prompt-builder:settings` | アプリ設定（セクションコメント表示トグル等） |

#### 注意事項

- LocalStorage はブラウザのキャッシュクリアで消失するリスクがある
- Phase 2 で JSON エクスポート / インポート機能を追加しバックアップ手段を提供

---

## 技術スタック

| 項目 | 選定 | 理由 |
|---|---|---|
| フレームワーク | React（.jsx） | コンポーネント指向でフォーム UI と相性が良い |
| スタイリング | Tailwind CSS | ユーティリティベースで素早くスタイリング可能 |
| 永続化 | LocalStorage | サーバー不要、テキストデータのみで容量十分 |
| ビルドツール | Vite | 軽量・高速、React との組み合わせが標準的 |
| デプロイ | GitHub Pages or Vercel | 静的サイトとしてデプロイ、サーバー費用ゼロ |
| 開発ツール | Claude Code | PRD.md → CLAUDE.md ワークフローで開発 |

### 外部ライブラリ（想定）

- クリップボードコピー: `navigator.clipboard.writeText()`（ブラウザ標準 API）
- ID 生成: タイムスタンプベースで十分（UUID ライブラリ不要）
- 状態管理: React useState / useReducer で十分（Redux 等は不要）

---

## UI / UX 設計

### 画面構成

```
┌─────────────────────────────────────────────────┐
│  SD Prompt Builder                    [保存一覧] │
├─────────────────────────────────────────────────┤
│                                                  │
│  タイトル: [________________________]            │
│  説明:     [________________________]            │
│                                                  │
│  ── Positive ──────────────────────────────────  │
│                                                  │
│  ▼ Quality & Technical          [プリセット▼]   │
│  ┌──────────────────────────────────────────┐   │
│  │ masterpiece, best quality, ...           │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ▼ Style / Aesthetic (任意)     [プリセット▼]   │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ▼ Face & Hair                  [プリセット▼]   │
│  ┌──────────────────────────────────────────┐   │
│  │ 1 girl, (brown hair:1.3), ...            │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ▼ Body                         [プリセット▼]   │
│  ┌──────────────────────────────────────────┐   │
│  │ small breasts, slim waist,               │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ▼ Outfit                       [プリセット▼]   │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ▼ Composition & Pose           [プリセット▼]   │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ▼ Effects / Expression (任意)  [プリセット▼]   │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│           ─── BREAK ───                          │
│                                                  │
│  ▼ Environment & Lighting       [プリセット▼]   │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ▼ Lora (任意)                                  │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ── Negative ──────────────────────────────────  │
│                                                  │
│  ▼ General Quality              [プリセット▼]   │
│  ┌──────────────────────────────────────────┐   │
│  │ worst quality, low quality, ...          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ▼ Body & Anatomy              [プリセット▼]   │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ▼ Skin & Realism             [プリセット▼]   │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ▼ Lighting                    [プリセット▼]   │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ▼ Composition (situational)   [プリセット▼]   │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ── 出力 ──────────────────────────────────────  │
│                                                  │
│  [☐ セクション見出しを含める]                    │
│                                                  │
│  Positive:                            [コピー]   │
│  ┌──────────────────────────────────────────┐   │
│  │ masterpiece, best quality, ...           │   │
│  │ BREAK                                    │   │
│  │ beach, coastline, ...                    │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Negative:                            [コピー]   │
│  ┌──────────────────────────────────────────┐   │
│  │ worst quality, low quality, ...          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  [保存]  [新規作成]                              │
│                                                  │
└─────────────────────────────────────────────────┘
```

### UI/UX 方針

#### 全体

- シングルページ構成。メイン画面（エディタ）と保存一覧のモーダル or サイドパネル
- 入力 → プレビュー → コピーの流れが 1 画面で完結する
- 凝りすぎない「フォームに毛が生えた」程度のシンプルさを維持

#### フォーム部分

- 各セクションは折りたたみ可能（▼ アコーディオン）
- 任意セクション（Style / Effects / Lora）はデフォルトで閉じておく
- テキストエリアは 2〜3 行の高さで、内容に応じて自動伸縮
- BREAK の位置は視覚的に区切り線で表示し、セクション間の境界を明確化

#### プリセットボタン

- 各セクション横に [プリセット▼] ドロップダウン
- クリックするとテキストエリアの末尾にタグを追記（上書きではない）
- プリセットデータは `/src/data/presets.json` で一元管理し、拡張しやすくする

#### 出力部分

- Positive / Negative を分けて表示（A1111 にそれぞれ貼る運用に対応）
- 各出力エリアに [コピー] ボタン（クリック後「Copied!」フィードバック）
- セクション見出し（`### Quality & Technical` 等）を含めるかのトグル
  - ON: 可読性重視（保管・共有用）
  - OFF: A1111 にそのまま貼れるクリーンな出力

#### 保存・読み込み

- [保存] ボタンで現在のフォーム内容を LocalStorage に保存
- タイトル未入力の場合は保存時にプロンプト（入力ダイアログ）を出す
- [保存一覧] からモーダル or サイドパネルで一覧表示
  - 各項目: タイトル / 説明（1行） / 更新日時
  - [読み込み] [削除] ボタン
- 読み込み時、現在の入力内容がある場合は上書き確認ダイアログ

#### カラースキーム・トーン

- ダーク系の配色（SD の生成画面と並べて使うため、目に優しいトーン）
- セクションごとに左端に色付きバーを入れ、視覚的に区別しやすくする
- Positive セクション: ブルー系のアクセント
- Negative セクション: レッド系のアクセント
- BREAK 区切り: オレンジ系のラインで視覚的に目立たせる

---

## 設計方針

- シンプルなフォーム UI を基本とし、凝りすぎない
- セクション構造はこの PRD の仕様に準拠
- プリセットデータは JSON で管理し、拡張しやすくする
- モバイル対応は後回し（PC での利用が主）
- コンポーネント分割はセクション単位（PromptSection コンポーネントの再利用）
- ビジネスロジック（プロンプト結合、保存/読み込み）はカスタム hooks に切り出す

### ディレクトリ構成（想定）

```
src/
├── App.jsx                   # メインレイアウト
├── components/
│   ├── PromptSection.jsx     # 各セクションのフォーム（再利用可能）
│   ├── PresetDropdown.jsx    # プリセット選択ドロップダウン
│   ├── OutputPanel.jsx       # 生成結果の表示・コピー
│   ├── SaveModal.jsx         # 保存一覧モーダル
│   └── BreakDivider.jsx      # BREAK の視覚的区切り
├── hooks/
│   ├── usePromptBuilder.js   # プロンプト結合ロジック
│   └── useStorage.js         # LocalStorage 読み書き
├── data/
│   ├── presets.json          # プリセットタグ定義
│   └── sections.json         # セクション定義（名前・キー・必須/任意）
└── styles/
    └── (Tailwind で管理、追加 CSS は最小限)
```

---

## 更新履歴

| バージョン | 日付 | 内容 |
|---|---|---|
| v1.0 | 2025-04-03 | 初版作成。構造化テンプレート仕様、サンプル、アプリ要件を策定 |
| v1.1 | 2025-04-03 | データモデル、技術スタック詳細、UI/UX 設計、ディレクトリ構成を追加。保存機能を MVP に移動。リポジトリ名 `sd-prompt-builder` 決定、プロジェクト情報・背景追記 |
