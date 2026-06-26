# GDPR Legitimate Interests Assessment — Sniper signal warehouse

**Document type:** Legitimate Interests Assessment (LIA) — Art. 6(1)(f) GDPR record
**Controller:** João Francisco Vieira (Embalio, sole operator — dogfood / pre-revenue stage)
**Date:** 2026-06-24 · **Author:** operator (drafted with Claude) · **Next review:** before first paying client, or 2026-09-04 (GATE-2 deadline), whichever first
**Status:** DRAFT self-assessment. *Not legal advice.* Obtain professional review before processing third-party data at scale or onboarding any client.

> Trigger: GATE-2 ignition seeds in-band watch-target handles; the 15-min poll then warehouses those (third-party) accounts' public tweets. EDPB *Guidelines 1/2024 on legitimate interest* require the LIA to be documented **before** processing begins. This is the record.

---

## 1. What is processed (scope)

| | |
|---|---|
| **Data subjects** | Holders of a small, curated set of public X/Twitter accounts ("`watch_targets`", currently 4–10 handles in the operator's niche). Public figures / public-facing creators. |
| **Personal data** | Publicly-posted tweet text, author handle/display name, public engagement metrics, post timestamps, tweet/author IDs. Derived: text embeddings + engagement/relevance/breakout scores. |
| **Source** | Public X timelines, collected via a third-party Apify actor (`SIGNAL_SOURCE='apify'`). Public data only. |
| **NOT processed** | No private/DM content, no special-category data (Art. 9) sought, no contact details, no scraping behind auth, no data on private accounts. |
| **Storage** | Supabase Postgres, EU region (`eu-central-1`). Tables: `signal_tweets` (warehouse), `sniper_alerts`. |
| **Purpose of use** | Detect timely, relevant public conversations and surface them to the operator, who then **manually** drafts and sends a reply via X's first-party composer. |

**No automated action toward data subjects.** Posting is human-in-the-loop only (`posting.ts` refuses `kind==='reply'`; every send opens X's native composer for the operator to post by hand). No automated decision-making producing legal or similarly significant effects (Art. 22 not engaged).

---

## 2. Purpose test — is there a legitimate interest?

**Interest:** Building and validating a growth-operator tool that helps the operator identify authentic, well-timed engagement opportunities on X, and measuring whether assisted replies improve out-of-network reach. This is a real, specific, present commercial + product-validation interest (not speculative).

Engaging with relevant public conversations is a normal, expected activity on a public social platform. The legitimate interest is **valid**.

---

## 3. Necessity test — is the processing necessary?

Yes, and minimised:
- Detecting *relevance + timeliness* requires reading the public posts; there is no less-intrusive way to know what an account just posted and whether it is on-topic.
- **Data minimisation:** watch list deliberately kept small (4–10 handles, not 100k+); public fields only; no enrichment with off-platform identifiers; embeddings/scores are derived for ranking, not for profiling individuals' private traits.
- **Purpose limitation:** data used solely to rank reply opportunities for the operator — not sold, not shared, not used for advertising or any secondary purpose.

A less-intrusive alternative (manual browsing) does not scale to the validation goal; the processing is **necessary and proportionate**.

---

## 4. Balancing test — interest vs. data subjects' rights & freedoms

| Factor | Assessment |
|---|---|
| **Nature of data** | Public, voluntarily broadcast to a public audience. Low sensitivity. But *systematic warehousing + scoring* is more than a casual read, so mitigations are required (below). |
| **Reasonable expectations** | A public-account holder reasonably expects their posts to be read, indexed, quoted, and replied to. They may *not* expect indefinite third-party retention + algorithmic scoring → addressed by retention limit + transparency. |
| **Possible impact** | Low. No automated outreach; the operator manually decides every reply. No financial, reputational, or legal effect imposed on the subject. Data not exposed publicly by Embalio. |
| **Power balance / vulnerability** | Subjects are public-facing adults on a public platform; no vulnerable groups targeted. |
| **Mitigations (see §5)** | Small list, EU storage, retention + purge, DSR honoured, transparency notice, no special-category targeting, manual-only action. |

**Provisional outcome:** The legitimate interest **can be relied upon for the GATE-2 dogfood**, *conditional* on the §5 mitigations — most critically a working **retention/purge** mechanism and a **published privacy notice + objection path**. Without the purge mechanism, the balance is weaker (see risk R1).

---

## 5. Safeguards & required remediations

| # | Safeguard | State | Action |
|---|---|---|---|
| **R1** | **Retention + purge.** `signal_tweets.deleted_at` exists but is **never written — no purge job runs** (`src/lib/signals/warehouse.ts`). Data accumulates indefinitely. | ✅ **Shipped** | Hard-delete `signal_tweets` where `first_seen_at` is older than **90 days** (env `SIGNAL_RETENTION_DAYS`); the `on delete cascade` FK auto-purges the row's `tweet_metric_snapshots`. Runs daily via the `signal-retention` cron (02:45 UTC). Fail-loud: the route returns non-200 on DB error so GitHub Actions surfaces it. |
| **R2** | **Transparency / privacy notice.** Data subjects are not first-party users. | ❌ Missing | Publish a short privacy notice (what's collected, basis = legitimate interest, retention, contact + objection/erasure route) at a stable Embalio URL. |
| **R3** | **Data-subject rights (DSR).** Right to object (Art. 21), erasure (Art. 17), access (Art. 15). | ⚠️ Manual | Provide a contact email; on objection/erasure, deactivate the handle in `watch_targets` and purge their `signal_tweets`/`sniper_alerts` rows. Document the runbook. |
| **R4** | Storage location | ✅ EU (`eu-central-1`) | Maintain EU residency. |
| **R5** | Minimisation | ✅ Small list, public fields | Keep watch list small; review additions. |
| **R6** | No automated significant decisions | ✅ Manual-send only | Preserve human-in-the-loop; do not reintroduce auto-posting (also a ToS/ban control). |

---

## 6. Outcome & sign-off

- **Decision:** Proceed with the GATE-2 dogfood under Art. 6(1)(f), **with R1–R3 tracked as conditions.** R1 (purge) must ship before processing scales or any third party's data beyond the dogfood watch list is added.
- **Residual risk:** Low. R1 (indefinite retention) is now closed by the shipped 90-day purge; the remaining open conditions are R2 (published transparency notice) and R3 (documented DSR runbook), both outward/owner tasks. Mitigated by small scope, public data, manual-only action, EU storage, and the enforced retention bound.
- **Review triggers:** onboarding any client; expanding the watch list materially; adding a non-Apify source; before 2026-09-04.

**Operator sign-off:** _______________________  Date: __________

> Reminder: this self-assessment does not replace legal advice. The conclusion is conditional on the remediations above being executed, not merely listed.
