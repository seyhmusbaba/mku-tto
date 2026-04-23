import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50:'#f0f4ff',100:'#dce6ff',200:'#b9ccff',300:'#8aabff',400:'#5580ff',500:'#2d5aff',600:'#1a3a6b',700:'#162f57',800:'#112344',900:'#0f2444' },
        gold: { 400:'#f5c842',500:'#c8a45a',600:'#a07c3a' },
      },
      fontFamily: {
        sans: ['Inter','-apple-system','BlinkMacSystemFont','Segoe UI','system-ui','sans-serif'],
        display: ['Inter','system-ui','sans-serif'],  // Ana sistemde font-display → Inter (tek font)
        serif: ['Playfair Display','Georgia','serif'],  // Sadece vitrin portalı kullanıyor
        mono: ['JetBrains Mono','ui-monospace','monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
