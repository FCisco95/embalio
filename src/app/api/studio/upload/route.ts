import { NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// NOTE: like the rest of this local single-user app, this route is currently
// unauthenticated. The written temp file is consumed immediately by
// publishProjectVideo and unlinked there. When the app gains a real auth/RLS
// layer (the deferred multi-tenant workstream), gate this route on the session.
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = join(tmpdir(), `embalio-${Date.now()}-${safe}`);
  await writeFile(path, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ path });
}
