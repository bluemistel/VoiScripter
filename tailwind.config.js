module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mplus: ['"M PLUS 1p"', 'sans-serif'],
        noto: ['"Noto Sans JP"', 'sans-serif'],
        sawarabi: ['"Sawarabi Gothic"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} 