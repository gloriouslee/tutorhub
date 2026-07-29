export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "password_required";
  if (password.length < 12) return "password_too_short";
  if (password.length > 128) return "password_too_long";
  if (!/[a-z]/.test(password)) return "password_needs_lowercase";
  if (!/[A-Z]/.test(password)) return "password_needs_uppercase";
  if (!/[0-9]/.test(password)) return "password_needs_number";
  if (!/[^A-Za-z0-9]/.test(password)) return "password_needs_symbol";
  return null;
}

export function isNonEmptyString(
  value: unknown,
  maxLength = 500,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

export function isEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

export function isValidDateOfBirth(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  return (
    year >= 1900 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getTime() <= todayUtc
  );
}

export function normalizeStudentGrade(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(?:lớp\s*)?([1-9]|1[0-2])$/i);
  return match ? `Lớp ${Number(match[1])}` : null;
}

export function normalizeContactPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[\s().-]/g, "");
  return /^\+?\d{8,15}$/.test(normalized) ? normalized : null;
}

export interface RequiredStudentProfile {
  full_name?: unknown;
  dob?: unknown;
  school?: unknown;
  grade?: unknown;
  phone?: unknown;
}

export function isCompleteStudentProfile(
  profile: RequiredStudentProfile,
): boolean {
  return (
    isNonEmptyString(profile.full_name, 120) &&
    isValidDateOfBirth(profile.dob) &&
    isNonEmptyString(profile.school, 160) &&
    normalizeStudentGrade(profile.grade) !== null &&
    normalizeContactPhone(profile.phone) !== null
  );
}
