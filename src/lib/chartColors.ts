// Validated chart colors (see the dataviz skill's palette + validator).
// Light/dark pairs are chosen per mode, not auto-derived, per the skill's
// "dark mode is selected, not an automatic flip" rule.

/** Income (green) vs Expense (red) — the two-series financial convention.
 * Light-mode pair sits in the 6-8 CVD warn band (ΔE 7.2), which the skill
 * allows only with secondary encoding — Dashboard adds a dashed stroke on
 * the expense line and a visible legend so color is never the only cue. */
export const TREND_COLORS = {
  light: { income: "#008300", expense: "#e34948" },
  dark: { income: "#008300", expense: "#e66767" },
};

// The skill's default 8-slot categorical ramp — its ordering is itself the
// CVD-safety mechanism (validated adjacent-pair by construction), so funds
// are colored by walking this list in a fixed order, never re-sorted by value.
export const CATEGORICAL: { light: string; dark: string }[] = [
  { light: "#2a78d6", dark: "#3987e5" }, // blue
  { light: "#eb6834", dark: "#d95926" }, // orange
  { light: "#1baf7a", dark: "#199e70" }, // aqua
  { light: "#eda100", dark: "#c98500" }, // yellow
  { light: "#e87ba4", dark: "#d55181" }, // magenta
  { light: "#008300", dark: "#008300" }, // green
  { light: "#4a3aa7", dark: "#9085e9" }, // violet
  { light: "#e34948", dark: "#e66767" }, // red
];

export const STATUS = {
  good: { light: "#0ca30c", dark: "#0ca30c" },
  warning: { light: "#fab219", dark: "#fab219" },
  serious: { light: "#ec835a", dark: "#ec835a" },
  critical: { light: "#d03b3b", dark: "#d03b3b" },
};

/** Picks a categorical color for index i (wraps + folds "Other" past 8 in practice). */
export function categoricalColor(i: number, mode: "light" | "dark") {
  const slot = CATEGORICAL[i % CATEGORICAL.length];
  return mode === "dark" ? slot.dark : slot.light;
}
