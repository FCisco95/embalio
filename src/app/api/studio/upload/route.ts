import { NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = join(tmpdir(), `embalio-${Date.now()}-${safe}`);
  await writeFile(path, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ path });
}
