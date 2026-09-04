// CALLOS NOVA mobile — dark + light themes with a context provider.
import { createContext, useContext, useState, useCallback, useMemo } from "react";

export const palette = {
  teal: "#14b8a6",
  tealDark: "#0d9488",
  violet: "#8b5cf6",
  cyan: "#22d3ee",
  emerald: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
};

export const darkTheme = {
  mode: "dark",
  bg: "#080b12",
  surface: "#101521",
  surface2: "#1a2130",
  card: "#101521",
  elevated: "#151b29",
  primary: "#eef2f9",
  secondary: "#c2cad8",
  muted: "#8b95a7",
  dim: "#5d6577",
  border: "#1e2636",
  borderStrong: "#2a3446",
  accent: "#2dd4bf",
  accent2: "#a78bfa",
  accentSoft: "rgba(45,212,191,0.14)",
  violetSoft: "rgba(167,139,250,0.14)",
  success: "#34d399",
  successSoft: "rgba(52,211,153,0.14)",
  danger: "#f87171",
  dangerSoft: "rgba(248,113,113,0.14)",
  warning: "#fbbf24",
  warningSoft: "rgba(251,191,36,0.14)",
  banner: "rgba(45,212,191,0.1)",
  navBar: "#0b0f18",
};

export const lightTheme = {
  mode: "light",
  bg: "#f5f7fb",
  surface: "#ffffff",
  surface2: "#eef1f6",
  card: "#ffffff",
  elevated: "#ffffff",
  primary: "#0f1729",
  secondary: "#3b4559",
  muted: "#6b7280",
  dim: "#9aa3b2",
  border: "#e9ebf1",
  borderStrong: "#dfe2ea",
  accent: "#0d9488",
  accent2: "#7c3aed",
  accentSoft: "rgba(13,148,136,0.1)",
  violetSoft: "rgba(124,58,237,0.1)",
  success: "#16a34a",
  successSoft: "rgba(22,163,74,0.1)",
  danger: "#dc2626",
  dangerSoft: "rgba(220,38,38,0.1)",
  warning: "#d97706",
  warningSoft: "rgba(217,119,6,0.1)",
  banner: "rgba(13,148,136,0.08)",
  navBar: "#ffffff",
};

export function makeShadows(mode) {
  const color = mode === "dark" ? "#000" : "#1a2540";
  return {
    shadow: { shadowColor: color, shadowOffset: { width: 0, height: 6 }, shadowOpacity: mode === "dark" ? 0.35 : 0.1, shadowRadius: 16, elevation: 6 },
    shadowSoft: { shadowColor: color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: mode === "dark" ? 0.25 : 0.06, shadowRadius: 8, elevation: 3 },
  };
}

export const gradientBrand = ["#14b8a6", "#8b5cf6"];
export const gradientTeal = ["#2dd4bf", "#0d9488"];
export const gradientViolet = ["#a78bfa", "#7c3aed"];

// ---- Theme context ----
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("dark"); // default dark (matches mockups)
  const toggle = useCallback(() => setMode((m) => (m === "dark" ? "light" : "dark")), []);
  const value = useMemo(() => {
    const theme = mode === "dark" ? darkTheme : lightTheme;
    const { shadow, shadowSoft } = makeShadows(mode);
    return { theme, mode, toggle, shadow, shadowSoft, palette };
  }, [mode, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback (should not happen once provider is mounted)
    return { theme: darkTheme, mode: "dark", toggle: () => {}, ...makeShadows("dark"), palette };
  }
  return ctx;
}
