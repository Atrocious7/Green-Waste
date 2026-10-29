const WASTE_CATEGORIES = [
    "Plastic",
    "Paper",
    "Glass",
    "Metal",
    "Organic",
    "E-waste",
    "Non-recyclable",
];
export class OpenRouterConfigurationError extends Error {
    constructor() {
        super("Missing OPENROUTER_API_KEY; configure it in the server environment.");
        this.name = "OpenRouterConfigurationError";
    }
}
export class WasteClassificationCapacityError extends Error {
    constructor(message = "Free AI classification services are temporarily busy. Please wait a moment and retry.") {
        super(message);
        this.name = "WasteClassificationCapacityError";
    }
}
const CLASSIFICATION_PROMPT = `You are a waste classification assistant for a waste segregation application.

Analyze the supplied image and classify the MAIN visible waste item.

Choose exactly one category:
Plastic, Paper, Glass, Metal, Organic, E-waste, Non-recyclable.

Return exactly one JSON object with a category string and numeric confidence from 0 to 100, such as:
{"category":"Plastic","confidence":95}

Do not add explanations or markdown.

If the image is ambiguous, choose the most likely category and lower the confidence.

Examples:
- plastic bottle → Plastic
- newspaper/cardboard → Paper
- glass bottle/jar → Glass
- aluminum/metal can → Metal
- food scraps/vegetable waste → Organic
- electronic device/circuit/charger → E-waste
- contaminated/mixed/unclassifiable waste → Non-recyclable

Do not calculate or mention Green Coins.`;
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
// Verified free vision models from distinct providers (AtlasCloud, Nvidia, Google AI Studio)
const VERIFIED_FREE_VISION_MODELS = [
    "dots-studio/dots-3-note-preview:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "google/gemma-4-26b-a4b-it:free",
];
const MODEL_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown for models that return capacity errors
const modelCooldownMap = new Map();

// Return the primary model and fallback models in order of priority, skipping any that are currently on cooldown.
function getPrioritizedModels() {
    const now = Date.now();
    const healthy = [];
    const coolingDown = [];
    for (const model of VERIFIED_FREE_VISION_MODELS) {
        const cooldownUntil = modelCooldownMap.get(model) ?? 0;
        if (cooldownUntil > now) {
            coolingDown.push(model);
        }
        else {
            healthy.push(model);
        }
    }
    const prioritized = [...healthy, ...coolingDown];
    return {
        primary: prioritized[0] ?? VERIFIED_FREE_VISION_MODELS[0],
        fallbacks: prioritized.slice(1),
    };
}

// Mark a model as on cooldown for a specified duration (default 1 minute).
function markModelCooldown(model, durationMs = MODEL_COOLDOWN_MS) {
    modelCooldownMap.set(model, Date.now() + durationMs);
}

// Set of HTTP status codes that indicate a temporary capacity or rate limit issue, which may be retried.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

