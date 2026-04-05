import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

const ANALYSIS_TEMPLATE = `# Stable Diffusion プロンプト構造化分析

あなたはStable Diffusionのプロンプト分析の専門家です。
以下のSDプロンプトを、指定されたセクション構造に正確に分解してください。

---

## 分析対象プロンプト

### Positive:
\`\`\`
（ここにPositiveプロンプトを貼り付けてください）
\`\`\`

### Negative:
\`\`\`
（ここにNegativeプロンプトを貼り付けてください）
\`\`\`

---

## セクション定義

### Positive セクション（この順序で分類）

| # | セクションキー | セクション名 | 役割 | 必須/任意 |
|---|---|---|---|---|
| 1 | quality | Quality & Technical | 品質・技術的指定（masterpiece, best quality, RAW photo, detailed skin texture 等） | 必須 |
| 2 | style | Style / Aesthetic | 画風・スタイル指定（anime, realistic, oil painting 等） | 任意 |
| 3 | face_hair | Face & Hair | 顔・髪型・髪色・表情（1 girl, brown hair, smile 等） | 必須 |
| 4 | body | Body | 体型・プロポーション・身体の状態（slim waist, sweat 等） | 必須 |
| 5 | outfit | Outfit | 衣装・アクセサリー（bikini, necklace 等） | 必須 |
| 6 | composition | Composition & Pose | 構図・アングル・ポーズ・手に持つもの（low angle, sitting, holding cup 等） | 必須 |
| 7 | effects | Effects / Expression | 漫画的演出・エフェクト（motion lines, heart, spoken heart 等） | 任意 |
| - | BREAK | --- | 被写体と環境の分離（Composition/Effects の後、Environment の前に挿入） | 必須 |
| 8 | environment | Environment & Lighting | 背景・場所・天候・光源（beach, sunset, rim lighting 等） | 必須 |
| 9 | lora | Lora | LoRA指定（<lora:xxx:0.8> 等） | 任意 |

### Negative セクション

| # | セクションキー | セクション名 | 役割 |
|---|---|---|---|
| N1 | general_quality | General Quality | 品質除外（worst quality, blurry, watermark 等） |
| N2 | body_anatomy | Body & Anatomy | 破綻防止（bad hands, extra fingers 等） |
| N3 | skin_realism | Skin & Realism | のっぺり防止（smooth skin, plastic skin, cgi 等） |
| N4 | lighting | Lighting | ライティング除外（flat lighting 等） |
| N5 | composition | Composition (situational) | 構図除外・状況依存（standing, sitting 等、ポーズに応じて除外するもの） |

---

## 分類ルール

以下の基準でタグを各セクションに振り分けてください：

1. **身体の状態**（汗、涙、赤面、濡れ肌）→ Body または Face & Hair（表現される場所に応じて）
2. **身につけるもの**（服、アクセサリー）→ Outfit
3. **手に持つもの・使うもの**（マグカップ、傘、スマホ）→ Composition & Pose（動作とセットで記述）
4. **周囲にあるもの**（テーブルの花瓶、背景の看板）→ Environment & Lighting
5. **漫画的演出**（効果音、集中線、ハート）→ Effects / Expression
6. **カメラアングル・フレーミング** → Composition & Pose
7. **LoRA記法** \`<lora:name:weight>\` → Lora

**判断の原則**: 「それは身体に属するか、行動に属するか、環境に属するか」

### ウェイト記法について
- \`(tag:weight)\` はSDのウェイト指定。そのまま保持してください
- \`{a|b|c}\` はDynamic Prompts記法。そのまま保持してください

---

## 出力フォーマット

以下のJSON形式で出力してください。空のセクションは空文字列 "" にしてください。
タグ間のカンマとスペースはそのまま保持してください。

\`\`\`json
{
  "title": "（プロンプトの内容を簡潔に表すタイトルを付けてください）",
  "description": "（プロンプトの特徴を1行で説明してください）",
  "sections": {
    "quality": "",
    "style": "",
    "face_hair": "",
    "body": "",
    "outfit": "",
    "composition": "",
    "effects": "",
    "environment": "",
    "lora": ""
  },
  "negative_sections": {
    "general_quality": "",
    "body_anatomy": "",
    "skin_realism": "",
    "lighting": "",
    "composition": ""
  }
}
\`\`\`

## 注意事項
- 元のプロンプトに存在するタグを勝手に追加・削除しないでください
- ウェイト指定 \`(tag:1.3)\` はそのまま保持してください
- BREAK は出力JSONには含めません（アプリが自動挿入します）
- 1つのタグが複数セクションに該当しそうな場合、最も関連の強いセクションに配置してください
- 各セクション内のタグ順序は、元のプロンプトでの出現順を維持してください`

function CloseIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  )
}

function CopyIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1" />
      <path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2" />
    </svg>
  )
}

export default function PromptAnalysisModal({ onClose }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ANALYSIS_TEMPLATE)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = ANALYSIS_TEMPLATE
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[680px] max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">プロンプト分析テンプレート</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Claude AI や ChatGPT にコピーして、SDプロンプトを構造化分解できます
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 rounded transition-colors cursor-pointer"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Usage guide */}
        <div className="px-5 py-3 bg-blue-950/20 border-b border-gray-800">
          <div className="text-[11px] text-blue-300/80 space-y-1">
            <div className="font-medium text-blue-300">使い方:</div>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-300/70">
              <li>下のテンプレートをコピー</li>
              <li>Claude AI / ChatGPT に貼り付け</li>
              <li>テンプレート内の指定箇所に分析したいSDプロンプトを貼り付け</li>
              <li>AIの出力（JSON）をこのアプリの各セクションに入力</li>
            </ol>
          </div>
        </div>

        {/* Template content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <pre className="text-[11px] leading-relaxed text-gray-400 whitespace-pre-wrap font-mono bg-gray-950/50 rounded-lg p-4 border border-gray-800/50">
            {ANALYSIS_TEMPLATE}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 flex justify-end">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              copied
                ? 'bg-green-600/80 text-white'
                : 'bg-blue-600/80 hover:bg-blue-500/80 text-white'
            }`}
          >
            <CopyIcon size={13} />
            {copied ? 'コピーしました' : 'テンプレートをコピー'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
