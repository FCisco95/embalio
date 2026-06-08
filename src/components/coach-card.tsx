import { Card, CardContent } from "@/components/ui/card";
import type { DailyAssignment } from "@/lib/coach/assignment";

const LABEL: Record<DailyAssignment["kind"], string> = {
  post: "Today's job — post",
  reply: "Today's job — replies",
  rest: "Today — done",
};

export function CoachCard({ assignment }: { assignment: DailyAssignment }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {LABEL[assignment.kind]}
        </span>
        <h2 className="text-lg font-semibold">{assignment.task}</h2>
        {assignment.angle?.hook ? (
          <p className="text-sm italic text-muted-foreground">
            &ldquo;{assignment.angle.hook}&rdquo;
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">{assignment.why}</p>
        <p className="text-sm font-medium">→ {assignment.nextAction}</p>
      </CardContent>
    </Card>
  );
}
