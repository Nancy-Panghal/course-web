export default function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 mt-2 mb-1">
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
      <span className="text-sm font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#d4d4d8' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
    </div>
  )
}