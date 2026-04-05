import { useState } from 'react'
import { createPortal } from 'react-dom'

function CloseIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  )
}

export default function SettingsModal({
  translationProvider, onSetTranslationProvider, translatorActiveProvider, PROVIDERS,
  onResetBench, onClearAll, onExportJson, onClose,
}) {
  const [confirmClear, setConfirmClear] = useState(false)

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[480px] max-h-[80vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-gray-100">設定</h2>
          <button onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 rounded transition-colors cursor-pointer">
            <CloseIcon />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Translation */}
          <div>
            <h3 className="text-sm font-medium text-gray-200 mb-1">翻訳</h3>
            <p className="text-xs text-gray-500 mb-3">
              Positive セクションの下に日本語訳を表示します。ヘッダーの「訳」ボタンで ON/OFF を切り替えられます。
            </p>
            <div className="flex gap-2 mb-2">
              {[
                { key: PROVIDERS.AUTO, label: 'Auto', desc: 'Chrome → MyMemory の順で自動選択' },
                { key: PROVIDERS.MYMEMORY, label: 'MyMemory', desc: '無料API（5,000文字/日）' },
                { key: PROVIDERS.CHROME, label: 'Chrome', desc: 'ブラウザ内蔵（要言語パック）' },
                { key: PROVIDERS.OFF, label: 'OFF', desc: '翻訳を無効化' },
              ].map(({ key, label, desc }) => (
                <button key={key} onClick={() => onSetTranslationProvider(key)}
                  className={`flex-1 px-3 py-2 rounded-lg text-center transition-colors cursor-pointer ${
                    translationProvider === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                  }`}>
                  <div className="text-xs font-medium">{label}</div>
                  <div className="text-[9px] mt-0.5 opacity-70">{desc}</div>
                </button>
              ))}
            </div>
            {translatorActiveProvider && (
              <div className="text-xs text-gray-500">
                現在のエンジン: <span className="text-gray-300">{translatorActiveProvider}</span>
              </div>
            )}
          </div>

          {/* Bench */}
          <div>
            <h3 className="text-sm font-medium text-gray-200 mb-1">ベンチ（プリセットタグ）</h3>
            <p className="text-xs text-gray-500 mb-3">
              各セクション右側のベンチタグを、プリセットの初期状態に戻します。
              カスタマイズしたベンチの内容が失われます。
            </p>
            <button onClick={() => { onResetBench(); onClose() }}
              className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors cursor-pointer">
              プリセットタグを初期状態に戻す
            </button>
          </div>

          {/* Danger zone */}
          <div className="border-t border-gray-800 pt-5">
            <h3 className="text-sm font-medium text-red-400 mb-1">データ管理</h3>
            <p className="text-xs text-gray-500 mb-3">
              全てのデータ（保存済みプロンプト・ベンチ・設定・下書き）を削除してアプリを初期状態に戻します。
              この操作は取り消せません。
            </p>

            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)}
                className="px-4 py-2 text-sm bg-gray-800 hover:bg-red-950 rounded-lg text-red-400 transition-colors cursor-pointer">
                全データを削除してリセット...
              </button>
            ) : (
              <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4">
                <p className="text-xs text-red-300 mb-3">
                  本当に全データを削除しますか？事前にバックアップを推奨します。
                </p>
                <div className="flex gap-2">
                  <button onClick={() => { onExportJson(); }}
                    className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition-colors cursor-pointer">
                    まずバックアップ（Export JSON）
                  </button>
                  <button onClick={() => { onClearAll(); onClose() }}
                    className="px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 rounded text-white transition-colors cursor-pointer">
                    削除してリセット
                  </button>
                  <button onClick={() => setConfirmClear(false)}
                    className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-400 transition-colors cursor-pointer">
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
