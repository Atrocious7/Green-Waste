import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/db";
import Redemption from "@/models/Redemption";
import Transaction from "@/models/Transaction";
import WasteSubmission from "@/models/WasteSubmission";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedAdmin();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30d"; // 7d, 30d, 90d, 1y, all

    const now = new Date();
    let startDate: Date;

    switch (range) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // all time
    }

    const matchStage: Record<string, any> = {};
    if (range !== "all") {
      matchStage.createdAt = { $gte: startDate };
    }

    const [
      // Submissions over time
      submissionsOverTime,
      // Categories distribution
      categoriesDistribution,
      // Status counts
      statusCounts,
      // Green Coins awarded over time
      coinsAwardedOverTime,
      // Redemption statuses
      redemptionStatuses,
    ] = await Promise.all([
      WasteSubmission.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
        { $limit: 365 },
      ]),
      WasteSubmission.aggregate([
        { $match: matchStage },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      WasteSubmission.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        {
          $match: {
            type: "award",
            ...(range !== "all" && { createdAt: { $gte: startDate } }),
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            totalCoins: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
        { $limit: 365 },
      ]),
      Redemption.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    // Format submissions over time for charts
    const submissionsTimeSeries = submissionsOverTime.map((item: any) => ({
      date: new Date(item._id.year, item._id.month - 1, item._id.day).toISOString().split("T")[0],
      count: item.count,
    }));

    // Format coins over time for charts
    const coinsTimeSeries = coinsAwardedOverTime.map((item: any) => ({
      date: new Date(item._id.year, item._id.month - 1, item._id.day).toISOString().split("T")[0],
      totalCoins: item.totalCoins,
      count: item.count,
    }));

    // Categories
    const categories = categoriesDistribution.map((item: any) => ({
      category: item._id || "Unknown",
      count: item.count,
    }));

    // Status counts
    const statusSummary = {
      approved: 0,
      awarded: 0,
      pending: 0,
      needs_review: 0,
      rejected: 0,
    };
    statusCounts.forEach((item: any) => {
      if (item._id in statusSummary) {
        statusSummary[item._id as keyof typeof statusSummary] = item.count;
      }
    });

    // Redemption statuses
    const redemptions = redemptionStatuses.map((item: any) => ({
      status: item._id || "Unknown",
      count: item.count,
    }));

    return NextResponse.json({
      range,
      submissionsOverTime: submissionsTimeSeries,
      categoriesDistribution: categories,
      statusSummary,
      coinsAwardedOverTime: coinsTimeSeries,
      redemptions,
    });
  } catch (error) {
    console.error("Failed to load admin analytics:", error);
    return NextResponse.json({ error: "Unable to load analytics data." }, { status: 500 });
  }
}