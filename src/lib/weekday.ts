/**
 * Canonical weekday label handling.
 *
 * `ClassSchedule.day` has been written in three different forms depending on
 * which editor last touched it: the English name ("Monday"), a Vietnamese
 * abbreviation ("Thứ 2"), or full Vietnamese ("Thứ Hai"). Each display site used
 * to carry its own copy of a lookup table, and most only covered English — so a
 * class schedule created before the Vietnamese editor existed (or seeded/admin
 * data) rendered raw English on some pages and correct Vietnamese on others.
 *
 * This is the one place that knows about all three input forms. Every display
 * site should call weekdayLabelVi(); nothing should read schedule.day directly.
 */

// Sunday = 0, matching Date#getDay().
const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
  "Chủ nhật": 0, "Thứ 2": 1, "Thứ 3": 2, "Thứ 4": 3, "Thứ 5": 4, "Thứ 6": 5, "Thứ 7": 6,
  "Chủ Nhật": 0, "Thứ Hai": 1, "Thứ Ba": 2, "Thứ Tư": 3, "Thứ Năm": 4, "Thứ Sáu": 5, "Thứ Bảy": 6,
};

// Monday-first, for building schedule-editor UI in the order people expect a week.
export const WEEKDAYS_VI = [
  "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật",
] as const;

/** Day-of-week number (0=Sunday..6=Saturday) for any of the three stored forms. */
export function weekdayIndex(day: string): number | undefined {
  return WEEKDAY_INDEX[day];
}

/** Canonical Vietnamese label for any of the three stored forms; passes through unknown input unchanged. */
export function weekdayLabelVi(day: string): string {
  const index = WEEKDAY_INDEX[day];
  if (index === undefined) return day;
  return WEEKDAYS_VI[(index + 6) % 7]; // Sunday(0) -> last, Monday(1) -> first
}
