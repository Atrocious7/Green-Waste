import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getAuthenticatedCitizen } from "@/lib/citizenAuth";
import { classifyWasteImage, OpenRouterConfigurationError, WasteClassificationCapacityError, } from "@/lib/ai";
import cloudinary from "@/lib/cloudinary";
import { COIN_MAPPING, DEFAULT_CONFIDENCE_THRESHOLD } from "@/lib/constants";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";
import User from "@/models/User";
import WasteSubmission from "@/models/WasteSubmission";
function uploadImage(buffer) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({
            folder: "greensort/waste-submissions",
            resource_type: "image",
        }, (error, result) => {
            if (error) {
                reject(error);
            }
            else if (!result) {
                reject(new Error("Cloudinary returned no upload result."));
            }
            else {
                resolve(result);
            }
        });
        uploadStream.end(buffer);
    });
}
async function deleteUploadedImage(publicId) {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" }).catch(() => undefined);
}
function isDuplicateKeyError(error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
function isTransactionUnsupportedError(error) {
    if (typeof error !== "object" || error === null)
        return false;
    const code = "code" in error ? error.code : undefined;
    const message = "message" in error && typeof error.message === "string" ? error.message : "";
    return code === 20 || message.includes("Transaction numbers are only allowed on a replica set member or mongos");
}
function existingSubmissionResponse(submissionId) {
    return NextResponse.json({ message: "This submission was already received.", submissionId }, { status: 200 });
}
// Looks up the id of a submission this citizen already saved under the same request key.
// Returns null when there is none.
async function findExistingSubmissionId(userId, idempotencyKey) {
    const existingSubmission = await WasteSubmission.findOne({ userId, idempotencyKey })
        .select("_id")
        .lean();
    return existingSubmission?._id ?? null;
}
export async function POST(request) {
    const auth = await getAuthenticatedCitizen("Only citizens can submit waste.");
    if (auth.errorResponse)
        return auth.errorResponse;
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
        return NextResponse.json({ error: "A valid submission request key is required." }, { status: 400 });
    }
    let file;
    try {
        const formData = await request.formData();
        file = formData.get("file");
    }
    catch {
        return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
    }
    if (!(file instanceof File)) {
        return NextResponse.json({ error: "Please upload an image file." }, { status: 400 });
    }
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const fileName = file.name.toLowerCase();
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const hasValidMime = allowedMimeTypes.includes(file.type);
    const hasValidExtension = allowedExtensions.some((extension) => fileName.endsWith(extension));
    if (!hasValidMime || !hasValidExtension || file.size === 0) {
        return NextResponse.json({ error: "Please upload a valid image file." }, { status: 400 });
    }
    const maxUploadSizeBytes = Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? 5 * 1024 * 1024);
    if (!Number.isFinite(maxUploadSizeBytes) || maxUploadSizeBytes <= 0) {
        return NextResponse.json({ error: "Image upload is not configured correctly." }, { status: 500 });
    }
    if (file.size > maxUploadSizeBytes) {
        return NextResponse.json({ error: `Image must be ${maxUploadSizeBytes / (1024 * 1024)} MB or smaller.` }, { status: 413 });
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET) {
        return NextResponse.json({ error: "Image storage is not configured." }, { status: 503 });
    }
    let buffer;
    try {
        buffer = Buffer.from(await file.arrayBuffer());
        await dbConnect();
        await Promise.all([WasteSubmission.init(), Transaction.init()]);
        const existingSubmissionId = await findExistingSubmissionId(auth.user.id, idempotencyKey);
        if (existingSubmissionId) {
            return existingSubmissionResponse(existingSubmissionId);
        }
    }
    catch {
        console.error("Waste submission preparation failed.");
        return NextResponse.json({ error: "Unable to prepare your submission right now." }, { status: 500 });
    }
    let uploadedImage;
    try {
        uploadedImage = await uploadImage(buffer);
    }
    catch {
        console.error("Cloudinary image upload failed.");
        return NextResponse.json({ error: "Image storage is temporarily unavailable. Please try again." }, { status: 502 });
    }
    if (!uploadedImage.secure_url) {
        if (uploadedImage.public_id) {
            await deleteUploadedImage(uploadedImage.public_id);
        }
        return NextResponse.json({ error: "Image storage did not return a secure image URL." }, { status: 502 });
    }
    let classification;
    try {
        classification = await classifyWasteImage(uploadedImage.secure_url);
    }
    catch (error) {
        await deleteUploadedImage(uploadedImage.public_id);
        if (error instanceof OpenRouterConfigurationError) {
            return NextResponse.json({ error: "AI image classification is not configured." }, { status: 503 });
        }
        if (error instanceof WasteClassificationCapacityError) {
            return NextResponse.json({
                error: error.message,
            }, { status: 503 });
        }
        console.error("OpenRouter waste classification failed; see the preceding OpenRouter classification diagnostic.");
        if (process.env.NODE_ENV === "development") {
            return NextResponse.json({
                error: "OpenRouter classification failed",
                details: "See server terminal for OpenRouter status and error.",
            }, { status: 502 });
        }
        return NextResponse.json({ error: "We could not classify this image right now. Please try again." }, { status: 502 });
    }
    if (!Number.isFinite(DEFAULT_CONFIDENCE_THRESHOLD) ||
        DEFAULT_CONFIDENCE_THRESHOLD < 0 ||
        DEFAULT_CONFIDENCE_THRESHOLD > 100) {
        await deleteUploadedImage(uploadedImage.public_id);
        console.error("Waste classification confidence threshold is invalid.");
        return NextResponse.json({ error: "Waste classification is not configured correctly." }, { status: 500 });
    }
    const approved = classification.confidence >= DEFAULT_CONFIDENCE_THRESHOLD;
    const coinsAwarded = approved ? COIN_MAPPING[classification.category] : 0;
    if (!Number.isFinite(coinsAwarded) || coinsAwarded < 0) {
        await deleteUploadedImage(uploadedImage.public_id);
        console.error("Waste classification coin mapping is invalid.");
        return NextResponse.json({ error: "Waste classification is not configured correctly." }, { status: 500 });
    }
    const submissionFields = {
        userId: auth.user.id,
        idempotencyKey,
        imageUrl: uploadedImage.secure_url,
        predictedLabels: [],
        category: classification.category,
        confidence: classification.confidence,
        coinsAwarded,
        status: approved ? "approved" : "needs_review",
    };
    if (!approved || coinsAwarded === 0) {
        try {
            const createdSubmission = await WasteSubmission.create(submissionFields);
            return NextResponse.json({ message: "Waste submission created successfully.", submissionId: createdSubmission._id }, { status: 201 });
        }
        catch (error) {
            await deleteUploadedImage(uploadedImage.public_id);
            if (isDuplicateKeyError(error)) {
                const existingSubmissionId = await findExistingSubmissionId(auth.user.id, idempotencyKey);
                if (existingSubmissionId)
                    return existingSubmissionResponse(existingSubmissionId);
            }
            console.error("Waste submission database save failed.");
            return NextResponse.json({ error: "Unable to save your submission right now." }, { status: 500 });
        }
    }
    let sessionDb;
    let submissionId;
    try {
        sessionDb = await mongoose.startSession();
        await sessionDb.withTransaction(async () => {
            const [createdSubmission] = await WasteSubmission.create([submissionFields], { session: sessionDb });
            const submission = await WasteSubmission.findOne({
                _id: createdSubmission._id,
                userId: auth.user.id,
                status: "approved",
                coinsAwarded: { $gt: 0 },
                rewardProcessed: { $ne: true },
            }).session(sessionDb);
            if (!submission) {
                throw new Error("New submission was not eligible for reward processing.");
            }
            const updatedUser = await User.findOneAndUpdate({ _id: submission.userId, role: "citizen", greenCoins: { $gte: 0 } }, { $inc: { greenCoins: submission.coinsAwarded } }, { new: true, runValidators: true, session: sessionDb });
            if (!updatedUser) {
                throw new Error("Citizen balance could not be updated.");
            }
            await Transaction.create([
                {
                    userId: submission.userId,
                    type: "award",
                    amount: submission.coinsAwarded,
                    note: `Waste segregation reward - ${submission.category}`,
                    referenceId: submission._id,
                    balanceAfter: updatedUser.greenCoins,
                },
            ], { session: sessionDb });
            submission.rewardProcessed = true;
            await submission.save({ session: sessionDb });
            submissionId = submission._id;
        });
        return NextResponse.json({ message: "Waste submission created and Green Coins awarded.", submissionId }, { status: 201 });
    }
    catch (error) {
        await deleteUploadedImage(uploadedImage.public_id);
        if (isDuplicateKeyError(error)) {
            const existingSubmissionId = await findExistingSubmissionId(auth.user.id, idempotencyKey);
            if (existingSubmissionId)
                return existingSubmissionResponse(existingSubmissionId);
            return NextResponse.json({ error: "This upload is already being processed. Retry the same request shortly." }, { status: 409 });
        }
        if (isTransactionUnsupportedError(error)) {
            console.error("Green Coin awards require MongoDB replica set transaction support.");
            return NextResponse.json({ error: "Coin rewards are temporarily unavailable because database transactions are not enabled." }, { status: 503 });
        }
        console.error("Atomic Green Coin award transaction failed.");
        return NextResponse.json({ error: "Unable to apply the Green Coin reward right now." }, { status: 500 });
    }
    finally {
        await sessionDb?.endSession();
    }
}
