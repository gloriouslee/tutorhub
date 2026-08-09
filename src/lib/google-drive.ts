const GOOGLE_DRIVE_HOST = "drive.google.com";
const GOOGLE_DRIVE_FILE_ID = /^[A-Za-z0-9_-]+$/;

/**
 * Converts a public Google Drive file link into the embeddable preview URL.
 * Folder links and non-Google hosts are deliberately rejected.
 */
export function googleDrivePreviewUrl(value?: string): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "https:" || host !== GOOGLE_DRIVE_HOST) return null;

    const pathId = url.pathname.match(/^\/file\/d\/([^/]+)/)?.[1];
    const queryId = url.pathname === "/open" || url.pathname === "/uc"
      ? url.searchParams.get("id")
      : null;
    const fileId = pathId || queryId;
    if (!fileId || !GOOGLE_DRIVE_FILE_ID.test(fileId)) return null;

    const preview = new URL(`https://${GOOGLE_DRIVE_HOST}/file/d/${encodeURIComponent(fileId)}/preview`);
    const resourceKey = url.searchParams.get("resourcekey");
    if (resourceKey) preview.searchParams.set("resourcekey", resourceKey);
    return preview.toString();
  } catch {
    return null;
  }
}
