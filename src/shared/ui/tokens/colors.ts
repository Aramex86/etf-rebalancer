// src/shared/ui/tokens/colors.ts

export const colors = {
  // Brand — доверие, экспертность
  brand: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6", // primary
    600: "#2563eb", // primary hover
    700: "#1d4ed8", // primary active
    800: "#1e40af",
    900: "#1e3a8a",
  },

  // Success — позитивные (покупка, рост)
  success: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e", // buy action
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
  },

  // Danger — негативные (продажа, падение)
  danger: {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444", // sell action
    600: "#dc2626",
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
  },

  // Warning — внимание (нужен rebalance)
  warning: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
  },

  // Info — нейтральная информация
  info: {
    50: "#f0f9ff",
    100: "#e0f2fe",
    500: "#0ea5e9",
    600: "#0284c7",
    700: "#0369a1",
  },

  // Neutral — тексты, фоны, бордеры
  neutral: {
    0: "#ffffff",
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#e5e5e5",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
  },
} as const;

// Семантические токены (используй их в компонентах)
export const semanticColors = {
  bg: {
    primary: "#ffffff",
    secondary: "#fafafa",
    tertiary: "#f5f5f5",
    inverse: "#171717",
  },
  text: {
    primary: "#171717",
    secondary: "#404040",
    tertiary: "#737373",
    disabled: "#a3a3a3",
    inverse: "#ffffff",
    brand: "#2563eb",
    success: "#16a34a",
    danger: "#dc2626",
    warning: "#d97706",
  },
  border: {
    light: "#e5e5e5",
    default: "#d4d4d4",
    strong: "#a3a3a3",
    brand: "#3b82f6",
    success: "#22c55e",
    danger: "#ef4444",
  },
  action: {
    primary: "#3b82f6",
    primaryHover: "#2563eb",
    primaryActive: "#1d4ed8",
    buy: "#22c55e",
    sell: "#ef4444",
    hold: "#737373",
  },
} as const;

export type ColorToken = keyof typeof colors;
export type SemanticColorToken = keyof typeof semanticColors;
