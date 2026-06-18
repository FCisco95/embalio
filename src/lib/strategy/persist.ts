import { StrategySnapshotRecord } from "./schemas";
import type { StrategySnapshot } from "./schemas";

/** Pure builder for a strategy_snapshots row. Caller upserts on (profile_id, week_of). */
export function buildStrategySnapshotRecord(snapshot: StrategySnapshot, profileId: string): StrategySnapshotRecord {
  return StrategySnapshotRecord.parse({
    profile_id: profileId,
    week_of: snapshot.weekOf,
    snapshot_json: snapshot,
  });
}
