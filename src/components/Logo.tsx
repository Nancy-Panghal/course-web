import { LOGO_SRC } from '@/lib/brand'

export default function Logo({ className = 'w-4 h-4' }: { className?: string }) {
  return <img src={LOGO_SRC} alt="Kurso" className={`${className} object-contain`} />
}