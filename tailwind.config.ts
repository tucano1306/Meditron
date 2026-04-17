import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        notion: {
          bg: "var(--notion-bg)",
          sidebar: "var(--notion-sidebar)",
          hover: "var(--notion-hover)",
          selected: "var(--notion-selected)",
          text: "var(--notion-text)",
          "text-2": "var(--notion-text-2)",
          "text-3": "var(--notion-text-3)",
          border: "var(--notion-border)",
          "border-2": "var(--notion-border-2)",
          blue: "#2383E2",
          "blue-bg": "rgba(35,131,226,0.14)",
          red: "#EB5757",
          "red-bg": "rgba(235,87,87,0.14)",
          yellow: "#DFAB01",
          "yellow-bg": "rgba(223,171,1,0.14)",
          green: "#0F7B6C",
          "green-bg": "rgba(15,123,108,0.14)",
          purple: "#9065B0",
          "purple-bg": "rgba(144,101,176,0.14)",
        },
      },
      fontFamily: {
        notion: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        "notion-mono": [
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          '"PT Mono"',
          '"Liberation Mono"',
          "Courier",
          "monospace",
        ],
      },
      fontSize: {
        "notion-xs": ["11px", { lineHeight: "1.4" }],
        "notion-sm": ["12px", { lineHeight: "1.5" }],
        "notion-base": ["14px", { lineHeight: "1.5" }],
        "notion-content": ["16px", { lineHeight: "1.5" }],
      },
      boxShadow: {
        "notion-sm":
          "rgba(15,15,15,0.1) 0px 0px 0px 1px, rgba(15,15,15,0.1) 0px 2px 4px",
        notion:
          "rgba(15,15,15,0.05) 0px 0px 0px 1px, rgba(15,15,15,0.1) 0px 3px 6px, rgba(15,15,15,0.2) 0px 9px 24px",
        "notion-float":
          "rgba(15,15,15,0.1) 0px 0px 0px 1px, rgba(15,15,15,0.2) 0px 5px 10px, rgba(15,15,15,0.4) 0px 15px 40px",
      },
      borderRadius: {
        notion: "3px",
        "notion-md": "6px",
        "notion-lg": "8px",
      },
      keyframes: {
        "slide-in-from-bottom": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-8px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "slide-in-from-bottom-4": "slide-in-from-bottom 0.3s ease-out",
        "fade-in": "fade-in 0.15s ease-out",
        "slide-in-left": "slide-in-left 0.15s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
