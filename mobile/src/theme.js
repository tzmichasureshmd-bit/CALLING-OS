/**
 * CallNexa Mobile — Design System
 * Mirrors the web dashboard CSS variables exactly.
 * Dark: #080b12 bg · #101521 surface · teal #14b8a6 · violet #8b5cf6
 * Light: #f7f8fc bg · #ffffff surface · teal #0d9488 · violet #7c3aed
 */
import { createContext, useContext, useState, useCallback, useMemo } from "react";

// ── Brand palette (matches web --teal, --violet, etc.) ────────────────────────
export const palette = {
  teal:       "#14b8a6",
  tealDark:   "#0d9488",
  tealLight:  "#2dd4bf",
  violet:     "#8b5cf6",
  violetDark: "#7c3aed",
  violetLight:"#a78bfa",
  cyan:       "#22d3ee",
  emerald:    "#22c55e",
  amber:      "#f59e0b",
  red:        "#ef4444",
  blue:       "#3b82f6",
  info:       "#0891b2",
};

// ── Typography scale ──────────────────────────────────────────────────────────
// Matches web "Space Grotesk" headings + "Inter" body feel
export const TYPE = {
  display: { fontSize: 48, fontWeight: "800", letterSpacing: -1,    lineHeight: 56 },
  h1:      { fontSize: 26, fontWeight: "800", letterSpacing: -0.5,  lineHeight: 32 },
  h2:      { fontSize: 20, fontWeight: "700", letterSpacing: -0.3,  lineHeight: 26 },
  h3:      { fontSize: 16, fontWeight: "700", letterSpacing: -0.2,  lineHeight: 22 },
  title:   { fontSize: 15, fontWeight: "600", letterSpacing: -0.1,  lineHeight: 21 },
  body:    { fontSize: 14, fontWeight: "500",                        lineHeight: 22 },
  bodyBold:{ fontSize: 14, fontWeight: "600",                        lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: "600", letterSpacing: 0.1,   lineHeight: 18 },
  label:   { fontSize: 11, fontWeight: "700", letterSpacing: 0.4,   lineHeight: 16 },
  micro:   { fontSize: 10, fontWeight: "700", letterSpacing: 0.3,   lineHeight: 14 },
};

// ── Spacing scale ─────────────────────────────────────────────────────────────
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 };

// ── Radius scale ──────────────────────────────────────────────────────────────
export const RADIUS = { xs: 6, sm: 8, md: 10, lg: 12, xl: 16, xxl: 20, card: 16, panel: 20, full: 999 };

// ── Dark theme — mirrors web [data-theme="dark"] ──────────────────────────────
export const darkTheme = {
  mode:         "dark",
  // Surfaces — web: --bg:#080b12 --surface:#101521 --surface-2:#151b29
  bg:           "#080b12",
  surface:      "#101521",
  surface2:     "#151b29",
  card:         "#101521",
  elevated:     "#151b29",
  navBar:       "#0b0f18",
  // Text — web: --text-primary:#eef2f9 --text-secondary:#c2cad8 --text-muted:#8b95a7 --text-dim:#5d6577
  primary:      "#eef2f9",
  secondary:    "#c2cad8",
  muted:        "#8b95a7",
  dim:          "#6b7585",   // bumped from #5d6577 for WCAG AA
  // Borders — web: --border:#1e2636 --border-strong:#2a3446
  border:       "#1e2636",
  borderStrong: "#2a3446",
  // Accent — web: --accent:#2dd4bf --accent-2:#a78bfa
  accent:       "#2dd4bf",
  accent2:      "#a78bfa",
  accentSoft:   "rgba(45,212,191,0.12)",
  violetSoft:   "rgba(167,139,250,0.12)",
  // Semantic — web: --success:#34d399 --danger:#f87171 --warning:#fbbf24
  success:      "#34d399",
  successSoft:  "rgba(52,211,153,0.12)",
  danger:       "#f87171",
  dangerSoft:   "rgba(248,113,113,0.12)",
  warning:      "#fbbf24",
  warningSoft:  "rgba(251,191,36,0.12)",
  info:         "#38bdf8",
  infoSoft:     "rgba(56,189,248,0.12)",
  // Call type colors
  incoming:     "#14b8a6",
  outgoing:     "#8b5cf6",
  missed:       "#ef4444",
  rejected:     "#f59e0b",
};

