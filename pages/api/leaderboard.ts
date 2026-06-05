import type { NextApiRequest, NextApiResponse } from "next";
import { connectMongo } from "../../src/lib/mongodb";
import { LeaderboardEntryModel } from "../../src/lib/models/LeaderboardEntry";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  await connectMongo();

  const [inspections, claims] = await Promise.all([
    LeaderboardEntryModel.find({}, "repName inspectionCount")
      .sort({ inspectionCount: -1 })
      .lean(),
    LeaderboardEntryModel.find({}, "repName claimCount revenueTotal")
      .sort({ claimCount: -1 })
      .lean(),
  ]);

  return res.status(200).json({ inspections, claims });
}
