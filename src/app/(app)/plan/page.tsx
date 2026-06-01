import { redirect } from "next/navigation";
import { listProfiles } from "@/server/profiles";
import { getGrowthPlan } from "@/server/growth-plan";
import { GrowthPlanReveal } from "@/components/growth-plan-reveal";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const profiles = await listProfiles();
  const profile = profiles?.[0];
  if (!profile?.id) redirect("/setup");
  const plan = await getGrowthPlan(profile.id);
  if (!plan) redirect("/");
  return (
    <main className="px-4 py-8">
      <GrowthPlanReveal plan={plan} />
    </main>
  );
}
