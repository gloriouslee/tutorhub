export interface PortalBranding {
  name: string;
  logoUrl: string;
  teacherId?: string;
}

export const DEFAULT_PORTAL_BRANDING: PortalBranding = {
  name: "TutorHub",
  logoUrl: "",
};

const MAX_PORTAL_NAME_LENGTH = 60;

function isPortalLogoUrl(value: string): boolean {
  if (!value.startsWith("/api/files?")) return false;

  const query = value.slice(value.indexOf("?") + 1);
  const params = new URLSearchParams(query);
  const path = params.get("path") ?? "";
  const segments = path.split("/");

  return params.get("bucket") === "avatars"
    && segments.length >= 3
    && segments[0].length > 0
    && segments[1] === "portal-logo";
}

export function resolvePortalBranding(
  value: unknown,
  teacherId?: string,
): PortalBranding {
  const settings = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawName = typeof settings.portal_name === "string"
    ? settings.portal_name.trim()
    : "";
  const rawLogoUrl = typeof settings.portal_logo_url === "string"
    ? settings.portal_logo_url.trim()
    : "";

  return {
    name: rawName.slice(0, MAX_PORTAL_NAME_LENGTH) || DEFAULT_PORTAL_BRANDING.name,
    logoUrl: isPortalLogoUrl(rawLogoUrl) ? rawLogoUrl : "",
    ...(teacherId ? { teacherId } : {}),
  };
}
