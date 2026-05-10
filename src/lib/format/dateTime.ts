const thaiDateFormat = new Intl.DateTimeFormat("th-TH", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const thaiTimeFormat = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

export function formatThaiDateTime24(value: Date) {
  return `${thaiDateFormat.format(value)} ${thaiTimeFormat.format(value)} น.`;
}

export function formatThaiScheduleRange(start: Date, end?: Date | null) {
  const dateText = thaiDateFormat.format(start);
  const startText = thaiTimeFormat.format(start);
  if (!end) return `${dateText} ${startText} น.`;

  return `${dateText} ${startText} - ${thaiTimeFormat.format(end)} น.`;
}
