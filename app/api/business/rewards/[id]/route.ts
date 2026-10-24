import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { getAuthenticatedBusiness } from "@/lib/businessAuth";
import Reward from "@/models/Reward";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, props: RouteProps) {
  const auth = await getAuthenticatedBusiness();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { business } = auth;
  const { id } = await props.params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid reward ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { title, description, coinCost, quantity, status } = (body as Record<string, unknown>) || {};

  const updates: Record<string, unknown> = {};

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Reward title cannot be empty." }, { status: 400 });
    }
    updates.title = title.trim();
  }

  if (description !== undefined) {
    if (typeof description !== "string") {
      return NextResponse.json({ error: "Description must be a string." }, { status: 400 });
    }
    updates.description = description.trim();
  }

  if (coinCost !== undefined) {
    const cost = Number(coinCost);
    if (!Number.isFinite(cost) || cost < 1 || !Number.isInteger(cost)) {
      return NextResponse.json({ error: "Coin cost must be a whole positive number (at least 1)." }, { status: 400 });
    }
    updates.coinCost = cost;
  }

  if (quantity !== undefined) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      return NextResponse.json({ error: "Quantity must be a whole number (0 or more)." }, { status: 400 });
    }
    updates.quantity = qty;
  }

  if (status !== undefined) {
    if (status !== "active" && status !== "inactive") {
      return NextResponse.json({ error: "Status must be either 'active' or 'inactive'." }, { status: 400 });
    }
    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields provided to update." }, { status: 400 });
  }

  try {
    // Strictly scoped to the authenticated business's ID
    const updated = await Reward.findOneAndUpdate(
      {
        _id: id,
        businessId: business._id,
        status: { $ne: "deleted" },
      },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Reward not found or you do not have permission to manage this reward." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Reward updated successfully.",
      reward: {
        id: String(updated._id),
        title: updated.title,
        description: updated.description ?? "",
        coinCost: updated.coinCost,
        quantity: updated.quantity,
        status: updated.status,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to update reward:", error);
    return NextResponse.json({ error: "Unable to update reward." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, props: RouteProps) {
  const auth = await getAuthenticatedBusiness();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { business } = auth;
  const { id } = await props.params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid reward ID." }, { status: 400 });
  }

  try {
    // Soft deletion: marks status as deleted to maintain historical audit trail and redemption links
    const deleted = await Reward.findOneAndUpdate(
      {
        _id: id,
        businessId: business._id,
        status: { $ne: "deleted" },
      },
      { $set: { status: "deleted" } },
      { new: true }
    );

    if (!deleted) {
      return NextResponse.json(
        { error: "Reward not found or you do not have permission to delete this reward." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Reward deleted successfully.",
      rewardId: String(deleted._id),
    });
  } catch (error) {
    console.error("Failed to delete reward:", error);
    return NextResponse.json({ error: "Unable to delete reward." }, { status: 500 });
  }
}
