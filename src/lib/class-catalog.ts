import type { ClassCatalogItem } from "@/lib/class-registration-types";

export function isDiscoverableClass(
  item: Pick<ClassCatalogItem, "enrolled" | "registration_status">,
) {
  return (
    !item.enrolled
    && item.registration_status !== "pending"
    && item.registration_status !== "approved"
  );
}
