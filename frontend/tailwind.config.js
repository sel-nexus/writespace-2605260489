/** Expose the editorial paper and evergreen palette through semantic roles. */
const neutral = {
  50: 'oklch(0.98 0.006 85)', 100: 'oklch(0.94 0.008 85)',
  200: 'oklch(0.86 0.009 85)', 300: 'oklch(0.78 0.009 85)',
  400: 'oklch(0.70 0.009 85)', 500: 'oklch(0.62 0.009 85)',
  600: 'oklch(0.54 0.009 85)', 700: 'oklch(0.46 0.009 85)',
  800: 'oklch(0.38 0.009 85)', 900: 'oklch(0.30 0.009 85)',
  950: 'oklch(0.22 0.008 85)',
};
const primary = {
  50: '#f0f5f1', 100: '#e1ece4', 200: '#c2d7c9', 300: '#9bbba8',
  400: '#739b83', 500: '#507b62', 600: '#365f49', 700: '#264c39',
  800: '#1f3d2f', 900: '#1a3227', 950: '#102219',
};
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        neutral, primary, secondary: neutral,
        background: '#f8f7f2', surface: '#fffefa',
        'surface-raised': '#efeee7', foreground: '#252d27',
        'foreground-muted': '#5f665f', border: '#d5d9cf', ring: primary[700],
        success: { DEFAULT: '#365f49', light: '#edf3ec' },
        warning: { DEFAULT: '#705522', light: '#f7f1e4' },
        error: { DEFAULT: '#963f3b', light: '#f8edeb' },
        info: { DEFAULT: '#46616b', light: '#edf2f3' },
      },
      fontFamily: {
        sans: ['"Source Sans 3"', '"Trebuchet MS"', 'sans-serif'],
        display: ['Newsreader', 'Georgia', 'serif'],
        mono: ['"Courier New"', 'monospace'],
      },
      borderRadius: { card: '8px', control: '6px' },
      boxShadow: { overlay: '0 8px 24px rgb(37 45 39 / 0.08)' },
      transitionDuration: { quick: '150ms' },
      transitionTimingFunction: { quiet: 'ease-out' },
    },
  },
  plugins: [],
};