// ── Light theme — mirrors web :root ──────────────────────────────────────────
export const lightTheme = {
  mode:         "light",
  // Surfaces — web: --bg:#f7f8fc --surface:#ffffff --surface-2:#f2f4f9
  bg:           "#f7f8fc",
  surface:      "#ffffff",
  surface2:     "#f2f4f9",
  card:         "#ffffff",
  elevated:     "#ffffff",
  navBar:       "#ffffff",
  // Text — web: --text-primary:#0f1729 --text-secondary:#384152 --text-muted:#667085 --text-dim:#98a2b3
  primary:      "#0f1729",
  secondary:    "#384152",
  muted:        "#667085",
  dim:          "#98a2b3",
  // Borders — web: --border:#e5e7eb --border-strong:#d3d8e0
  border:       "#e5e7eb",
  borderStrong: "#d3d8e0",
  // Accent — web: --accent:#0d9488 --accent-2:#7c3aed
  accent:       "#0d9488",
  accent2:      "#7c3aed",
  accentSoft:   "#e6f6f4",
  violetSoft:   "rgba(124,58,237,0.1)",
  // Semantic — web: --success:#16a34a --danger:#dc2626 --warning:#d97706
  success:      "#16a34a",
  successSoft:  "#e7f7ec",
  danger:       "#dc2626",
  dangerSoft:   "#fdecec",
  warning:      "#d97706",
  warningSoft:  "#fdf2e3",
  info:         "#0891b2",
  infoSoft:     "#e2f6fb",
  // Call type colors
  incoming:     "#0d9488",
  outgoing:     "#7c3aed",
  missed:       "#dc2626",
  rejected:     "#d97706",
};

// ── Shadows — mirrors web --shadow-sm/md/lg ───────────────────────────────────
export function makeShadows(mode) {
  if (mode === "dark") {
    return {
      shadowSoft: { shadowColor: "#000", shadowOffset: { width: 0, height: 2  }, shadowOpacity: 0.5,  shadowRadius: 8,  elevation: 3  },
      shadowCard: { shadowColor: "#000", shadowOffset: { width: 0, height: 6  }, shadowOpacity: 0.5,  shadowRadius: 20, elevation: 6  },
      shadow:     { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.6,  shadowRadius: 40, elevation: 10 },
    };
  }
  return {
    shadowSoft: { shadowColor: "#0f1729", shadowOffset: { width: 0, height: 1  }, shadowOpacity: 0.06, shadowRadius: 4,  elevation: 2  },
    shadowCard: { shadowColor: "#0f1729", shadowOffset: { width: 0, height: 6  }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 4  },
    shadow:     { shadowColor: "#0f1729", shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.12, shadowRadius: 44, elevation: 8  },
  };
}

// ── Gradients — matches web --grad-brand ─────────────────────────────────────
export const gradientBrand       = ["#14b8a6", "#8b5cf6"];          // teal → violet
export const gradientBrandSoft   = ["rgba(20,184,166,0.16)", "rgba(139,92,246,0.16)"];
export const gradientTeal        = ["#2dd4bf", "#0d9488"];
export const gradientViolet      = ["#a78bfa", "#7c3aed"];
export const gradientDarkSurface = ["#101521", "#151b29"];
export const gradientHero        = ["#080b12", "#0e1420"];

// ── Theme context ─────────────────────────────────────────────────────────────
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("dark");
  const toggle = useCallback(() => setMode((m) => (m === "dark" ? "light" : "dark")), []);
  const value = useMemo(() => {
    const theme = mode === "dark" ? darkTheme : lightTheme;
    const shadows = makeShadows(mode);
    return { theme, mode, toggle, palette, TYPE, SPACE, RADIUS, ...shadows };
  }, [mode, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    const shadows = makeShadows("dark");
    return { theme: darkTheme, mode: "dark", toggle: () => {}, palette, TYPE, SPACE, RADIUS, ...shadows };
  }
  return ctx;
}
