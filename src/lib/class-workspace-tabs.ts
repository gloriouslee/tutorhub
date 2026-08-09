export type CurriculumContentFilter = "all" | "lecture" | "material" | "homework" | "exam" | "solution";

export type StudentClassTab = "overview" | "curriculum" | "homework" | "sessions" | "materials" | "notes";
export type TeacherClassTab = "overview" | "curriculum" | "sessions" | "homework" | "resources" | "students" | "tuition";
export type TeacherResourceView = "lectures" | "materials" | "notes";

function cleanTab(raw: string | null) {
  return (raw ?? "").trim().replace(/[\s,.;:]+$/g, "").toLowerCase();
}

function cleanContentFilter(raw: string | null): CurriculumContentFilter {
  const cleaned = cleanTab(raw);
  return (["lecture", "material", "homework", "exam", "solution"] as CurriculumContentFilter[]).includes(cleaned as CurriculumContentFilter)
    ? cleaned as CurriculumContentFilter
    : "all";
}

export function resolveStudentClassWorkspace(tab: string | null, content: string | null = null): {
  tab: StudentClassTab;
  content: CurriculumContentFilter;
} {
  const cleaned = cleanTab(tab);
  if (cleaned === "lectures") return { tab: "curriculum", content: "lecture" };
  if (cleaned === "attendance") return { tab: "sessions", content: "all" };
  if (cleaned === "materials") return { tab: "materials", content: "all" };
  if ((["overview", "curriculum", "homework", "sessions", "notes"] as StudentClassTab[]).includes(cleaned as StudentClassTab)) {
    return { tab: cleaned as StudentClassTab, content: cleaned === "curriculum" ? cleanContentFilter(content) : "all" };
  }
  return { tab: "overview", content: "all" };
}

export function resolveTeacherClassWorkspace(tab: string | null, content: string | null = null): {
  tab: TeacherClassTab;
  content: CurriculumContentFilter;
  resource: TeacherResourceView;
  operations: "sessions" | "schedule";
} {
  const cleaned = cleanTab(tab);
  if (cleaned === "schedule") return { tab: "sessions", content: "all", resource: "materials", operations: "schedule" };
  if (cleaned === "lectures") return { tab: "resources", content: "all", resource: "lectures", operations: "sessions" };
  if (cleaned === "materials") return { tab: "resources", content: "all", resource: "materials", operations: "sessions" };
  if (cleaned === "notes") return { tab: "resources", content: "all", resource: "notes", operations: "sessions" };
  if ((["overview", "curriculum", "sessions", "homework", "resources", "students", "tuition"] as TeacherClassTab[]).includes(cleaned as TeacherClassTab)) {
    const requestedResource = cleanTab(content);
    const resource = cleaned === "resources" && (["lectures", "materials", "notes"] as TeacherResourceView[]).includes(requestedResource as TeacherResourceView)
      ? requestedResource as TeacherResourceView
      : "materials";
    return {
      tab: cleaned as TeacherClassTab,
      content: cleaned === "curriculum" ? cleanContentFilter(content) : "all",
      resource,
      operations: cleaned === "sessions" && cleanTab(content) === "schedule" ? "schedule" : "sessions",
    };
  }
  return { tab: "overview", content: "all", resource: "materials", operations: "sessions" };
}
