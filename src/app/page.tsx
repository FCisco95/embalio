import { PageShell } from "@/components/shell/page-shell"
import { CockpitTile } from "@/components/cockpit/cockpit-tile"
import { ResearchTile } from "@/components/cockpit/research-tile"
import { getWeeklyBriefing, runWeeklyBriefing, type Briefing } from "@/server/briefing"

const TODAY = new Date().toISOString().split("T")[0]

const NAV_TILES = [
  {
    emoji: "💬",
    title: "Who to reply to",
    description: "Daily reply opportunities from seed accounts — drafted replies ready to copy.",
    href: "/engage",
    cta: "Open queue",
  },
  {
    emoji: "➕",
    title: "Who to follow",
    description: "Target accounts aligned with your pillars and audience growth.",
    href: "/board",
    cta: "View board",
  },
  {
    emoji: "✍️",
    title: "Generate posts",
    description: "3–5 weekly posts drafted from your briefing, voice-matched.",
    href: "/compose",
    cta: "Go compose",
  },
  {
    emoji: "🧵",
    title: "Draft a thread",
    description: "Turn a topic or briefing insight into a full Twitter thread.",
    href: "/compose?mode=thread",
    cta: "Draft thread",
  },
  {
    emoji: "🎙️",
    title: "Tune my voice",
    description: "Update your voice spec and content pillars.",
    href: "/profiles",
    cta: "Open profiles",
  },
]

async function runResearch(): Promise<{ ok: boolean; briefing?: Briefing; error?: string }> {
  "use server"
  try {
    const briefing = await runWeeklyBriefing(TODAY)
    return { ok: true, briefing }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export default async function HomePage() {
  const briefing = await getWeeklyBriefing(TODAY)

  return (
    <PageShell title="Cockpit" padded={false}>
      <div className="max-w-[1180px] mx-auto px-8 py-8 pb-16">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Good morning</h2>
          <p className="text-muted-foreground text-sm mt-1">
            What do you want to do today?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-3">
          <ResearchTile initialBriefing={briefing} onRun={runResearch} />
          {NAV_TILES.map((tile) => (
            <CockpitTile key={tile.href} {...tile} />
          ))}
        </div>
      </div>
    </PageShell>
  )
}
