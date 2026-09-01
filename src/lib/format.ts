export const formatBDT = (n: number | string) =>
  new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(Number(n));

/** Formats a date string (e.g. "2026-09-01") as "01-Sep-2026". */
export function formatDMY(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${day}-${month}-${d.getFullYear()}`;
}

export const PAYMENT_METHODS = ["cash", "bkash", "nagad", "rocket", "bank", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  bank: "Bank",
  other: "Other",
};
