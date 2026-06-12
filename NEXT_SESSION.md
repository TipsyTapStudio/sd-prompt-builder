# 次セッション指示書 — 右ペイン新設(主)+ GitHub Pages デプロイ(副)

> この指示書は Fable 5 セッション(2026-06-12)が作成した実装ブリーフ。
> 「確定済みの設計判断」は再検討せずそのまま実装してよい。
> 「UX レビューで確定させる項目」だけを UX レビューサブエージェントに諮ること。
> プロセスルールは CLAUDE.md に従う。前回の引き継ぎ(シーンカードサムネイル)と同じ流れ。

---

# タスク1(主): エディタ右ペイン「生成結果パネル」

## ゴール

エディタ画面に常設の右ペインを新設し、**スクロールせずに**(ファーストビューで)
生成結果が見えるようにする。構成は上から:

```
┌──────────────┐
│ 代表サムネイル(大)        │ ← 選択中の画像
│ 他サムネイルのストリップ(小) │ ← クリックで選択切替
│ 画像内 Positive  [コピー]  │ ← ★編集中プロンプトではなく
│ 画像内 Negative  [コピー]  │   「画像に埋め込まれていた生成時の値」
│ Seed / Steps / Sampler /  │
│ Model(checkpoint)等      │ ← 長い場合は expand で展開
└──────────────┘
```

ユーザーの動機: 「このプロンプトでどんな絵が出たか」を見ながら編集する
ループが本来の使い方なのに、現状はギャラリーが最下部で動線が遠い。

## 確定済みの設計判断

1. **右ペインに出すのは「画像に埋め込まれていた生成時のプロンプト/パラメータ」**。
   編集中のプロンプト(下部 OutputPanel)とは別物であり、役割は重複しない
2. **デフォルト選択 = 最新登録画像**。ストリップのサムネクリックで選択切替
3. **ペインは折りたたみ可能 + 状態を localStorage に永続化**(新キー追加は可、
   既存キーのリネームは不可)。狭い画面(ノートPC 1366〜1536px)で
   メインの編集領域を圧迫しないことが必須条件
4. **ぼかしはペインにも適用**。判定は既存と同一
   (`textContainsSensitive` + blurMode)。1クリック目=解除、
   解除済みサムネのクリック=ImageDetailModal で拡大(既存ギャラリーと同じ挙動)
5. ImageDetailModal(拡大表示)、`parseSettingsPairs`(ImageDetailModal 内にある。
   流用するなら utils へ抽出してよい)、CopyButton(OutputPanel が export)、
   `useImageGallery` フックはすべて流用する
6. DropOverlay(全画面ドロップ)は変更しない。ファイル選択ボタンと空状態の
   案内文(「保存されるのは縮小サムネイルのみ」等)はペイン側に必ず残す
7. **ストレッチゴール(任意)**: ペインに「このプロンプトを取り込む」ボタン。
   画像内の P/N テキストを PromptAnalysisModal の取り込みフローに渡す。
   工数が膨らむようなら見送って報告のみでよい

## UX レビューで確定させる項目

- **下部 GalleryPanel の処遇**: ストリップごと右ペインへ引っ越して下部セクションを
  廃止するか、両方残すか。Fable の推しは「引っ越して廃止」(同じ情報の住処を
  2つ作らない)だが、レビューで判断してよい
- ペインの幅(300〜340px 想定)と、折りたたみトグルの置き場所(ヘッダー右端?)
- 画面幅が狭いときの挙動(自動折りたたみのブレークポイント等)
- パラメータの expand UI(details? アコーディオン? 「その他」の括り方)
- 空状態(画像0枚)のペイン表示

## 実装ガイド

- レイアウト: App.jsx のエディタ側コンテンツを `flex` 化し、
  メイン(`flex-1 min-w-0`)+ ペイン(`flex-shrink-0`)の横並びに。
  ペインは `sticky top-0 h-screen overflow-y-auto` 系で独立スクロール
- **OutputPanel(sticky bottom-0 z-40)はメインカラム内に留めること**。
  `-mx-4 px-4` のネガティブマージンを使っているので、カラム構造を変える際に
  はみ出しに注意
- objectURL は `useMemo(() => URL.createObjectURL(blob), [blob])` +
  cleanup effect のパターン(GalleryPanel.jsx の Thumb 参照)。
  useMemo/useEffect の依存に optional chaining(`image?.thumb`)を書くと
  React Compiler に弾かれる — ローカル変数に引き出すこと(CLAUDE.md 注意事項)
- データは App.jsx に既にある `gallery`(= useImageGallery(currentId))を配線。
  選択画像 state は新設(画像リスト変化時に存在しない id を指さないようガード)
- ストーリーボードビューには影響させない(エディタビュー限定)

# タスク2(副): GitHub Pages デプロイ

## ゴール

https://tipsytapstudio.github.io/sd-prompt-builder/ でアプリが動く状態にする。

## 実装ガイド

- リポジトリ: https://github.com/TipsyTapStudio/sd-prompt-builder (public 想定。
  private だったら Pages 利用可否を確認し、不可なら報告して中断)
- GitHub Actions 公式フロー: `actions/upload-pages-artifact` + `actions/deploy-pages`。
  master push で `npm ci && npm run build` → dist を deploy
- **Vite の base 設定**: サブパス配信なので `--base=/sd-prompt-builder/` が必要。
  ローカル dev に影響させないため、vite.config の固定変更ではなく
  ワークフロー内 `vite build --base=/sd-prompt-builder/` を推奨
- **ユーザー操作が必要な箇所**: リポジトリ Settings → Pages → Source を
  「GitHub Actions」にする。gh CLI(`gh api`)で設定可能なら自動で、
  できなければ完了報告に手順を明記
- 注意: デプロイ版はオリジンが異なるため localStorage / IndexedDB は
  ローカル版と共有されない(データは Export/Import で移行)。
  DEVLOG とユーザー向け報告にこの旨を必ず書く
- 検証: Actions の run 成功と、デプロイ URL でアプリが表示されること
  (アセット 404 が出ていないこと)を確認

# プロセス(CLAUDE.md の要点)

1. タスク1は UX レビュー(上記の確定項目のみ諮る)→ 実装 →
   テスターサブエージェントで動作確認 → ビルド + lint
2. テスター確認項目の必須分: ペインの表示/折りたたみ/永続化、選択切替、
   ぼかし(解除→拡大の2段階)、コピーボタン、狭幅での非破壊、
   既存機能の非破壊(ドロップ登録、OutputPanel、ストーリーボード)、コンソールエラー
3. DEVLOG.md に記録、CLAUDE.md の構成・注意事項・次回やるべきことを更新
4. コミットはタスクごとに分ける(feat: ... / ci: ...)。master へ直接 push
5. lint 全体は既存 37 エラーで exit 1 する — **変更ファイルのみ lint** すればよい

# テストデータの注意(重要)

- 実画像(`G:\マイドライブ\sd\...\outputs`)は使わない。合成データのみ
  (canvas ダミーサムネを IndexedDB へ直接 put、または scripts/test-image-metadata.mjs 方式)
- プロンプト文言の被写体は明確に成人(adult woman 等)とする
- テスト後はレコードを必ず削除して掃除

# スコープ外(やらないこと)

- 差分表示(画像内 vs 現在プロンプト)— 右ペイン完成後の次タスク
- シーンカードへの直接ドロップ / 重複登録デデュープ
- セクション名の曖昧マッチ改善(次セッションの副タスク候補)
- 代表画像の手動ピン留め

完了したらこのファイルは削除するか、次の指示書に書き換えること。
