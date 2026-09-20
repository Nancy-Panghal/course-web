import type { CSSProperties } from 'react'
import type { LandingThemeColors } from './types'

/**
 * Turns a landing theme's colors into the `--kurso-*` CSS variables that
 * Kurso's shared UI already reads (Enroll buttons via `.violet-gradient`,
 * the enroll popup, glows, star ratings, the PDF lesson icon).
 *
 * Set on the landing page's root element (and re-applied inside the enroll
 * popup, which renders in a portal outside that element), those components
 * pick up the creator's theme with no per-component color props. Anywhere
 * that doesn't set these variables — dashboard, student pages — Kurso's own
 * brand colors apply exactly as before.
 */

type RGB = [number, number, number]

const WHITE: RGB = [255, 255, 255]

function hexToRgb(hex: string): RGB | null {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
    if (!m) return null
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (rgb: RGB) =>
    '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')

const toTriplet = (rgb: RGB) => rgb.map(v => Math.round(v)).join(', ')

function mix(from: RGB, to: RGB, amount: number): RGB {
    return [
        from[0] + (to[0] - from[0]) * amount,
        from[1] + (to[1] - from[1]) * amount,
        from[2] + (to[2] - from[2]) * amount,
    ]
}

function luminance([r, g, b]: RGB): number {
    const ch = [r, g, b].map(v => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

/** Contrast ratio of white text on this background color. */
const whiteContrast = (rgb: RGB) => 1.05 / (luminance(rgb) + 0.05)

/** The enroll popup is always dark, so accent colors used as text/borders in
 *  it must be bright enough to read there — lift dark accents toward white. */
function liftForDarkSurface(rgb: RGB): RGB {
    let out = rgb
    for (let i = 0; i < 10 && luminance(out) < 0.18; i++) out = mix(out, WHITE, 0.1)
    return out
}

export function getBrandVars(colors: Pick<LandingThemeColors, 'accent' | 'accentGradient'>): CSSProperties {
    const accent = hexToRgb(colors.accent)
    if (!accent) return {}

    const gradientStops = ((colors.accentGradient || '').match(/#[0-9a-fA-F]{6}/g) || [])
        .map(hexToRgb)
        .filter((v): v is RGB => v !== null)
    const stops = gradientStops.length > 0 ? gradientStops : [accent]

    // White button text unless the gradient's lightest stop is too pale for it
    // (carbon-black, amber-forge, lagoon-teal) — then dark text reads better.
    const lightestStopContrast = Math.min(...stops.map(whiteContrast))
    const buttonText = lightestStopContrast < 2.2 ? '#0a0a0a' : '#ffffff'

    const onDark = liftForDarkSurface(accent)

    return {
        '--kurso-primary': toHex(onDark),
        '--kurso-primary-rgb': toTriplet(onDark),
        '--kurso-primary-light': toHex(mix(onDark, WHITE, 0.15)),
        '--kurso-primary-lighter': toHex(mix(onDark, WHITE, 0.35)),
        '--kurso-primary-lightest': toHex(mix(onDark, WHITE, 0.55)),
        '--kurso-secondary': toHex(stops[stops.length - 1]),
        '--kurso-accent': toHex(accent),
        '--kurso-accent-soft': toHex(mix(accent, WHITE, 0.1)),
        '--kurso-accent-rgb': toTriplet(accent),
        '--kurso-btn-gradient': colors.accentGradient,
        '--kurso-btn-text': buttonText,
    } as CSSProperties
}