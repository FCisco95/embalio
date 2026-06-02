import { google } from "googleapis";
import { createReadStream } from "node:fs";
import { withRetry } from "@/lib/retry";

export const FORCED_PRIVACY = "private" as const;
export const YT_SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

export function buildAuthUrl(opts: { clientId: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: YT_SCOPES.join(" "),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function oauthClient(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID!,
    process.env.YOUTUBE_CLIENT_SECRET!,
    redirectUri,
  );
}

export async function exchangeCodeForRefreshToken(
  code: string,
  redirectUri: string,
): Promise<{ refreshToken: string; scope?: string }> {
  const client = oauthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token)
    throw new Error("no refresh_token returned (revoke prior consent and retry)");
  return { refreshToken: tokens.refresh_token, scope: tokens.scope ?? undefined };
}

export interface UploadInput {
  refreshToken: string;
  filePath: string;
  title: string;
  description: string;
  redirectUri: string;
}

/** Uploads a local file as a PRIVATE video (forced in slice 1). Returns the video id + url. */
export async function uploadVideo(
  input: UploadInput,
): Promise<{ videoId: string; url: string; privacyStatus: string }> {
  const client = oauthClient(input.redirectUri);
  client.setCredentials({ refresh_token: input.refreshToken });
  const youtube = google.youtube({ version: "v3", auth: client });

  // createReadStream is inside the retried fn so each attempt gets a fresh stream.
  const res = await withRetry(() =>
    youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title: input.title, description: input.description },
        status: { privacyStatus: FORCED_PRIVACY },
      },
      media: { body: createReadStream(input.filePath) },
    }),
  );

  const videoId = res.data.id;
  if (!videoId) throw new Error("upload succeeded but no video id returned");
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    privacyStatus: FORCED_PRIVACY,
  };
}