// Utility functions for parsing and sanitizing OpenRouter responses
function getErrorMessage(responseBody) {
    try {
        const parsed = JSON.parse(responseBody);
        if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
            const error = parsed.error;
            if (typeof error === "string") {
                return error;
            }
            if (typeof error === "object" &&
                error !== null &&
                "message" in error &&
                typeof error.message === "string") {
                return error.message;
            }
        }
    }
    catch { }
    return responseBody;
}
function isModelUnavailable404(responseBody) {
    return /\b(?:no endpoints? (?:were )?(?:found|available)|unknown model|model (?:id )?(?:is )?(?:not found|unavailable|not available)|(?:requested )?(?:free )?endpoint (?:for (?:the )?requested model )?(?:is )?(?:unavailable|not available|not found))\b/i.test(getErrorMessage(responseBody));
}
function isAgenticHarnessRestriction403(responseBody) {
    return /\bonly available on (?:an? )?agentic harness(?:es)?\b/i.test(getErrorMessage(responseBody));
}
function extractText(value) {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value)) {
        const textParts = value
            .map(extractText)
            .filter((part) => typeof part === "string" && part.length > 0);
        return textParts.length > 0 ? textParts.join("\n") : undefined;
    }
    if (typeof value === "object" && value !== null) {
        if ("text" in value && typeof value.text === "string") {
            return value.text;
        }
        if ("content" in value) {
            return extractText(value.content);
        }
    }
    return undefined;
}
// OpenRouter normalises every /chat/completions response to the OpenAI Chat schema:
// choices[0].message.content is a string, or an array of parts such as
// [{ type: "text", text: "..." }]. choices[0].text is kept as a legacy fallback.
function getClassificationText(result) {
    const choice = result.choices?.[0];
    const candidates = [
        extractText(choice?.message?.content),
        extractText(choice?.message?.text),
        extractText(choice?.text),
    ];
    return candidates.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
}
function stripMarkdownCodeFences(value) {
    return value
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
}
function findSingleJsonObject(value) {
    const objects = [];
    let objectStart = -1;
    let depth = 0;
    let insideString = false;
    let escaped = false;
    for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        if (insideString) {
            if (escaped) {
                escaped = false;
            }
            else if (character === "\\") {
                escaped = true;
            }
            else if (character === '"') {
                insideString = false;
            }
            continue;
        }
        if (character === '"') {
            insideString = true;
        }
        else if (character === "{") {
            if (depth === 0) {
                objectStart = index;
            }
            depth += 1;
        }
        else if (character === "}" && depth > 0) {
            depth -= 1;
            if (depth === 0) {
                objects.push(value.slice(objectStart, index + 1));
            }
        }
    }
    if (objects.length !== 1) {
        throw new Error("Expected exactly one JSON object.");
    }
    return objects[0];
}
function parseClassificationJson(value) {
    const text = stripMarkdownCodeFences(value);
    try {
        return JSON.parse(text);
    }
    catch {
        return JSON.parse(findSingleJsonObject(text));
    }
}
function sanitizeDiagnosticText(value, apiKey) {
    return value
        .replaceAll(apiKey, "[REDACTED_API_KEY]")
        .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/gi, "$1[REDACTED]")
        .replace(/https?:\/\/res\.cloudinary\.com\/[^\s"']+/gi, "[CLOUDINARY_URL_REDACTED]")
        .slice(0, 3000);
}
// Bounded, sanitised field names from choices[0].message so a missing-content
// diagnostic can show what the model returned without logging its contents.
function getSafeChoiceMessageKeys(result, apiKey) {
    const message = result?.choices?.[0]?.message;
    if (typeof message !== "object" || message === null || Array.isArray(message)) {
        return [];
    }
    return Object.keys(message)
        .slice(0, 10)
        .map((key) => sanitizeDiagnosticText(key, apiKey).slice(0, 60));
}
function logOpenRouterFailure(apiKey, model, details) {
    console.error("OpenRouter classification diagnostic", {
        model,
        apiKeyPresent: Boolean(apiKey),
        request: {
            method: "POST",
            endpoint: OPENROUTER_ENDPOINT,
            messageType: "multimodal",
            includesImageUrl: true,
        },
        ...details,
        ...(details.responseBody
            ? { responseBody: sanitizeDiagnosticText(details.responseBody, apiKey) }
            : {}),
        ...(details.error ? { error: sanitizeDiagnosticText(details.error, apiKey) } : {}),
    });
}
export async function classifyWasteImage(imageUrl) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error("OpenRouter classification diagnostic", {
            stage: "missing_api_key",
            model: VERIFIED_FREE_VISION_MODELS[0],
            modelsAvailable: [...VERIFIED_FREE_VISION_MODELS],
            apiKeyPresent: false,
            request: {
                method: "POST",
                endpoint: OPENROUTER_ENDPOINT,
                messageType: "multimodal",
                includesImageUrl: true,
            },
        });
        throw new OpenRouterConfigurationError();
    }
    const { primary: primaryModel, fallbacks: fallbackModels } = getPrioritizedModels();
    let attemptResponse;
    try {
        attemptResponse = await fetch(OPENROUTER_ENDPOINT, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: primaryModel,
                models: fallbackModels,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: CLASSIFICATION_PROMPT },
                            { type: "image_url", image_url: { url: imageUrl } },
                        ],
                    },
                ],
            }),
        });
    }
    catch (error) {
        logOpenRouterFailure(apiKey, primaryModel, {
            stage: "request_failed_before_response",
            error: error instanceof Error ? `${error.name}: ${error.message}` : "Unknown fetch error",
        });
        throw new Error("OpenRouter classification request failed.");
    }
    // Shared metadata for every diagnostic logged after a response arrives.
    const responseMeta = {
        status: attemptResponse.status,
        statusText: attemptResponse.statusText,
        contentType: attemptResponse.headers.get("content-type"),
    };
    if (!attemptResponse.ok) {
        let responseBody;
        try {
            responseBody = await attemptResponse.text();
        }
        catch {
            responseBody = "<unable to read error response body>";
        }
        const isCapacityOrRateLimit = RETRYABLE_STATUSES.has(attemptResponse.status);
        if (isCapacityOrRateLimit) {
            // Mark attempted models on cooldown so subsequent calls don't redundantly stall
            for (const model of [primaryModel, ...fallbackModels]) {
                markModelCooldown(model, 45 * 1000);
            }
        }
        const modelUnavailable = attemptResponse.status === 404 && isModelUnavailable404(responseBody);
        const agenticHarnessRestriction = attemptResponse.status === 403 && isAgenticHarnessRestriction403(responseBody);
        logOpenRouterFailure(apiKey, primaryModel, {
            stage: "http_error_response",
            ...responseMeta,
            responseBody,
            failureReason: isCapacityOrRateLimit
                ? "temporary_provider_error"
                : modelUnavailable
                    ? "model_unavailable"
                    : agenticHarnessRestriction
                        ? "agentic_harness_restriction"
                        : "non_retryable_http_error",
        });
        if (isCapacityOrRateLimit) {
            throw new WasteClassificationCapacityError("Free AI classification models are currently experiencing high traffic or capacity limits. Please wait a moment and try submitting again.");
        }
        throw new Error(`OpenRouter classification request failed with status ${attemptResponse.status}.`);
    }
    let result;
    try {
        result = (await attemptResponse.json());
    }
    catch {
        logOpenRouterFailure(apiKey, primaryModel, {
            stage: "invalid_success_response_json",
            ...responseMeta,
        });
        throw new Error("OpenRouter returned an invalid response.");
    }
    // OpenRouter reports which model actually answered. It may be one of the
    // fallbacks, so record that model and cool down the ones it bypassed.
    const prioritizedModels = [primaryModel, ...fallbackModels];
    const answeredModel = typeof result?.model === "string" && result.model ? result.model : primaryModel;
    const winningIndex = prioritizedModels.indexOf(answeredModel);
    if (winningIndex > 0) {
        for (let index = 0; index < winningIndex; index += 1) {
            markModelCooldown(prioritizedModels[index]);
        }
    }
    const content = getClassificationText(result);
    if (content === undefined) {
        logOpenRouterFailure(apiKey, answeredModel, {
            stage: "missing_classification_content",
            ...responseMeta,
            choiceMessageKeys: getSafeChoiceMessageKeys(result, apiKey),
        });
        throw new Error("OpenRouter returned no classification content.");
    }
    let parsed;
    try {
        parsed = parseClassificationJson(content);
    }
    catch {
        logOpenRouterFailure(apiKey, answeredModel, {
            stage: "invalid_classification_json",
            ...responseMeta,
            responseLength: content.length,
        });
        throw new Error("OpenRouter returned invalid classification JSON.");
    }
    if (typeof parsed !== "object" || parsed === null || !("category" in parsed) || !("confidence" in parsed)) {
        logOpenRouterFailure(apiKey, answeredModel, {
            stage: "incomplete_classification_data",
            ...responseMeta,
        });
        throw new Error("OpenRouter returned incomplete classification data.");
    }
    if (!WASTE_CATEGORIES.includes(parsed.category)) {
        logOpenRouterFailure(apiKey, answeredModel, {
            stage: "unsupported_classification_category",
            ...responseMeta,
        });
        throw new Error("OpenRouter returned an unsupported waste category.");
    }
    if (typeof parsed.confidence !== "number" ||
        !Number.isFinite(parsed.confidence) ||
        parsed.confidence < 0 ||
        parsed.confidence > 100) {
        logOpenRouterFailure(apiKey, answeredModel, {
            stage: "invalid_classification_confidence",
            ...responseMeta,
        });
        throw new Error("OpenRouter returned an invalid confidence value.");
    }
    return {
        category: parsed.category,
        confidence: parsed.confidence,
    };
}
