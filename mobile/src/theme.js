/**
 * CallNexa Mobile — Redesigned Design System
 * EMPLOYEE APP: Green theme (#10B981 emerald)
 * ADMIN APP: Warm pastel theme (mint, peach, lavender)
 * WEB: Pastel gradient theme
 */
import { createContext, useContext, useState, useCallback, useMemo } from "react";

// ════════════════════════════════════════════════════════════════════════════
// EMPLOYEE PALETTE (GREEN THEME)
// ════════════════════════════════════════════════════════════════════════════
export const employeePalette = {
  // Primary green
  primary:      "#10B981",      // Emerald
  primaryLight: "#D1F4E8",      // Mint background
  primaryDark:  "#059669",      // Dark emerald
  
  // Navy accents
  navy:         "#1E3A5F",      // Dark navy
  navyLight:    "#3B5A8F",      // Medium navy
  
  // Neutral scale
  white:        "#FFFFFF",
  gray50:       "#F9FAFB",
  gray100:      "#F3F4F6",
  gray200:      "#E5E7EB",
  gray300:      "#D1D5DB",
  gray400:      "#9CA3AF",
  gray500:      "#6B7280",
  gray600:      "#4B5563",
  gray700:      "#374151",
  gray800:      "#1F2937",
  
  // Semantic
  red:          "#EF4444",
  amber:        "#F59E0B",
  blue:         "#3B82F6",
  teal:         "#14B8A6",
  violet:       "#8B5CF6",
};

// ════════════════════════════════════════════════════════════════════════════
// ADMIN PALETTE (WARM PASTEL THEME)
// ════════════════════════════════════════════════════════════════════════════
export const adminPalette = {
  // Primary lime
  primary:      "#84CC16",      // Lime green
  primaryLight: "#F0FECB",      // Very light lime
  
  // Warm pastels
  warmMint:     "#BBEBDB",      // Soft mint
  warmPeach:    "#FCDAB7",      // Soft peach
  warmLavender: "#E9D9F8",      // Soft lavender
  warmYellow:   "#FEF3C7",      // Soft yellow
  
  // Navy accents
  navy:         "#1E3A5F",
  navyLight:    "#3B5A8F",
  
  // Neutral scale (lighter for pastels)
  white:        "#FFFFFF",
  gray50:       "#FAFAF8",
  gray100:      "#F5F3F0",
  gray200:      "#EDE8E3",
  gray300:      "#E0D8D1",
  gray400:      "#C4B5A0",
  gray500:      "#A39E94",
  gray600:      "#7A7268",
  gray700:      "#554A42",
  gray800:      "#3A322B",
  
  // Semantic
  red:          "#EF4444",
  amber:        "#F59E0B",
  blue:         "#3B82F6",
  teal:         "#14B8A6",
  violet:       "#8B5CF6",
};

// Legacy palette export (for compatibility)
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


// ════════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY SCALE
// ════════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════════
// SPACING & RADIUS
// ════════════════════════════════════════════════════════════════════════════
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 };
export const RADIUS = { xs: 6, sm: 8, md: 10, lg: 12, xl: 16, xxl: 20, card: 16, panel: 20, full: 999 };

// ════════════════════════════════════════════════════════════════════════════
// EMPLOYEE THEME (GREEN)
// ════════════════════════════════════════════════════════════════════════════
export const employeeTheme = {
  mode:         "employee",
  // Surfaces
  bg:           employeePalette.white,
  surface:      employeePalette.gray50,
  surface2:     employeePalette.gray100,
  card:         employeePalette.white,
  elevated:     employeePalette.gray50,
  navBar:       employeePalette.white,
  // Text
  primary:      employeePalette.gray800,
  secondary:    employeePalette.gray600,
  muted:        employeePalette.gray500,
  dim:          employeePalette.gray400,
  // Borders
  border:       employeePalette.gray200,
  borderStrong: employeePalette.gray300,
  // Accent
  accent:       employeePalette.primary,
  accent2:      employeePalette.navy,
  accentSoft:   "rgba(16,185,129,0.08)",
  navySoft:     "rgba(30,58,95,0.08)",
  // Semantic
  success:      employeePalette.primary,
  successSoft:  "rgba(16,185,129,0.12)",
  danger:       employeePalette.red,
  dangerSoft:   "rgba(239,68,68,0.12)",
  warning:      employeePalette.amber,
  warningSoft:  "rgba(245,158,11,0.12)",
  info:         employeePalette.blue,
  infoSoft:     "rgba(59,130,246,0.12)",
  // Call types
  incoming:     employeePalette.primary,
  outgoing:     employeePalette.violet,
  missed:       employeePalette.red,
  rejected:     employeePalette.amber,
};

