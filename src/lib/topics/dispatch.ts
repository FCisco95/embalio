/**
 * Background refresh = fire the GH Actions worker via workflow_dispatch.
 * Env-gated (GITHUB_DISPATCH_TOKEN: fine-grained PAT, Actions read/write on
 * FCisco95/embalio). No token → silent no-op; the scheduled cadence still covers us.
 * Never throws — freshness UX must not depend on GitHub availability.
 */
export async function dispatchTopicRefresh(): Promise<boolean> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return false;
  const repo = process.env.GITHUB_DISPATCH_REPO ?? "FCisco95/embalio";
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/refresh-topics.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      },
    );
    return res.status === 204;
  } catch {
    return false;
  }
}
