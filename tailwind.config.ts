import type { Config } from 'tailwindcss';

// Palette lifted from the existing Session Manager / Dashboard sidebars
// (#667eea / #764ba2 gradient, slate text, soft card surfaces) so the
// web app feels continuous with the tool the club already knows.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#ebf4ff',
          400: '#7c8ef0',
          500: '#667eea', // primary accent
          600: '#5568d3',
          700: '#764ba2', // gradient end
        },
        ink: {
          900: '#1a202c',
          700: '#2d3748',
          500: '#4a5568',
          400: '#718096',
          300: '#a0aec0',
          100: '#e2e8f0',
          50: '#f8f9fa',
        },
        win: '#48bb78',
        lose: '#e53e3e',
        warn: '#ed8936',
      },
      borderRadius: {
        card: '10px',
        chip: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(26, 32, 44, 0.06), 0 1px 3px rgba(26, 32, 44, 0.08)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
