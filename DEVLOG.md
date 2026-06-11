# Development Log - Portrait Prompt Builder for SDXL

## 2026-04-05 Session 1: MVP + 大幅拡張

### 開発アプローチ
- Claude Code のサブエージェント（worktree 並列実装）を活用した開発
- UX レビューアー、エンジニア、テスターの役割分担を確立
- **学び**: UI 変更は必ず UX レビューを通す。通さないと手戻りが発生する

### 実装した機能

#### Phase 1 MVP
- セクションごとの入力フォーム（Positive 9 / Negative 5）
- アコーディオン折りたたみ、テキストエリア自動伸縮
- BREAK 区切り（オレンジライン）
- プリセットドロップダウン（後にベンチゾーンに置換）
- 出力パネル（Positive/Negative 分離、コピーボタン）
- 保存・読み込み・削除（LocalStorage）

#### 保存・エクスポート
- サンプルプロンプト 3 件（Beach, Cafe, Night City）自動追加
- JSON エクスポート / インポート（バリデーション付き）
- Markdown エクスポート（ベンチデータ含む）

#### ベンチゾーン（プリセット廃止→2ペイン化）
- 左:テキストエリア / 右:ベンチゾーン（クリック可能タグチップ）
- 使用済みタグ: 緑枠✓（クリックで削除可能）
- DP候補タグ: amber枠◇（{a|b|c} 内のタグ）
- 未使用タグ: グレー（クリックで追加）
- ベンチ開閉パネル化、リサイズ可能ディバイダー
- コメント区切り（`# GROUP` / `// sublabel`）、2階層ラベル
- チップドラッグ並替え、Shift+クリック一括挿入
- カーソル位置への挿入
- ベンチ編集モード（整形表示: ラベル+改行+タグ）

#### コメントシステム
- `//` 行コメント、`/* */` ブロックコメント対応
- 緑色シンタックスハイライト（textarea + 透明オーバーレイ方式）
- 出力時にコメント自動除去
- トークンカウントからもコメント除外

#### テキストエリア強化
- 非ベンチタグをオレンジ色で表示（テンポラリタグの可視化）
- resize: vertical + 自動拡大の共存（userMinHeight 追跡）
- トークン概算カウンター（≈XX/75）

#### プレビューパネル
- Positive/Negative 上下表示（タブから変更）
- ### 見出し色分け、BREAK オレンジ、コメント緑
- headers / comments チェックボックストグル
- クリックで編集 → セクション逆反映
- コードブロック風コピーアイコン

#### サイドバー（Claude Code 風）
- 日付グルーピング（今日/昨日/過去7日間/それ以前）
- プロンプト複製ボタン（📋）、右クリックコンテキストメニュー
- 新規作成、Import、分析テンプレート
- Export JSON、設定モーダル

#### 保存 UX 再設計
- Draft 自動保存（デバウンス 1.5 秒、beforeunload 対応）
- 保存ボタン 3 状態（保存する / 変更を保存 / ✓保存済み）
- 保存確認モーダル（上書き / 新規プロンプトとして保存）
- isDirty 追跡（タイトル横の青ドット●）
- タイトルメニュー（▼）: 編集、コピー保存、元に戻す、MD保存、削除、日時表示

#### 翻訳機能
- Chrome Translator API + MyMemory API（AUTO 切替）
- 手動ボタン式（API 節約）、行ごと翻訳（改行保持）
- Dynamic Prompts `{a|b|c}` 内の各オプション個別翻訳
- 全セクション対応（Positive + Negative）
- エラー表示（API 制限時のガイダンス付き）

#### プロンプト分析テンプレート
- Markdown 出力形式（JSON から変更）
- 取り込みタブ: 貼り付け → プレビュー → 適用の 2 段階フロー
- バリデーション付き（不正入力時のエラー表示）

#### 設定モーダル
- 翻訳エンジン選択（Auto/MyMemory/Chrome/OFF）
- ベンチプリセット初期化
- 全データ削除（バックアップ案内 → 確認の 2 段階）

### コミット数
約 35 コミット

### 次回セッションでやること
→ CLAUDE.md の「次回やるべきこと」セクションを参照

## 2026-06-11 Session: 生成結果ギャラリー

### 経緯
「このプロンプトでどんな画像が生成されたか」を記録したいという要望から。
生成環境は Colab → Google Drive 保存。Drive for Desktop を導入し、G:\ 仮想ドライブ
経由でローカルからアクセスできる構成にした（ストリーミングモード、フォルダ同期は全オフ）。

### 設計判断
- **ハイブリッド保存方式**: サムネイル（長辺512px WebP）+ 抽出パラメータのみ
  IndexedDB に保存。原寸画像は Drive 管理に任せる（容量・eviction 回避）
- A1111/Forge が PNG の `tEXt` チャンク（keyword: parameters）に埋め込む
  生成パラメータを純 JS でパース。JPEG の EXIF UserComment にも対応
- UX レビュー → 実装 → テスターサブエージェント検証（12項目）のフロー

### 実装した機能
- エディタ下部（Negative 後・プレビュー前）の折りたたみ式「生成結果」セクション
  - 横スクロールサムネイルストリップ + 枚数バッジ + 空状態ドロップゾーン
- ファイルドラッグ中のみ出現する全画面ドロップオーバーレイ
  - `Files` 型のみ反応（内部 DnD の `text/x-ppb-scene` 等と分離）
  - 紐付け先プロンプトのタイトルを大書き、空プロンプト時は警告
  - 未保存プロンプトへのドロップは flushAutoSave で ID 確定後に登録
- 詳細モーダル: 画像拡大 / Positive・Negative 全文コピー / Seed 単独コピー /
  Steps・Sampler 等のグリッド / その他パラメータ折りたたみ / 削除
