import { listProfiles } from "@/server/profiles";
import { WeeklyComposer } from "@/components/weekly-composer";

export default async function ComposePage() {
  const profiles = (await listProfiles()) ?? [];
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Compose</h1>
      <WeeklyComposer profiles={profiles} />
    </div>
  );
}
