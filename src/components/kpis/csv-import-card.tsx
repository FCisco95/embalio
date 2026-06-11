"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { importAnalyticsCsv, type ImportResult } from "@/server/kpis";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Mirrors the server-side cap in importAnalyticsCsv — client check is UX,
// the server check is the enforcement line.
const MAX_CSV_BYTES = 2 * 1024 * 1024;

export function CsvImportCard({
  profileId,
  dataThrough,
  staleDays,
}: {
  profileId: string;
  dataThrough: string | null;
  staleDays: number | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  function onPick(file: File | null) {
    if (!file || !profileId) return;
    if (file.size > MAX_CSV_BYTES) {
      setResult({ ok: false, error: "File too large — X's analytics export is never more than a few hundred KB." });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    start(async () => {
      try {
        const text = await file.text();
        const r = await importAnalyticsCsv(profileId, text);
        setResult(r);
        if (r.ok) {
          toast.success(`Imported ${r.imported} day${r.imported === 1 ? "" : "s"}`);
          router.refresh();
        } else {
          toast.error("Import failed");
        }
      } catch (e) {
        setResult({ ok: false, error: String(e) });
        toast.error("Import failed");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-semibold">X analytics CSV</h3>
            <p className="text-[12px] text-muted-foreground">
              {dataThrough
                ? `Data through ${dataThrough}`
                : "No analytics imported yet — the KPI cards unlock after the first import."}
            </p>
          </div>
          <Button onClick={() => inputRef.current?.click()} disabled={pending || !profileId}>
            <Upload className="size-4" strokeWidth={1.6} />
            {pending ? "Importing…" : "Import CSV"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
        </div>

        {staleDays !== null && staleDays > 7 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Data is {staleDays} days old — export a fresh CSV from X Analytics.
          </div>
        )}

        {result && !result.ok && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-[13px] text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
            {result.error}
          </div>
        )}

        {result?.ok && result.rejected.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <p className="font-medium">
              {result.rejected.length} row{result.rejected.length === 1 ? "" : "s"} rejected:
            </p>
            <ul className="mt-1 list-disc pl-4">
              {result.rejected.slice(0, 10).map((r) => (
                <li key={r.line}>
                  line {r.line}: {r.reason}
                </li>
              ))}
              {result.rejected.length > 10 && <li>…and {result.rejected.length - 10} more</li>}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
