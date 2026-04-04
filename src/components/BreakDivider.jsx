export default function BreakDivider() {
  return (
    <div className="flex items-center gap-3 my-4 px-2">
      <div className="flex-1 h-px bg-orange-500/40" />
      <span className="text-orange-400 text-sm font-bold tracking-widest">BREAK</span>
      <div className="flex-1 h-px bg-orange-500/40" />
    </div>
  )
}
