/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          darkest: '#202225',
          dark: '#2f3136',
          chat: '#36393f',
          input: '#40444b',
          hover: '#35373c',
          active: '#393c43',
          blurple: '#5865F2',
          'blurple-hover': '#4752c4',
          green: '#57F287',
          yellow: '#FEE75C',
          red: '#ED4245',
          text: '#dcddde',
          muted: '#96989d',
          header: '#ffffff',
          serverActive: '#5865F2'
        }
      }
    },
  },
  plugins: [],
}
