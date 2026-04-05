import { createPortal } from 'react-dom'

export default function SaveConfirmModal({ title, onOverwrite, onSaveAsNew, onCancel }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-[360px] mx-4">
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-100 mb-1">プロンプトを保存</h3>
          <p className="text-xs text-gray-400 mb-4">
            「{title}」の保存方法を選んでください。
          </p>
          <div className="space-y-2">
            <button onClick={onOverwrite}
              className="w-full px-4 py-2.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-colors cursor-pointer text-left">
              <div>上書き保存</div>
              <div className="text-[10px] text-blue-200/70 mt-0.5">現在のプロンプトを更新します</div>
            </button>
            <button onClick={onSaveAsNew}
              className="w-full px-4 py-2.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 font-medium transition-colors cursor-pointer text-left">
              <div>新規プロンプトとして保存</div>
              <div className="text-[10px] text-gray-400 mt-0.5">コピーを作成し、元のプロンプトは変更しません</div>
            </button>
          </div>
        </div>
        <div className="px-5 pb-4 flex justify-end">
          <button onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors cursor-pointer">
            キャンセル
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
