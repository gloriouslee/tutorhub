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
