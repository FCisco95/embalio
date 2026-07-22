// src/components/manual-sniper-form.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualSniperAlert } from "@/server/sniper-actions";

const DROP_LABEL: Record<string, string> = {
  crowded: "30+ replies — hard to land top-5",
  stale: "over 3h old and not hot",
  bait: "reads like engagement bait",
};

/**
 * Manual sniper mode: paste a tweet URL you're looking at on X, add what you
 * can see (text required; followers/replies/age optional), and the sniper
 * scores + drafts it into a normal pin below. Zero Apify.
 */
export function ManualSniperForm({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [followers, setFollowers] = useState("");
  const [replies, setReplies] = useState("");
  const [age, setAge] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const num = (s: string): number | null => {
    const n = Number(s.trim());
    return s.trim() === "" || !Number.isFinite(n) || n < 0 ? null : n;
  };

  function submit() {
    setMsg(null);
    startTransition(async () => {
      try {
        const followersN = num(followers);
        const repliesN = num(replies);
        const r = await createManualSniperAlert(profileId, {
          url,
          tweetText: text,
          authorFollowers: followersN === null ? null : Math.round(followersN),
          replyCount: repliesN === null ? null : Math.round(repliesN),
          ageMinutes: num(age),
        });
        if (!r.ok) {
          setMsg({ kind: "err", text: r.reason });
          return;
        }
        const scoreTxt = `pinned below — score ${Math.round(r.score * 100)}`;
        setMsg(
          r.drop
            ? { kind: "warn", text: `${scoreTxt} · ⚠ ${DROP_LABEL[r.drop] ?? r.drop} (your call)` }
            : { kind: "ok", text: scoreTxt },
        );
        setUrl(""); setText(""); setFollowers(""); setReplies(""); setAge("");
        router.refresh(); // getSniperPins re-runs → the new pin renders with draft + caps + Send
      } catch {
        setMsg({ kind: "err", text: "something went wrong — check the URL and try again" });
      }
    });
  }

  return (
    <div className="mb-3 rounded-lg border border-border p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
      >
        🎯 Manual sniper — paste a tweet URL {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://x.com/…/status/…"
            className="w-full text-[13px] rounded-md border border-border bg-background p-2"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the tweet text"
            rows={2}
            className="w-full text-[13px] rounded-md border border-border bg-background p-2"
          />
          <div className="flex gap-2">
            <input value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="Author followers (opt)"
              inputMode="numeric" className="flex-1 min-w-0 text-[12px] rounded-md border border-border bg-background p-2" />
            <input value={replies} onChange={(e) => setReplies(e.target.value)} placeholder="Replies (opt)"
              inputMode="numeric" className="flex-1 min-w-0 text-[12px] rounded-md border border-border bg-background p-2" />
            <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age min (opt)"
              inputMode="numeric" className="flex-1 min-w-0 text-[12px] rounded-md border border-border bg-background p-2" />
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={pending || !url.trim() || !text.trim()}
              onClick={submit}
              className="text-[12px] px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-500 font-medium disabled:opacity-40"
            >
              {pending ? "Scoring…" : "Score & pin"}
            </button>
            {msg && (
              <span className={`text-[11px] ${msg.kind === "err" ? "text-red-500" : msg.kind === "warn" ? "text-amber-500" : "text-muted-foreground"}`}>
                {msg.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
