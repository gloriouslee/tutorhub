import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidMutationOrigin } from "@/lib/request-security";
import { parentCanAccessStudent } from "@/lib/guardian-server";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function hasValidSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "application/pdf") {
    return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }
  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.type === "image/png") {
    return bytes.slice(0, 8).every((value, index) =>
      value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index],
    );
  }
  if (file.type === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function POST(req: NextRequest) {
  if (!hasValidMutationOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getRequestIdentity(req);
  if (
    !actor
    || (actor.role !== "student" && actor.role !== "parent")
    || (actor.role === "student" && !actor.studentId)
    || (actor.role === "parent" && !actor.parentId)
  ) {
    return NextResponse.json({ error: "payment_authorization_required" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = form.get("file");
  let studentId = actor.studentId ?? "";
  if (actor.role === "parent") {
    const requestedChildId = form.get("child_id");
    if (typeof requestedChildId !== "string" || !requestedChildId) {
      return NextResponse.json({ error: "child_required" }, { status: 400 });
    }
    const admin = createAdminClient();
    if (!(await parentCanAccessStudent(admin, actor.parentId!, requestedChildId))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    studentId = requestedChildId;
  }
  if (
    !(file instanceof File)
    || file.size <= 0
    || file.size > MAX_BYTES
    || !ALLOWED_TYPES.has(file.type)
  ) {
    return NextResponse.json({ error: "invalid_receipt_file" }, { status: 400 });
  }
  if (!await hasValidSignature(file)) {
    return NextResponse.json({ error: "invalid_receipt_content" }, { status: 400 });
  }

  const extension =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
  const path = `${studentId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await createAdminClient().storage
    .from("payment-receipts")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    return NextResponse.json({ error: "receipt_upload_failed" }, { status: 500 });
  }
  return NextResponse.json({
    path,
    url: `/api/files?bucket=payment-receipts&path=${encodeURIComponent(path)}`,
  }, { status: 201 });
}
