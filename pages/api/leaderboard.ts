// pages/api/leaderboard.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { connectMongo } from "../../src/lib/mongodb";
import { ScoringFactModel } from "../../src/lib/models/ScoringFact";
import { getWindowRange } from "../../src/lib/acculynx/windows";
import type { Window } from "../../src/lib/acculynx/windows";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  await connectMongo();

  const w = (["week", "month", "all"].includes(String(req.query.window)) ? req.query.window : "all") as Window;
  const { start, end } = getWindowRange(w);

  const rows = await ScoringFactModel.aggregate([
    { $match: { occurredAt: { $gte: start, $lte: end }, repExternalId: { $ne: null } } },
    // Deterministic order so $last below means "most recent fact" (newest name/branch/link).
    { $sort: { occurredAt: 1, _id: 1 } },
    { $group: {
        _id: "$repExternalId",
        repName: { $last: "$repNameSnapshot" },
        repUserId: { $last: "$repUserId" },
        branch: { $last: "$location" },
        filed: { $sum: { $cond: [{ $eq: ["$metric", "filed"] }, "$value", 0] } },
        won: { $sum: { $cond: [{ $eq: ["$metric", "won"] }, "$value", 0] } },
        revenue: { $sum: { $cond: [{ $eq: ["$metric", "revenue"] }, "$value", 0] } },
    } },
    { $sort: { won: -1, revenue: -1, filed: -1 } },
  ]);

  const leaderboard = rows.map((r: any, i: number) => ({
    rank: i + 1,
    repExternalId: r._id,
    repUserId: r.repUserId ?? null,
    name: r.repName,
    branch: r.branch,
    filed: r.filed,
    won: r.won,
    revenue: r.revenue,
    linked: Boolean(r.repUserId),
  }));

  return res.status(200).json({ window: w, leaderboard });
}
