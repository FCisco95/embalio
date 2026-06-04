import { getProjectForOverlay } from "@/server/studio/projects";
import { Cockpit } from "@/components/studio/cockpit";

export const dynamic = "force-dynamic";

export default async function OverlayCockpitPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  let script = null;
  try { ({ script } = await getProjectForOverlay(projectId)); } catch { /* render the empty state */ }

  if (!script) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-white/60">No script for this project yet.</div>;
  }
  return <Cockpit script={script} />;
}