// ════════════════════════════════════════════════════════════════════════════
// ADMIN THEME (WARM PASTEL)
// ════════════════════════════════════════════════════════════════════════════
export const adminTheme = {
  mode:         "admin",
  // Surfaces (warm pastels)
  bg:           adminPalette.primaryLight,      // #F0FECB
  surface:      adminPalette.white,
  surface2:     adminPalette.warmYellow,        // #FEF3C7
  card:         adminPalette.white,
  elevated:     adminPalette.warmMint,          // #BBEBDB
  navBar:       adminPalette.white,
  // Text
  primary:      adminPalette.gray800,
  secondary:    adminPalette.gray600,
  muted:        adminPalette.gray500,
  dim:          adminPalette.gray400,
  // Borders
  border:       adminPalette.gray200,
  borderStrong: adminPalette.gray300,
  // Accent
  accent:       adminPalette.primary,
  accent2:      adminPalette.navy,
  accentSoft:   "rgba(132,204,22,0.08)",
  navySoft:     "rgba(30,58,95,0.08)",
  // Semantic
  success:      adminPalette.primary,
  successSoft:  "rgba(132,204,22,0.12)",
  danger:       adminPalette.red,
  dangerSoft:   "rgba(239,68,68,0.12)",
  warning:      adminPalette.amber,
  warningSoft:  "rgba(245,158,11,0.12)",
  info:         adminPalette.blue,
  infoSoft:     "rgba(59,130,246,0.12)",
  // Call types
  incoming:     adminPalette.primary,
  outgoing:     adminPalette.violet,
  missed:       adminPalette.red,
  rejected:     adminPalette.amber,
};

// ════════════════════════════════════════════════════════════════════════════
// GRADIENTS
// ════════════════════════════════════════════════════════════════════════════
// Employee (green)
export const gradientBrand       = [employeePalette.primaryDark, employeePalette.primary];
export const gradientBrandSoft   = ["rgba(16,185,129,0.08)", "rgba(16,185,129,0.04)"];

// Admin (warm pastel)
export const gradientAdminBg     = ["#BBEBDB", "#FCDAB7", "#F0FECB"];
export const gradientAdminCard   = ["rgba(132,204,22,0.06)", "rgba(187,235,219,0.06)"];

// Legacy gradients
export const gradientTeal        = ["#2dd4bf", "#0d9488"];
export const gradientViolet      = ["#a78bfa", "#7c3aed"];
export const gradientDarkSurface = ["#101521", "#151b29"];
export const gradientHero        = ["#080b12", "#0e1420"];

// ════════════════════════════════════════════════════════════════════════════
// SHADOWS
// ════════════════════════════════════════════════════════════════════════════
export function makeShadows(mode) {
  if (mode === "admin") {
    // Lighter shadows for pastel theme
    return {
      shadowSoft: { shadowColor: "#000", shadowOffset: { width: 0, height: 2  }, shadowOpacity: 0.04, shadowRadius: 8,  elevation: 2  },
      shadowCard: { shadowColor: "#000", shadowOffset: { width: 0, height: 6  }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 3  },
      shadow:     { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 5  },
    };
  }
  // Employee (green) - moderate shadows
  return {
    shadowSoft: { shadowColor: "#000", shadowOffset: { width: 0, height: 2  }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 2  },
    shadowCard: { shadowColor: "#000", shadowOffset: { width: 0, height: 6  }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4  },
    shadow:     { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1,  shadowRadius: 24, elevation: 6  },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// LEGACY THEME CONTEXT (for compatibility)
// ════════════════════════════════════════════════════════════════════════════
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("employee");
  const toggle = useCallback(() => setMode((m) => (m === "employee" ? "admin" : "employee")), []);
  const value = useMemo(() => {
    const themeData = mode === "admin" ? adminTheme : employeeTheme;
    const shadows = makeShadows(mode);
    return { theme: themeData, mode, toggle, palette, TYPE, SPACE, RADIUS, ...shadows };
  }, [mode, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    const shadows = makeShadows("employee");
    return { theme: employeeTheme, mode: "employee", toggle: () => {}, palette, TYPE, SPACE, RADIUS, ...shadows };
  }
  return ctx;
}

// ════════════════════════════════════════════════════════════════════════════
// HOOK: useThemedColors (role-aware theme selection)
// ════════════════════════════════════════════════════════════════════════════
export function useThemedColors(mode) {
  const themeData = mode === "admin" ? adminTheme : employeeTheme;
  const shadows = makeShadows(mode);
  return { theme: themeData, mode, ...shadows };
}
