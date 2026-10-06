// Date ranges the employee screens request from the API. The schedule page and the
// offline preload both use these, so their request URLs match and the cache can serve them.

export function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Every day in the month grid for the month `offset` months from `now`, including
// the leading and trailing days from neighbouring months (weeks run Monday to Sunday).
export function getMonthDays(offset: number, now: Date = new Date()): Date[] {
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startPad = (firstOfMonth.getDay() + 6) % 7;
  const endPad = (7 - lastOfMonth.getDay()) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - startPad);
  const totalDays = startPad + lastOfMonth.getDate() + endPad;
  const days: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

// Monday of the week containing `date`, plus `weeks * 7` days.
export function mondayOf(date: Date, weeks = 0): Date {
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7) + weeks * 7);
  return monday;
}
