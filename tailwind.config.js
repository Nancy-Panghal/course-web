/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Only the shades actually used in the app are remapped, so this
        // can't accidentally change an unrelated violet/amber shade.
        // Keep in sync with the --kurso-* vars in src/app/globals.css.
        violet: {
          300: 'var(--kurso-primary-lightest)',
          400: 'var(--kurso-primary-lighter)',
          500: 'var(--kurso-primary-light)',
          600: 'var(--kurso-primary)',
        },
        amber: {
          500: 'var(--kurso-accent)',
        },
      },
    },
  },
  plugins: [],
}