export const metadata = {
  title: "Privacy notice — signal monitoring",
  description:
    "How Embalio processes public X/Twitter posts from watched accounts: what is collected, the legal basis, retention, and how to object.",
};

// Static public notice (GDPR LIA §5 R2) — no data reads, safe to prerender.
// Outside the (app) group so it renders without the app shell or any profile lookup.
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Privacy notice — signal monitoring</h1>
          <p className="text-sm text-muted-foreground">
            Last updated 22 July 2026 · Controller: João Francisco Vieira (Embalio, sole operator)
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">What this covers</h2>
          <p className="text-sm leading-6">
            Embalio is a personal growth-operator tool. To spot timely public conversations worth
            replying to, it monitors a small, curated list of public X/Twitter accounts (currently
            fewer than ten) and stores some of their public posts. If you hold one of those
            accounts, this notice describes how your data is handled.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">What is collected</h2>
          <ul className="list-disc pl-5 text-sm leading-6 space-y-1">
            <li>Publicly posted tweet text, author handle and display name</li>
            <li>Public engagement metrics (likes, replies, views) and post timestamps</li>
            <li>Tweet and author IDs, plus derived relevance scores and text embeddings</li>
          </ul>
          <p className="text-sm leading-6">
            Nothing beyond public data is touched: no private messages, no content behind
            authentication, no private accounts, no contact details, and no special-category data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Why, and on what legal basis</h2>
          <p className="text-sm leading-6">
            Processing rests on legitimate interest (Art. 6(1)(f) GDPR): identifying relevant,
            well-timed public conversations so the operator can reply personally. A documented
            Legitimate Interests Assessment is on file. Nothing is automated toward you — every
            reply is written and sent by hand through X&apos;s own composer, and the data is never
            sold, shared, or used for advertising.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Storage and retention</h2>
          <p className="text-sm leading-6">
            Data is stored in the EU (Supabase Postgres, eu-central-1). Collected posts are
            hard-deleted 90 days after first collection by a daily purge job; derived metric
            snapshots are deleted with them.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Your rights</h2>
          <p className="text-sm leading-6">
            You can ask what is held about your account (access, Art. 15), object to the
            monitoring (Art. 21), or request erasure (Art. 17). On objection or erasure your
            handle is removed from the watch list and all stored posts and alerts referencing
            your account are deleted.
          </p>
          <p className="text-sm leading-6">
            Contact:{" "}
            <a className="underline" href="mailto:cisco.vieira25@gmail.com">
              cisco.vieira25@gmail.com
            </a>
            . Requests are handled within 30 days. You also have the right to lodge a complaint
            with your supervisory authority (in Portugal, the CNPD).
          </p>
        </section>
      </div>
    </main>
  );
}
