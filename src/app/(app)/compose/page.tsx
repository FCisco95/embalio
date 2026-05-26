import { listProfiles } from "@/server/profiles";
import { Composer } from "@/components/composer";

export default async function ComposePage() {
  const profiles = (await listProfiles()) ?? [];
  return <div className="p-6"><h1 className="text-xl font-semibold mb-3">Compose</h1><Composer profiles={profiles} /></div>;
}
