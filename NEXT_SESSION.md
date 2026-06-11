# 次セッション指示書 — シーンカード代表画像サムネイル(ギャラリー v2)

> この指示書は前セッション(Fable 5、2026-06-12)が作成した実装ブリーフ。
> 設計判断は済んでいるので、ここに書かれた決定を再検討せずに実装に進んでよい。
> プロセスルール(サブエージェント運用・コーディング規約)は CLAUDE.md に従うこと。

## ゴール

ストーリーボードのシーンカード(`src/components/SceneCard.jsx`)に、
そのシーンに登録された生成画像の**代表サムネイル**を表示する。
これによりストーリーボードが「テキストカードの列」から「絵コンテ」になる。

## 背景(前セッションまでの状態)

- 生成結果ギャラリーは実装済み: PNG ドロップ → サムネイル(長辺512px WebP)+
  抽出パラメータを IndexedDB に保存。エディタ下部の GalleryPanel に表示
- サイドバーには添付インジケーター(画像アイコン+枚数ツールチップ)実装済み
- シーンカードへの表示は「つなぎのアイコンを挟まず、直接サムネイル表示をやる」
  という判断で意図的に未実装(UX レビュー済みの方針)

## 確定済みの設計判断

1. **代表画像 = 最新登録(createdAt 降順の先頭)**。
   手動ピン留め(representativeImageId)は今回もスコープ外でよい
2. **ぼかしはカード側にも適用する**。エディタのギャラリーと同じ判定
   (`textContainsSensitive(image.positive || image.params, keywords)` +
   blurMode 設定)を使う。カード上でのぼかし解除クリックは
   「1クリック目=解除」のみでよい(2クリック目の詳細モーダルはカードでは不要。
   カードクリックの既存動作=シーンを開く、を壊さないこと)
3. サムネイルは IndexedDB から非同期読み込み。Blob → `URL.createObjectURL` →
   アンマウント時 `revokeObjectURL`(GalleryPanel.jsx の Thumb コンポーネントの
   パターンを踏襲。useMemo + cleanup effect で lint の
   set-state-in-effect を踏まないこと)
4. 画像が無いシーンのカードは現状の見た目を維持(空のプレースホルダー枠を
   出すかどうかは UX レビューに確認)

## 実装ガイド

### 使える既存部品
- `src/utils/imageDb.js`
  - `getImagesForPrompt(promptId)` — createdAt 降順で返る。先頭が代表
  - 全シーン分まとめて取るなら新関数を足す(例: index を promptId ごとに
    openCursor して最新1件だけ集める `getLatestImageForPrompts(ids)`)。
    シーン数×getAll は無駄が多いので注意
- `src/utils/sensitive.js` — `textContainsSensitive`, `getGalleryBlurMode`
- `src/components/GalleryPanel.jsx` — Thumb の objectURL 管理パターン
- App.jsx には `imageCounts`(枚数マップ)と `gallery`(現在プロンプトの
  画像リスト)が既にあるが、StoryboardView には**まだ何も渡していない**

### 変更対象(見込み)
- `src/components/SceneCard.jsx` — サムネイル表示領域の追加
- `src/components/StoryboardView.jsx` — 画像データの取得と配布
- `src/App.jsx` — props 配線(必要なら)
- `src/utils/imageDb.js` — 一括取得関数の追加(必要なら)

### データ更新のタイミング
ストーリーボード表示中にエディタで画像が増えることはない(ビューは排他)ので、
StoryboardView マウント時に一括読み込みで十分。リアルタイム同期は不要。

## プロセス(CLAUDE.md のルール、要点のみ再掲)

1. **実装前に UX レビューサブエージェントに相談**(カード内のサムネイル位置・
   サイズ・アスペクト比の扱い・空状態・ぼかし解除の操作感を確認)
2. 実装
3. **テスターサブエージェントで動作確認**(サムネイル表示、ぼかし、
   カードクリックでシーンが開く既存動作の非破壊、コンソールエラー)
4. ビルド(`npm run build`)+ 新規ファイルの lint 確認
5. DEVLOG.md にセッション記録を追記、CLAUDE.md の「次回やるべきこと」を更新
6. コミット(feat: プレフィックス)→ master へ直接 push(個人開発運用)

## テストデータの注意(重要)

- 実画像(`G:\マイドライブ\sd\...\outputs`)はテストに使わない。
  センシティブな内容が含まれることがある
- テストは合成データで行う: IndexedDB へ canvas 製ダミーサムネイルを直接 put する
  方式(前セッションで実績あり)か、`scripts/test-image-metadata.mjs` の
  PNG 合成方式。プロンプト文言の被写体は明確に成人(adult woman 等)とする
- テスト後は必ずレコードを削除して掃除する

## スコープ外(やらないこと)

- 代表画像の手動ピン留め
- シーンカードへの直接ドロップ(将来 v2.1)
- 「画像のプロンプトを取り込む」ボタン(PromptAnalysisModal 連携、別タスク)
- 画像内プロンプト vs 現在プロンプトの差分表示(別タスク)
- 重複登録デデュープ(別タスク)

## この次の候補(本タスク完了後、余力があれば着手検討)

優先順に:
1. GitHub Pages デプロイ設定(CLAUDE.md 優先度高)
2. 「画像のプロンプトを取り込む」ボタン — 詳細モーダルの Positive/Negative を
   PromptAnalysisModal の取り込みフローに渡す
3. セクション名の曖昧マッチ改善("Quality and Technical" vs "Quality & Technical")

完了したらこのファイルは削除するか、次の指示書に書き換えること。
