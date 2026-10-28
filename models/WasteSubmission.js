import mongoose, { Schema } from "mongoose";
const WasteSubmissionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    imageUrl: { type: String, required: false },
    category: {
        type: String,
        enum: ["pending", "Plastic", "Paper", "Glass", "Metal", "Organic", "E-waste", "Non-recyclable"],
        default: "pending",
        required: false,
    },
    predictedLabels: {
        type: [
            {
                label: String,
                score: Number,
            },
        ],
        default: [],
    },
    confidence: { type: Number, default: 0 },
    coinsAwarded: { type: Number, default: 0 },
    rewardProcessed: { type: Boolean, default: false },
    idempotencyKey: { type: String, immutable: true },
    status: { type: String, enum: ["pending", "approved", "awarded", "needs_review", "rejected"], default: "pending" },
    location: {
        lat: Number,
        lng: Number,
    },
}, { timestamps: true });
WasteSubmissionSchema.index({ userId: 1, idempotencyKey: 1 }, {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
    name: "unique_user_waste_submission_idempotency_key",
});
export default mongoose.models.WasteSubmission || mongoose.model("WasteSubmission", WasteSubmissionSchema);
