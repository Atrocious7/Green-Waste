import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/db";
import { COIN_MAPPING, DEFAULT_CONFIDENCE_THRESHOLD } from "@/lib/constants";
import Transaction from "@/models/Transaction";
import User from "@/models/User";
import WasteSubmission from "@/models/WasteSubmission";
export async function PATCH(req, { params }) {
    const auth = await getAuthenticatedAdmin();
    if (auth.errorResponse) {
        return auth.errorResponse;
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid submission ID format." }, { status: 400 });
    }
    try {
        let body;
        try {
            body = await req.json();
        }
        catch {
            return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
        }
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
            return NextResponse.json({ error: "Request payload must be a JSON object." }, { status: 400 });
        }
        const { action, moderationNote } = body;
        if (typeof action !== "string" || !["approve", "reject"].includes(action)) {
            return NextResponse.json({ error: "Invalid action. Must be 'approve' or 'reject'." }, { status: 400 });
        }
        if (moderationNote !== undefined && typeof moderationNote !== "string") {
            return NextResponse.json({ error: "Moderation note must be a string." }, { status: 400 });
        }
        if (action === "reject" && (!moderationNote || !moderationNote.trim())) {
            return NextResponse.json({ error: "A rejection reason is required when rejecting a submission." }, { status: 400 });
        }
        await dbConnect();
        // Start a MongoDB transaction for atomic moderation
        const session = await mongoose.startSession();
        let submissionId;
        try {
            await session.withTransaction(async () => {
                // Find the submission with a lock for update
                const submission = await WasteSubmission.findById(id).session(session);
                if (!submission) {
                    throw new Error("Submission not found.");
                }
                // Check current status - can only moderate submissions that need review
                const currentStatus = submission.status;
                const alreadyAwarded = submission.rewardProcessed === true;
                if (currentStatus === "approved" || currentStatus === "awarded") {
                    if (alreadyAwarded) {
                        throw new Error("This submission has already been approved and coins have been awarded. Cannot modify.");
                    }
                    throw new Error("This submission has already been approved.");
                }
                if (currentStatus === "rejected") {
                    throw new Error("This submission has already been rejected.");
                }
                if (action === "approve") {
                    // Validate that the submission is eligible for approval
                    const category = submission.category;
                    const confidence = submission.confidence ?? 0;
                    if (!category || category === "pending") {
                        throw new Error("Cannot approve a submission without a valid category.");
                    }
                    if (confidence < DEFAULT_CONFIDENCE_THRESHOLD) {
                        throw new Error(`Cannot approve: confidence (${confidence}%) is below the required threshold (${DEFAULT_CONFIDENCE_THRESHOLD}%).`);
                    }
                    const coinsToAward = COIN_MAPPING[category] ?? 0;
                    if (coinsToAward <= 0) {
                        throw new Error("Cannot approve: no coin reward configured for this category.");
                    }
                    // Update submission status
                    submission.status = "approved";
                    submission.coinsAwarded = coinsToAward;
                    if (moderationNote?.trim()) {
                        submission.moderationNote = moderationNote.trim();
                    }
                    await submission.save({ session });
                    // Award coins atomically within the transaction
                    const updatedUser = await User.findOneAndUpdate({ _id: submission.userId, role: "citizen", greenCoins: { $gte: 0 } }, { $inc: { greenCoins: coinsToAward } }, { new: true, runValidators: true, session });
                    if (!updatedUser) {
                        throw new Error("Citizen user not found or ineligible for coin award.");
                    }
                    // Create transaction record
                    await Transaction.create([
                        {
                            userId: submission.userId,
                            type: "award",
                            amount: coinsToAward,
                            note: `Waste segregation reward - ${category} ${moderationNote ? `(moderated: ${moderationNote})` : ""}`,
                            referenceId: submission._id,
                            balanceAfter: updatedUser.greenCoins,
                        },
                    ], { session });
                    // Mark reward as processed
                    submission.rewardProcessed = true;
                    await submission.save({ session });
                    submissionId = submission._id;
                }
                else if (action === "reject") {
                    // Reject the submission
                    submission.status = "rejected";
                    submission.coinsAwarded = 0;
                    submission.moderationNote = moderationNote?.trim() ?? "";
                    await submission.save({ session });
                    submissionId = submission._id;
                }
            });
            return NextResponse.json({
                message: `Submission ${action}d successfully.`,
                submissionId: String(submissionId),
            });
        }
        catch (error) {
            if (error.message.includes("already")) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            if (error.message.includes("threshold") || error.message.includes("coin reward") || error.message.includes("category")) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            if (error.message.includes("not found")) {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }
            throw error;
        }
        finally {
            await session.endSession();
        }
    }
    catch (error) {
        console.error("Failed to moderate submission:", error);
        return NextResponse.json({ error: "Internal server error moderating submission." }, { status: 500 });
    }
}
