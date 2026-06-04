import { VideoScript } from "@/lib/studio/schemas";

/** Pure: extract a VideoScript from a project row's `script` jsonb, or null. */
export function beatsFromProject(project: { script?: unknown } | null): VideoScript | null {
  if (!project?.script) return null;
  const parsed = VideoScript.safeParse(project.script);
  return parsed.success ? parsed.data : null;
}
