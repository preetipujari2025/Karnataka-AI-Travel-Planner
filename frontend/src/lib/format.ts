/** Pure display helpers — kept dependency free so they are easy to unit test. */

/** Format an INR amount with Indian digit grouping, e.g. 39452 -> "₹39,452". */
export function formatInr(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded).toString();
  if (digits.length <= 3) return `${sign}₹${digits}`;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}₹${rest},${last3}`;
}

/** 4.5 -> "4h 30m", 2 -> "2h", 0.5 -> "30m". */
export function formatDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Month number (1-12) -> short label. */
export function monthLabel(month: number): string {
  const labels = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return labels[month - 1] ?? "";
}

/** Capitalise category ids for display: "wildlife" -> "Wildlife". */
export function labelise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
