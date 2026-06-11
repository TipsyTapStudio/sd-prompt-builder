import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

function hasFiles(e) {
  return Array.from(e.dataTransfer?.types || []).includes('Files')
}

/**
 * Full-screen overlay shown while OS files are dragged over the window.
 * Reacts ONLY to the `Files` drag type so internal DnD (scene moves use
 * `text/x-ppb-scene`, bench chips use `text/plain`) is untouched.
 * Dropped files always attach to the prompt currently open in the editor;
 * the overlay states that target by title to prevent mis-registration.
 */
export default function DropOverlay({ enabled, title, canRegister, onDropFiles }) {
  const [visible, setVisible] = useState(false)
  const depthRef = useRef(0)

  useEffect(() => {
    if (!enabled) return undefined

    const onDragEnter = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depthRef.current++
      setVisible(true)
    }
    const onDragLeave = (e) => {
      if (!hasFiles(e)) return
      depthRef.current = Math.max(0, depthRef.current - 1)
      if (depthRef.current === 0) setVisible(false)
    }
    const onDragOver = (e) => {
      // preventDefault everywhere or the browser navigates to the PNG
      if (hasFiles(e)) e.preventDefault()
    }
    const onDrop = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depthRef.current = 0
      setVisible(false)
      if (e.dataTransfer.files?.length) onDropFiles(e.dataTransfer.files)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      depthRef.current = 0
      setVisible(false)
    }
  }, [enabled, onDropFiles])

  if (!visible) return null

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-gray-950/85 backdrop-blur-sm flex items-center justify-center pointer-events-none">
      <div className={`border-2 border-dashed rounded-2xl px-12 py-10 text-center max-w-lg ${
        canRegister ? 'border-emerald-500/70' : 'border-yellow-600/70'
      }`}>
        {canRegister ? (
          <>
            <div className="text-base text-gray-100 font-medium">
              「{title || '無題のプロンプト'}」に生成画像を追加
            </div>
            <div className="text-xs text-gray-400 mt-2">
              ドロップで登録(サムネイルとパラメータのみ保存されます)
            </div>
          </>
        ) : (
          <>
            <div className="text-base text-yellow-200 font-medium">
              先にプロンプトを入力してください
            </div>
            <div className="text-xs text-gray-400 mt-2">
              画像は編集中のプロンプトに紐付けて登録されます
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
