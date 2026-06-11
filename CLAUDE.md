# CLAUDE.md - Portrait Prompt Builder for SDXL (PPB)

## プロジェクト概要

人物ポートレート特化の Stable Diffusion 向け構造化プロンプトビルダー。
セクションごとのフォーム UI でプロンプトを組み立て、コピーして A1111/Forge に貼るワークフロー。

略称: PPB for SDXL

## 技術スタック

- React 19（JSX）+ Vite 8
- Tailwind CSS v4
- LocalStorage（永続化 + Draft 自動保存）
- 翻訳: Chrome Translator API / MyMemory API（手動ボタン式）
- デプロイ: GitHub Pages（未設定）

## 開発ルール

### サブエージェント運用ルール

- **UI/UX 変更は必ず UX レビューサブエージェントに相談してから実装する**
- **実装後はテスターサブエージェントで動作確認する（特にモーダル・レイヤー問題）**
- エンジニアサブエージェントは worktree 分離で並列実装可能
- プランナー（親エージェント）は判断を急がず各担当の意見を聞いてから実装に進める

### コーディング規約

- コンポーネントは関数コンポーネント + Hooks
- 状態管理は useState / useReducer（Redux 等は使わない）
- 外部ライブラリは最小限（ブラウザ標準 API を使う）
- CSS は Tailwind ユーティリティクラスのみ
- プリセットデータは `src/data/` 配下の JSON で管理
- モーダルは `createPortal(jsx, document.body)` でレンダリングする（サイドバーの overflow-hidden 問題を回避）

### ディレクトリ構成

```
src/
├── App.jsx                       # メインレイアウト（サイドバー + ヘッダー + コンテンツ）
├── components/
│   ├── Sidebar.jsx               # 左サイドバー（プロンプト一覧、フォルダ、日付グルーピング）
│   ├── SidebarFolderItem.jsx     # サイドバーのフォルダ項目（DnD 受け入れ）
│   ├── SidebarSceneItem.jsx      # サイドバーのシーン項目
│   ├── RenameInline.jsx          # インライン名前変更
│   ├── PromptSection.jsx         # 各セクションのフォーム（2ペイン: テキスト + ベンチ）
│   ├── BenchChip.jsx             # ベンチタグチップ（ホバー翻訳）
│   ├── HighlightOverlay.jsx      # テキストエリアのシンタックスハイライト（コメント・非ベンチタグ）
│   ├── OutputPanel.jsx           # プレビューパネル（Positive/Negative 上下表示、sticky bottom）
│   ├── BreakDivider.jsx          # BREAK の視覚的区切り
│   ├── GalleryPanel.jsx          # 生成結果ギャラリー（サムネイルストリップ、ぼかし）
│   ├── ImageDetailModal.jsx      # 画像詳細モーダル（パラメータ表示、Seed コピー）
│   ├── DropOverlay.jsx           # ファイルドラッグ中の全画面ドロップオーバーレイ
│   ├── StoryboardView.jsx        # ストーリーボード（シーンカード一覧）
│   ├── SceneCard.jsx             # シーンカード
│   ├── StoryDecomposeModal.jsx   # ストーリー分解モーダル
│   ├── SceneExpansionModal.jsx   # 前後シーン生成モーダル
│   ├── ConsistencyCheckModal.jsx # 整合性チェックモーダル
│   ├── MarkdownExportModal.jsx   # Markdown エクスポートモーダル
│   ├── PromptAnalysisModal.jsx   # プロンプト分析テンプレート + 取り込み機能
│   ├── SaveConfirmModal.jsx      # 保存確認モーダル（上書き/新規選択）
│   └── SettingsModal.jsx         # 設定モーダル（翻訳・ベンチ・ぼかし・データ管理）
├── hooks/
│   ├── usePromptBuilder.js       # プロンプト結合ロジック（コメント除去含む）
│   ├── useStorage.js             # LocalStorage CRUD + Draft 自動保存
│   ├── useFolders.js             # フォルダ（シーングルーピング）管理
│   ├── useImageGallery.js        # 生成結果ギャラリー状態（IndexedDB ミラー）
│   └── useTranslator.js          # 翻訳 Hook（Chrome/MyMemory/AUTO/OFF）
├── utils/
│   ├── commentParser.js          # コメントパーサー（// 行コメント、/* ブロック */）
│   ├── benchFormat.js            # ベンチ記法の整形・パース
│   ├── promptParser.js           # AI 出力（### セクション）のパース
│   ├── markdownPromptParser.js   # Markdown インポートのパース
│   ├── imageMetadata.js          # 画像内 SD パラメータ抽出（PNG tEXt / JPEG EXIF）
│   ├── imageDb.js                # ギャラリー用 IndexedDB ラッパー + サムネイル生成
│   ├── sensitive.js              # センシティブ判定（完全一致 + 部分一致）・ぼかし設定
│   └── tagTranslationCache.js    # タグ翻訳キャッシュ
├── data/
│   ├── presets.json              # ベンチプリセットタグ定義（# グループ / // サブラベル）
│   ├── sections.json             # セクション定義
│   └── samplePrompts.js          # サンプルプロンプト（初回起動時に自動ロード）
└── styles/
    └── (Tailwind で管理)

scripts/
└── test-image-metadata.mjs       # 画像メタデータパーサーの単体テスト（node で実行）
```

