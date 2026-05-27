import { listProfiles } from "@/server/profiles";
import { AngleComposer } from "@/components/angle-composer";

export default async function ComposePage() {
  const profiles = (await listProfiles()) ?? [];
  return <div className="p-6"><h1 className="text-xl font-semibold mb-3">Compose</h1><AngleComposer profiles={profiles} /></div>;
}
