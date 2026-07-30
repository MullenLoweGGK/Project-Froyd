/**
 * LDZ / FROYD design tokens — case board palette from Liga_Froyd_case.pdf.
 * Header remains white; page body uses case blue.
 */
export const ldzTheme = {
  colors: {
    primary: "#0c3d7a",
    accent: "#0986cf",
    caseBlue: "#1a6bb8",
    caseBlueDeep: "#0e4f96",
    caseNavy: "#0a1f4d",
    yellow: "#f9b122",
    orange: "#f09010",
    softBlue: "#d6e8f6",
    white: "#ffffff",
    danger: "#dc3545",
  },
  radii: {
    pill: "100px",
    panel: "24px",
    card: "16px",
  },
  container: "1224px",
  shadow: "0 12px 32px rgba(10, 31, 77, 0.14)",
} as const;
