import Link from 'next/link'
import { Shield, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-2xl violet-gradient flex items-center justify-center mb-8 shadow-2xl glow-strong">
        <Shield className="w-10 h-10 text-white" />
      </div>
      
      <h1 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">
        404 — Page Not Found
      </h1>
      
      <p className="text-zinc-500 max-w-md mb-10 text-lg">
        The page you are looking for doesn't exist or has been moved. 
        If you just deployed, make sure you've created your course data in the database.
      </p>

      <Link href="/" 
        className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white violet-gradient hover:opacity-90 transition-all shadow-xl">
        <Home className="w-5 h-5" />
        Back to Home
      </Link>
      
      <div className="mt-12 pt-12 border-t border-white/5 w-full max-w-xs">
        <p className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.3em]">
          AcademyKit Diagnostic Tool
        </p>
      </div>
    </div>
  )
}
