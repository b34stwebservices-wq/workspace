const TZ = "Africa/Lusaka";
type TimestampLike = { toDate: () => Date };
export function toDate(value: unknown): Date | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as TimestampLike).toDate === "function"
  )
    return (value as TimestampLike).toDate();
  return null;
}
export const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  }).format(d);
export const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
export const fmtLongDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
/** yyyy-mm-dd in Lusaka time, for <input type="date"> */
export const toInputDate = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d) : "";
/** Noon Lusaka time (UTC+2, no DST) so the day never shifts. */
export const fromInputDate = (value: string) =>
  value ? new Date(`${value}T12:00:00+02:00`) : null;
export function greeting(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
export type DueState = "none" | "done" | "overdue" | "soon" | "ok";
export function dueState(
  due: Date | null,
  done: boolean,
  now = new Date(),
): DueState {
  if (!due) return "none";
  if (done) return "done";
  const today = toInputDate(now);
  const day = toInputDate(due);
  if (day < today) return "overdue";
  const soon = new Date(now.getTime() + 3 * 86_400_000);
  return day <= toInputDate(soon) ? "soon" : "ok";
}

/** Today's calendar date (YYYY-MM-DD) in Zambia, regardless of device timezone. */
export const todayKey = (at: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
