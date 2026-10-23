// Practice days: finish DAILY_GOAL songs or lessons in a day (replays count) to lay that day's egg in the nest.
// Days in a row with an egg make a streak. Kept per player in their progress as days: { 'YYYY-MM-DD': wins }.
// Dates are the device's local day, so the egg rolls over at the kid's midnight.

export type Days = Record<string, number>;
export const DAILY_GOAL = 2;
const KEEP = 120; // days of history kept; the calendar shows 4 weeks

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// the same time of day, n days away (setDate handles month ends and daylight saving)
const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const met = (days: Days, d: Date) => (days[dayKey(d)] || 0) >= DAILY_GOAL;

// A song or lesson was finished. laid: this one completed today's goal.
export function addWin(days: Days, now = new Date()): { today: number; laid: boolean } {
  const k = dayKey(now);
  const today = (days[k] || 0) + 1;
  days[k] = today;
  const oldest = dayKey(addDays(now, -KEEP));
  for (const key of Object.keys(days)) if (key < oldest) delete days[key];
  return { today, laid: today === DAILY_GOAL };
}

// Days in a row with an egg, up to today. A streak that reaches yesterday is still going until today ends.
export function streak(days: Days, now = new Date()): number {
  let d = met(days, now) ? now : addDays(now, -1);
  let n = 0;
  while (met(days, d)) { n++; d = addDays(d, -1); }
  return n;
}

export const todayWins = (days: Days, now = new Date()): number => days[dayKey(now)] || 0;

export interface CalDay { key: string; date: number; wins: number; egg: boolean; today: boolean; future: boolean }
// The last `weeks` weeks, Sunday to Saturday, ending with this week (rows of 7)
export function calendar(days: Days, now = new Date(), weeks = 4): CalDay[][] {
  const todayKey = dayKey(now);
  const start = addDays(now, -now.getDay() - 7 * (weeks - 1));
  const rows: CalDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: CalDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, w * 7 + i);
      const key = dayKey(d);
      const wins = days[key] || 0;
      row.push({ key, date: d.getDate(), wins, egg: wins >= DAILY_GOAL, today: key === todayKey, future: key > todayKey });
    }
    rows.push(row);
  }
  return rows;
}