- センシティブぼかし: 画像内プロンプトとキーワードの部分一致判定
  （`textContainsSensitive` 新設）、2段階クリック（解除→モーダル）、
  設定に 3 択（キーワード一致のみ / 常に / なし）
- プロンプト削除時の画像連動削除、全データ削除時の DB 削除
- パーサー単体テスト: `scripts/test-image-metadata.mjs`（Node で実行）
- サイドバー添付インジケーター: 画像が登録されたプロンプト行の最右端に
  画像アイコンを常時表示（Gmail のクリップ方式）。枚数は title ツールチップ、
  アイコンのみ・クリック無動作・ぼかし設定と無関係。`getImageCounts()` の
  一括取得を gallery.images / prompts 変更時に再読込

### 新ファイル
- `src/utils/imageMetadata.js` — PNG/JPEG パラメータ抽出
- `src/utils/imageDb.js` — IndexedDB ラッパー + サムネイル生成
- `src/hooks/useImageGallery.js` — ギャラリー状態管理
- `src/components/GalleryPanel.jsx` / `ImageDetailModal.jsx` / `DropOverlay.jsx`

### 学び
- OutputPanel が `sticky bottom-0 z-40` なので、ギャラリーは必ずその DOM 上流に
  置く必要がある（下に置くと隠れる）
- 既存 `matchesSensitive()` は完全一致（ベンチのメタラベル用）。生プロンプト判定
  には部分一致版が別途必要だった
- Node の Buffer はプール共有のため `buffer.slice(0)` ではなく
  `buffer.slice(byteOffset, byteOffset + length)` でないと ArrayBuffer が壊れる

### v2 候補（UX レビューで明示的にスコープ外としたもの）
- SceneCard への代表画像サムネイル表示（最優先フォローアップ）
- 「画像のプロンプトを取り込む」ボタン（PromptAnalysisModal 連携）
- 画像内プロンプト vs 現在プロンプトの差分表示
- ストーリーボードのシーンカードへの直接ドロップ
- 同一ファイルの重複登録デデュープ（テスターからの指摘）

## 2026-06-12 Session: シーンカード代表画像サムネイル（ギャラリー v2）

### 経緯
ギャラリー v2 の最優先フォローアップ。ストーリーボードを「テキストカードの列」から
本物の絵コンテにするため、各シーンカードに代表画像サムネイルを表示。
設計判断は前セッションの `NEXT_SESSION.md` で確定済み。

### 設計判断（UX レビュー確定事項）
- **画像バンドはカード最上部に全幅配置**（絵コンテ＝画像が主役）。#index と
  3点メニューは上部スクリム付きで画像にオーバーレイ
- **アスペクト比は固定高 `h-32` + `object-cover object-top`**（顔が上寄りの
  ポートレートを優先クロップ。フィルムストリップ的に高さを揃える）
- **画像なしシーンはプレースホルダー枠**（カメラアイコン）を出して高さを統一。
  横並びで高さがガタつく方が画像なし表示より気になる、との判断
- 代表画像 = 最新登録（createdAt 降順の先頭）。手動ピン留めはスコープ外
- ぼかしはカードにも適用（`textContainsSensitive` + blurMode、ギャラリーと同一
  判定）。カードでは 1 クリック = 解除のみ（詳細モーダルは出さない）。
  **`revealed` Set は StoryboardView 側に持つ**（カード再描画で解除が消えない）
- 枚数バッジ（+3 等）はノイズになるため今回は出さない

### 実装した機能
- `SceneCard.jsx`: 画像バンド追加（サムネイル or プレースホルダー）、ぼかし +
  EyeIcon オーバーレイ、objectURL を useMemo + cleanup effect で管理。
  サムネイルクリックはシーンを開かない（既存のクリックモデル＝開くは「開く」/
  メニューのみ、を非破壊）
- `StoryboardView.jsx`: マウント / シーン構成変化時に代表画像を一括読込、
  ぼかし判定・セッション内解除 Set を保持し各カードへ配布
- `imageDb.js`: `getLatestImageForPrompts(ids)` 追加。promptId index を
  keyCursor で 1 パス走査して最新 id だけ拾い、その代表レコードのみ本読込
  （シーン数 × getAll を回避。id は Date.now() 前置なので最大 id ＝ 最新）
- `App.jsx`: StoryboardView へ `sensitiveKeywords` / `blurMode` を配線

### 検証（プレビュー + 合成データ）
- IndexedDB へ canvas 製ダミーサムネイル（成人被写体プロンプト）を直接 put し検証 →
  検証後に `__synthetic` レコードを全削除（実画像は不使用）
- 確認: サムネイル描画 / 最新優先（OLD 灰ではなく NEW 緑が表示）/ NSFW のぼかし +
  EyeIcon / 画像なしカードのプレースホルダー / 1 クリック解除（シーンは開かない）/
  非ぼかしサムネクリックは no-op / 「開く」は正しいシーンをエディタで開く /
  コンソールエラーなし / `npm run build` 成功 / 変更ファイル lint クリーン

### 学び
- React Compiler（`react-hooks/preserve-manual-memoization`）は `useMemo` の
  依存に `[image?.thumb]` のような optional chaining を書くと推論依存（`image`）と
  食い違いエラーになる。`const thumb = image?.thumb` をローカルに引き出してから
  `[thumb]` を依存にすると一致する（GalleryPanel が `[image.thumb]` で通るのは
  optional chaining が無いから）
- Tailwind v4 の `scale-110` は `transform` ではなく独立した `scale` プロパティを
  使う（computed `transform` は `none` のまま。ぼかしの `filter` で可視確認すべき）
