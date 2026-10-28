import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/db";
import Business from "@/models/Business";
import Reward from "@/models/Reward";
export async function PATCH(request, props) {
    const auth = await getAuthenticatedAdmin();
    if (auth.errorResponse)
        return auth.errorResponse;
    const { id } = await props.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid reward ID." }, { status: 400 });
    }
    let body;
    try {
        body = await request.json();
    }
    catch {
        return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }
    const status = body?.status;
    if (status !== "active" && status !== "inactive") {
        return NextResponse.json({ error: "Status must be 'active' or 'inactive'." }, { status: 400 });
    }
    try {
        await dbConnect();
        void Business;
        const reward = await Reward.findById(id);
        if (!reward)
            return NextResponse.json({ error: "Reward not found." }, { status: 404 });
        if (reward.status === "deleted") {
            return NextResponse.json({ error: "Deleted rewards cannot be reactivated." }, { status: 409 });
        }
        reward.status = status;
        await reward.save();
        return NextResponse.json({ message: "Reward status updated.", status: reward.status });
    }
    catch (error) {
        console.error("Failed to update admin reward:", error);
        return NextResponse.json({ error: "Unable to update reward." }, { status: 500 });
    }
}
export async function DELETE(_request, props) {
    const auth = await getAuthenticatedAdmin();
    if (auth.errorResponse)
        return auth.errorResponse;
    const { id } = await props.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid reward ID." }, { status: 400 });
    }
    try {
        await dbConnect();
        const reward = await Reward.findByIdAndUpdate(id, { $set: { status: "deleted" } }, { new: true, runValidators: true });
        if (!reward)
            return NextResponse.json({ error: "Reward not found." }, { status: 404 });
        return NextResponse.json({ message: "Reward soft-deleted successfully.", status: reward.status });
    }
    catch (error) {
        console.error("Failed to delete admin reward:", error);
        return NextResponse.json({ error: "Unable to delete reward." }, { status: 500 });
    }
}
