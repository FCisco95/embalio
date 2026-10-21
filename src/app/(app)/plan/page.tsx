import { redirect } from "next/navigation";
import { requireActiveProfile } from "@/server/active-profile";
import { getGrowthPlan } from "@/server/growth-plan";
import { GrowthPlanReveal } from "@/components/growth-plan-reveal";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const profile = await requireActiveProfile();
  const plan = await getGrowthPlan(profile.id);
  if (!plan) redirect("/");
  return (
    <main className="px-4 py-8">
      <GrowthPlanReveal plan={plan} />
    </main>
  );
}
