import { createClient } from "@/lib/supabase/client";

export type UploadedFile = {
  url: string;
  path: string;
  name: string;
  size: string;
  file_type: string; // "pdf" | "docx" | "pptx"
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "docx";
  if (["ppt", "pptx"].includes(ext)) return "pptx";
  return ext;
}

export async function uploadClassFile(
  file: File,
  classId: string,
  subfolder: "materials" | "homework" = "materials"
): Promise<UploadedFile> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${classId}/${subfolder}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage
    .from("class-materials")
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("class-materials").getPublicUrl(path);

  return {
    url: data.publicUrl,
    path,
    name: file.name,
    size: formatSize(file.size),
    file_type: getFileType(file.name),
  };
}
