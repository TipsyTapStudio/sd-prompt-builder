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
│   ├── Sidebar.jsx               # 左サイドバー（プロンプト一覧、日付グルーピング）
│   ├── PromptSection.jsx         # 各セクションのフォーム（2ペイン: テキスト + ベンチ）
│   ├── HighlightOverlay.jsx      # テキストエリアのシンタックスハイライト（コメント・非ベンチタグ）
│   ├── OutputPanel.jsx           # プレビューパネル（Positive/Negative 上下表示）
│   ├── BreakDivider.jsx          # BREAK の視覚的区切り
│   ├── PromptAnalysisModal.jsx   # プロンプト分析テンプレート + 取り込み機能
│   ├── SaveConfirmModal.jsx      # 保存確認モーダル（上書き/新規選択）
│   └── SettingsModal.jsx         # 設定モーダル（翻訳・ベンチ・データ管理）
├── hooks/
│   ├── usePromptBuilder.js       # プロンプト結合ロジック（コメント除去含む）
│   ├── useStorage.js             # LocalStorage CRUD + Draft 自動保存
│   └── useTranslator.js          # 翻訳 Hook（Chrome/MyMemory/AUTO/OFF）
├── utils/
│   └── commentParser.js          # コメントパーサー（// 行コメント、/* ブロック */）
├── data/
│   ├── presets.json              # ベンチプリセットタグ定義（# グループ / // サブラベル）
│   ├── sections.json             # セクション定義
│   └── samplePrompts.js          # サンプルプロンプト（初回起動時に自動ロード）
└── styles/
    └── (Tailwind で管理)
```

### UI 構造

- **サイドバー**（260px、スライドイン/アウト）: プロンプト一覧（日付グルーピング）、新規作成、Import、分析テンプレート、Export、設定
- **ヘッダー**（sticky top）: サイドバー開閉、タイトル▼メニュー、翻訳ステータス、保存ボタン（3状態）
- **メインコンテンツ**: セクション入力（2ペイン: テキスト + ベンチゾーン）
- **プレビューパネル**: Positive/Negative 上下表示、編集可能、コピーボタン

### データ設計

- `sd-prompt-builder:prompts` — 保存済みプロンプト配列
- `sd-prompt-builder:bench` — ベンチタグデータ（セクションごと）
- `sd-prompt-builder:draft` — Draft 自動保存（デバウンス 1.5 秒）
- `sd-prompt-builder:settings` — アプリ設定

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

## 次回やるべきこと

### 優先度高
- GitHub Pages デプロイ設定
- セクション名の曖昧マッチ改善（分析取り込みで "Quality and Technical" vs "Quality & Technical" が一致しない問題）

### 優先度中
- テキスト装飾ツールバー（ヘッダーにプレースホルダー設置済み）
- チップ UI + ドラッグ操作（Stream B-2 として計画済み）
- プリセットセット切替（フォト系 / イラスト系）
- Ctrl+Up/Down でウェイト調整
- ダブルクリックで一時無効化（打ち消し線）

### 優先度低
- JSON ファイルからの分析取り込み対応（旧フォーマット互換）
- バージョン履歴 / Undo 機能
- Dynamic Prompts `{}` 記法の生成支援 UI
