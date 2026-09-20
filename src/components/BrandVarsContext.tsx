'use client'

import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'

/**
 * Carries a landing page's theme-derived `--kurso-*` CSS variables (see
 * lib/landing-themes/brandVars.ts) down to components that render OUTSIDE the
 * page's DOM tree — the enroll popup is portaled to <body>, so it can't
 * inherit the page root's variables and re-applies them itself.
 *
 * Outside a landing page there is no provider, the value is null, and nothing
 * is overridden.
 */
const BrandVarsContext = createContext<CSSProperties | null>(null)

export function BrandVarsProvider({ vars, children }: { vars: CSSProperties; children: ReactNode }) {
    return <BrandVarsContext.Provider value={vars}>{children}</BrandVarsContext.Provider>
}

export function useBrandVars(): CSSProperties | null {
    return useContext(BrandVarsContext)
}