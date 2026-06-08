"use client";
import { useCallback, useState } from "react";
import { playChime } from "@/lib/reward/chime";
const PARTICLES = Array.from({ length: 12 }, (_, i) => i);
/** Fire a one-shot reward: chime + a brief particle burst. */
export function useReward() {
  const [firing, setFiring] = useState(false);
  const fire = useCallback(() => {
    playChime();
    setFiring(true);
    setTimeout(() => setFiring(false), 900);
  }, []);
  return { fire, burst: <RewardBurst show={firing} /> };
}
function RewardBurst({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {PARTICLES.map((p) => (
        <span key={p} className="absolute size-1.5 rounded-full bg-primary reward-particle"
          style={{ ["--angle" as string]: `${(p / PARTICLES.length) * 360}deg` }} />
      ))}
    </span>
  );
}
