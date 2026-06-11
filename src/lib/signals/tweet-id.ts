/** Extract the numeric status id from an x.com/twitter.com URL, else null. */
export function tweetIdFromUrl(url: string): string | null {
  const m = url.match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}
