export const THAI_TIME_ZONE = "Asia/Bangkok";

const thaiDateFormat = new Intl.DateTimeFormat("th-TH", {
  timeZone: THAI_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const thaiTimeFormat = new Intl.DateTimeFormat("th-TH", {
  timeZone: THAI_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

export function formatThaiDateTime24(value?: Date | null) {
  if (!value) return "-";
  return `${thaiDateFormat.format(value)} ${thaiTimeFormat.format(value)} น.`;
}

export function formatThaiDate(value?: Date | null) {
  return value ? thaiDateFormat.format(value) : "-";
}

export function formatThaiScheduleRange(start: Date, end?: Date | null) {
  const dateText = thaiDateFormat.format(start);
  const startText = thaiTimeFormat.format(start);
  if (!end) return `${dateText} ${startText} น.`;

  return `${dateText} ${startText} - ${thaiTimeFormat.format(end)} น.`;
}
