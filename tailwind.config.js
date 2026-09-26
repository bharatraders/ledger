/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        rule: 'rgb(var(--rule) / <alpha-value>)',
        head: 'rgb(var(--head) / <alpha-value>)',
        headink: 'rgb(var(--headink) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        dr: 'rgb(var(--dr) / <alpha-value>)',
        drbg: 'rgb(var(--drbg) / <alpha-value>)',
        cr: 'rgb(var(--cr) / <alpha-value>)',
        crbg: 'rgb(var(--crbg) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};

