# CLAUDE.md - SD Prompt Builder

## プロジェクト概要

Stable Diffusion 向け構造化プロンプトビルダー。
セクションごとのフォーム UI でプロンプトを組み立て、コピーして A1111 に貼るワークフロー。

詳細仕様は `PRD.md` を参照。

## 技術スタック

- React（JSX）+ Vite
- Tailwind CSS
- LocalStorage（永続化）
- デプロイ: GitHub Pages

## 開発ルール

### コーディング規約

- コンポーネントは関数コンポーネント + Hooks
- 状態管理は useState / useReducer（Redux 等は使わない）
- 外部ライブラリは最小限（クリップボード等はブラウザ標準 API を使う）
- CSS は Tailwind ユーティリティクラスのみ（カスタム CSS は最小限）
- プリセットデータは `src/data/` 配下の JSON で管理

### ディレクトリ構成

```
src/
├── App.jsx
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
│   └── sections.json         # セクション定義（名前・キー・必須/任意・Positive/Negative）
└── styles/
    └── (Tailwind で管理、追加 CSS は最小限)
```

### UI 方針

- ダーク系配色（SD 生成画面と並べて使うため）
- セクションごとに左端の色付きバーで視覚的に区別
  - Positive: ブルー系
  - Negative: レッド系
  - BREAK: オレンジ系
- セクションは折りたたみ可能（アコーディオン）
- 任意セクション（Style / Effects / Lora）はデフォルトで閉じる
- テキストエリアは内容に応じて自動伸縮

### データ設計

- LocalStorage キー: `sd-prompt-builder:prompts`（プロンプト配列）、`sd-prompt-builder:settings`（設定）
- プロンプト 1 件の構造は PRD.md「データモデル」セクション参照

### 注意事項

- `()` は SD のウェイト記法なので、UI 上で特別扱いしない（そのまま文字列として保持）
- `{}` は Dynamic Prompts 記法。Phase 1 では単なる文字列として扱う
- BREAK は Positive の Composition & Pose と Environment & Lighting の間に挿入
- Negative プロンプトに BREAK は入れない
