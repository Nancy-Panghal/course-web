import { Shield } from 'lucide-react'

export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl violet-gradient flex items-center justify-center animate-pulse shadow-2xl">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <p className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.4em] animate-pulse">
          Loading AcademyKit...
        </p>
      </div>
    </div>
  )
}