### UI 構造

- **サイドバー**（260px、スライドイン/アウト）: プロンプト一覧（日付グルーピング）、新規作成、Import、分析テンプレート、Export、設定
- **ヘッダー**（sticky top）: サイドバー開閉、タイトル▼メニュー、翻訳ステータス、保存ボタン（3状態）
- **メインコンテンツ**: セクション入力（2ペイン: テキスト + ベンチゾーン）
- **プレビューパネル**: Positive/Negative 上下表示、編集可能、コピーボタン

### データ設計

LocalStorage:
- `sd-prompt-builder:prompts` — 保存済みプロンプト配列
- `sd-prompt-builder:bench` — ベンチタグデータ（セクションごと）
- `sd-prompt-builder:draft` — Draft 自動保存（デバウンス 1.5 秒）
- `sd-prompt-builder:settings` — アプリ設定
- `sd-prompt-builder:folders` / `:folder-state` — フォルダ定義 / 開閉状態
- `sd-prompt-builder:tag-translations` — タグ翻訳キャッシュ
- `sd-prompt-builder:sensitive-keywords` — センシティブ判定キーワード
- `sd-prompt-builder:bench-collapsed` / `:gallery-collapsed` — 折りたたみ状態
- `sd-prompt-builder:gallery-blur` — ギャラリーぼかしモード（keyword/all/off）

IndexedDB（DB 名 `sd-prompt-builder-images`、ストア `images`、index: promptId）:
- 生成結果ギャラリーのサムネイル Blob + 抽出パラメータ。原寸画像は保存しない
  （ユーザーの Google Drive 管理。Colab → Drive → Drive for Desktop の G:\ 経由）

### ベンチゾーン記法

```
# GROUP_NAME     → グループヘッダー（太字 + 横線）
// sublabel      → サブラベル（● ドット + テキスト）
tag1, tag2       → 通常タグ（チップ表示）
```

### 注意事項

- `()` は SD のウェイト記法 — そのまま保持
- `{}` は Dynamic Prompts 記法 — パイプ区切りのタグもベンチ判定・翻訳に対応済み
- BREAK は Positive の Composition & Pose / Effects と Environment & Lighting の間に自動挿入
- Negative に BREAK は入れない
- localStorage のキー名は変更しない（後方互換性）
- モーダルは必ず createPortal で document.body にレンダリング
- GalleryPanel は OutputPanel（sticky bottom-0 z-40）より DOM 上流に置く（下だと隠れる）
- DropOverlay は `Files` ドラッグ型のみに反応させる（内部 DnD の `text/x-ppb-scene` / `text/plain` と分離）
- センシティブ判定: ベンチのメタラベルは `matchesSensitive`（完全一致）、生プロンプト文字列は `textContainsSensitive`（部分一致）を使う

## 次回やるべきこと

### 優先度高
- GitHub Pages デプロイ設定
- セクション名の曖昧マッチ改善（分析取り込みで "Quality and Technical" vs "Quality & Technical" が一致しない問題）
- SceneCard / ストーリーボードへの代表画像サムネイル表示（ギャラリー v2 の最優先フォローアップ）

### 優先度中
- ギャラリー v2: 「画像のプロンプトを取り込む」ボタン（PromptAnalysisModal 連携）、差分表示、シーンカード直接ドロップ、重複登録デデュープ
- テキスト装飾ツールバー（ヘッダーにプレースホルダー設置済み）
- チップ UI + ドラッグ操作（Stream B-2 として計画済み）
- プリセットセット切替（フォト系 / イラスト系）
- Ctrl+Up/Down でウェイト調整
- ダブルクリックで一時無効化（打ち消し線）

### 優先度低
- JSON ファイルからの分析取り込み対応（旧フォーマット互換）
- バージョン履歴 / Undo 機能
- Dynamic Prompts `{}` 記法の生成支援 UI
