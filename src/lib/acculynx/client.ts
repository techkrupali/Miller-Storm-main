// src/lib/acculynx/client.ts
import { ACCULYNX_BASE } from "./config";

function apiKey(): string {
  const k = process.env.ACCULYNX_API_KEY;
  if (!k) throw new Error("ACCULYNX_API_KEY is not set");
  return k;
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// GET with retry/backoff on 429 + 5xx. Returns parsed JSON, or null on 404.
async function get(path: string, params: Record<string, string | number> = {}): Promise<any> {
  const url = new URL(ACCULYNX_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey()}`, Accept: "application/json" },
    });
    if (res.status === 404) return null;
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      await sleep(Math.min(8000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250));
      continue;
    }
    throw new Error(`AccuLynx ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error(`AccuLynx retries exhausted on ${path}`);
}

const PAGE = 100;

// All jobs modified on/after `since` (YYYY-MM-DD). Paginates fully.
export async function fetchJobsModifiedSince(since: string): Promise<any[]> {
  const out: any[] = [];
  let recordStartIndex = 0;
  for (;;) {
    const page = await get("/jobs", {
      dateFilterType: "ModifiedDate", startDate: since,
      sortBy: "ModifiedDate", sortOrder: "Descending",
      pageSize: PAGE, recordStartIndex,
    });
    const items = page?.items ?? [];
    out.push(...items);
    if (items.length < PAGE) break;
    recordStartIndex += PAGE;
    if (recordStartIndex > 100000) break; // AccuLynx hard cap guard
  }
  return out;
}

export async function fetchMilestoneHistory(jobId: string) { return get(`/jobs/${jobId}/milestone-history`); }
export async function fetchRepresentatives(jobId: string) { return get(`/jobs/${jobId}/representatives`); }
export async function fetchFinancials(jobId: string) { return get(`/jobs/${jobId}/financials`); }

// All users -> map of AccuLynx userId -> { email, name }.
export async function fetchUserMap(): Promise<Record<string, { email: string; name: string }>> {
  const map: Record<string, { email: string; name: string }> = {};
  let recordStartIndex = 0;
  for (;;) {
    const page = await get("/users", { pageSize: PAGE, recordStartIndex });
    const items = page?.items ?? [];
    for (const u of items) {
      const name = u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || u.id;
      map[u.id] = { email: (u.email || "").toLowerCase(), name };
    }
    if (items.length < PAGE) break;
    recordStartIndex += PAGE;
  }
  return map;
}
