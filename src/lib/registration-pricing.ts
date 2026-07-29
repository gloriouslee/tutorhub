import type {
  ClassRegistrationTuition,
  RegistrationPackage,
} from "@/lib/class-registration-types";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function nonNegativeAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}

export function currentTuitionPeriod(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? `${year}-${month}` : now.toISOString().slice(0, 7);
}

export function resolveRegistrationTuition(
  value: unknown,
  period = currentTuitionPeriod(),
): ClassRegistrationTuition {
  const config = asObject(value);
  const table = asObject(config.unit_prices);
  const effectivePeriod = Object.keys(table)
    .filter((key) => /^\d{4}-\d{2}$/.test(key) && key <= period)
    .sort()
    .at(-1);
  const legacyUnitPrice = nonNegativeAmount(config.unit_price);
  const prices = effectivePeriod ? asObject(table[effectivePeriod]) : {};

  return {
    period,
    billing_unit: "session",
    online: nonNegativeAmount(prices.online) || legacyUnitPrice,
    advanced: nonNegativeAmount(prices.advanced) || legacyUnitPrice,
    offline: nonNegativeAmount(prices.offline) || legacyUnitPrice,
  };
}

export function tuitionForPackage(
  tuition: ClassRegistrationTuition,
  packageType: RegistrationPackage,
): number {
  return tuition[packageType];
}
