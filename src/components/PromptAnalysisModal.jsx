import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

const ANALYSIS_TEMPLATE = `# SD プロンプト構造化分析

以下のプロンプトを指定セクションに分解し、JSON で出力してください。

## セクション定義

**Positive（この順序）:**
- quality: 品質・技術指定（masterpiece, best quality, RAW photo 等）
- style: 画風（anime, realistic, oil painting 等）
- face_hair: 顔・髪・表情（1girl, brown hair, smile 等）
- body: 体型・身体状態（slim waist, sweat 等）
- outfit: 衣装・アクセサリー（bikini, necklace 等）
- composition: 構図・ポーズ・手持ち物（low angle, sitting, holding cup 等）
- effects: 漫画的演出（motion lines, heart 等）
- BREAK（composition/effects と environment の間に自動挿入）
- environment: 背景・天候・光源（beach, sunset, rim lighting 等）
- lora: LoRA指定（<lora:xxx:0.8> 等）

**Negative:**
- general_quality: 品質除外（worst quality, blurry, watermark 等）
- body_anatomy: 破綻防止（bad hands, extra fingers 等）
- skin_realism: のっぺり防止（smooth skin, plastic skin 等）
- lighting: ライティング除外（flat lighting 等）
- composition: 構図除外・状況依存（ポーズに応じた除外）

## 分類ルール

- 身体の状態（汗, 赤面 等）→ body / face_hair（部位で判断）
- 身につける物 → outfit
- 手に持つ物・使う物 → composition
- 周囲の物・背景要素 → environment
- 漫画的演出 → effects
- カメラアングル → composition
- \`<lora:...>\` → lora
- \`(tag:weight)\` \`{a|b|c}\` はそのまま保持

## 分析対象プロンプト

Positive:
\`\`\`
（ここに貼り付け）
\`\`\`

Negative:
\`\`\`
（ここに貼り付け）
\`\`\`

## 出力

以下の JSON で出力。空セクションは ""。タグの追加・削除・並び替えはしない。BREAK は JSON に含めない。

\`\`\`json
{
  "title": "（簡潔なタイトル）",
  "description": "（1行説明）",
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
\`\`\``

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
