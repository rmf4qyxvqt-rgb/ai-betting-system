import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "#f3f5f7",
        ink: "#111111",
        slate: "#2f3b45",
        pearl: "#ffffff",
        mist: "#d5dde5",
        cyan: "#0ea5a6",
        amber: "#ea580c",
      },
      boxShadow: {
        card: "0 16px 40px rgba(17, 17, 17, 0.08)",
      },
      backgroundImage: {
        texture:
          "radial-gradient(circle at 15% 20%, rgba(14,165,166,0.18) 0%, transparent 40%), radial-gradient(circle at 80% 10%, rgba(234,88,12,0.12) 0%, transparent 45%), linear-gradient(130deg, #f3f5f7 0%, #ffffff 55%, #ecf2f7 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
