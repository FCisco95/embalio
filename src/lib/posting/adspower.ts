export class AdsPowerClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(
    baseUrl: string = process.env.ADSPOWER_API_BASE ?? "http://local.adspower.net:50325",
    fetchFn: typeof fetch = globalThis.fetch,
  ) {
    this.baseUrl = baseUrl;
    this.fetchFn = fetchFn;
  }

  async start(adspowerUserId: string): Promise<{ wsEndpoint: string }> {
    const url = `${this.baseUrl}/api/v1/browser/start?user_id=${encodeURIComponent(adspowerUserId)}&headless=0`;
    const res = await this.fetchFn(url);
    const json = await res.json();
    if (json.code !== 0) {
      throw new Error(`AdsPower start failed: ${json.msg ?? json.code}`);
    }
    const wsEndpoint = json.data?.ws?.puppeteer;
    if (!wsEndpoint) {
      throw new Error("AdsPower start: missing CDP ws endpoint in response");
    }
    return { wsEndpoint: wsEndpoint as string };
  }

  async stop(adspowerUserId: string): Promise<void> {
    const url = `${this.baseUrl}/api/v1/browser/stop?user_id=${encodeURIComponent(adspowerUserId)}`;
    try {
      const res = await this.fetchFn(url);
      const json = await res.json();
      if (json.code !== 0) {
        console.warn(`AdsPower stop returned non-zero code ${json.code}: ${json.msg ?? ""}`);
      }
    } catch (err) {
      console.warn("AdsPower stop request failed (ignored):", err);
    }
  }
}
