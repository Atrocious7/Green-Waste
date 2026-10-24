import type { WasteCategory } from "@/models/WasteSubmission";

const WASTE_CATEGORIES = [
  "Plastic",
  "Paper",
  "Glass",
  "Metal",
  "Organic",
  "E-waste",
  "Non-recyclable",
] as const satisfies readonly Exclude<WasteCategory, "pending">[];

export type ClassifiedWasteCategory = (typeof WASTE_CATEGORIES)[number];

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

interface OpenRouterResponse {
  model?: string;
  choices?: Array<{
    text?: unknown;
    message?: {
      content?: unknown;
      text?: unknown;
    };
  }>;
  output_text?: unknown;
  output?: unknown;
}

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Verified free vision models from distinct providers (AtlasCloud, Nvidia, Google AI Studio)
const VERIFIED_FREE_VISION_MODELS = [
  "dots-studio/dots-3-note-preview:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-26b-a4b-it:free",
] as const;

const MODEL_COOLDOWN_MS = 60 * 1000;
const modelCooldownMap = new Map<string, number>();

function getPrioritizedModels(): { primary: string; fallbacks: string[] } {
  const now = Date.now();
  const healthy: string[] = [];
  const coolingDown: string[] = [];

  for (const model of VERIFIED_FREE_VISION_MODELS) {
    const cooldownUntil = modelCooldownMap.get(model) ?? 0;
    if (cooldownUntil > now) {
      coolingDown.push(model);
    } else {
      healthy.push(model);
    }
  }

  const prioritized = [...healthy, ...coolingDown];
  return {
    primary: prioritized[0] ?? VERIFIED_FREE_VISION_MODELS[0],
    fallbacks: prioritized.slice(1),
  };
}

function markModelCooldown(model: string, durationMs = MODEL_COOLDOWN_MS) {
  modelCooldownMap.set(model, Date.now() + durationMs);
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function getErrorMessage(responseBody: string): string {
  try {
    const parsed: unknown = JSON.parse(responseBody);
    if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
      const error = parsed.error;
      if (typeof error === "string") {
        return error;
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        return error.message;
      }
    }
  } catch {}

  return responseBody;
}

function isModelUnavailable404(responseBody: string): boolean {
  return /\b(?:no endpoints? (?:were )?(?:found|available)|unknown model|model (?:id )?(?:is )?(?:not found|unavailable|not available)|(?:requested )?(?:free )?endpoint (?:for (?:the )?requested model )?(?:is )?(?:unavailable|not available|not found))\b/i.test(
    getErrorMessage(responseBody)
  );
}

function isAgenticHarnessRestriction403(responseBody: string): boolean {
  return /\bonly available on (?:an? )?agentic harness(?:es)?\b/i.test(
    getErrorMessage(responseBody)
  );
}

function extractText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const textParts = value
      .map(extractText)
      .filter((part): part is string => typeof part === "string" && part.length > 0);
    return textParts.length > 0 ? textParts.join("\n") : undefined;
  }

  if (typeof value === "object" && value !== null) {
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("content" in value) {
      return extractText(value.content);
    }
    if ("output_text" in value) {
      return extractText(value.output_text);
    }
  }

  return undefined;
}

function getClassificationText(result: OpenRouterResponse): string | undefined {
  const choice = result.choices?.[0];
  const candidates = [
    extractText(choice?.message?.content),
    extractText(choice?.message?.text),
    extractText(choice?.text),
    extractText(result.output_text),
    extractText(result.output),
  ];

  return candidates.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
}

function stripMarkdownCodeFences(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function findSingleJsonObject(value: string): string {
  const objects: string[] = [];
  let objectStart = -1;
  let depth = 0;
  let insideString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (insideString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        insideString = false;
      }
      continue;
    }

    if (character === '"') {
      insideString = true;
    } else if (character === "{") {
      if (depth === 0) {
        objectStart = index;
      }
      depth += 1;
    } else if (character === "}" && depth > 0) {
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

function parseClassificationJson(value: string): unknown {
  const text = stripMarkdownCodeFences(value);

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return JSON.parse(findSingleJsonObject(text)) as unknown;
  }
}

function sanitizeDiagnosticText(value: string, apiKey: string): string {
  return value
    .replaceAll(apiKey, "[REDACTED_API_KEY]")
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/gi, "$1[REDACTED]")
    .replace(/https?:\/\/res\.cloudinary\.com\/[^\s"']+/gi, "[CLOUDINARY_URL_REDACTED]")
    .slice(0, 3000);
}

function getObjectRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getValueType(value: unknown): string {
  return value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
}

function getValueLength(value: unknown): number | undefined {
  if (typeof value === "string" || Array.isArray(value)) {
    return value.length;
  }
  return undefined;
}

function sanitizeDiagnosticPreview(
  value: string,
  apiKey: string,
  maxLength: number
): string {
  return sanitizeDiagnosticText(value, apiKey)
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL_REDACTED]")
    .replace(/(["']?(?:api[_-]?key|authorization|access[_-]?token|token|secret|password|prompt|image(?:_url)?|url)["']?\s*[:=]\s*)["']?[^,"'}\]\s]+/gi, "$1[SECRET_OR_URL_REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL_REDACTED]")
    .replace(/\b(?:\+?\d[\d(). -]{7,}\d)\b/g, "[PHONE_REDACTED]")
    .replace(/(["']?(?:name|email|phone|address|user(?:_id)?|account(?:_id)?)["']?\s*[:=]\s*)["']?[^,"'}\n]+/gi, "$1[USER_DATA_REDACTED]")
    .replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g, "[PERSON_REDACTED]")
    .slice(0, maxLength);
}

function sanitizeResponsePreview(value: string, apiKey: string): string {
  return sanitizeDiagnosticPreview(value, apiKey, 200);
}

function summarizeErrorField(value: unknown, apiKey: string, maxLength = 200): unknown {
  if (typeof value === "string") {
    return sanitizeDiagnosticPreview(value, apiKey, maxLength);
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  const record = getObjectRecord(value);
  if (record) {
    return { type: "object", keys: Object.keys(record) };
  }
  if (Array.isArray(value)) {
    return { type: "array", length: value.length };
  }
  return value === undefined ? undefined : { type: getValueType(value) };
}

function summarizeNemotronError(value: unknown, apiKey: string) {
  const error = getObjectRecord(value);
  const metadata = getObjectRecord(error?.metadata);
  const metadataEntries = metadata
    ? Object.entries(metadata)
        .filter(([key]) =>
          !["provider_name", "provider_error_code", "raw"].includes(key) &&
          !/(?:key|auth|token|secret|password|prompt|image|url|user|email|phone|address)/i.test(key)
        )
        .slice(0, 10)
        .map(([key, fieldValue]) => ({
          key,
          value: summarizeErrorField(fieldValue, apiKey),
        }))
    : [];

  return {
    present: value !== undefined,
    type: getValueType(value),
    keys: error ? Object.keys(error) : undefined,
    message: summarizeErrorField(error?.message, apiKey, 500),
    code: summarizeErrorField(error?.code, apiKey),
    metadata: {
      present: error ? Object.hasOwn(error, "metadata") : false,
      type: getValueType(error?.metadata),
      keys: metadata ? Object.keys(metadata) : undefined,
      provider_name: summarizeErrorField(metadata?.provider_name, apiKey),
      provider_error_code: summarizeErrorField(metadata?.provider_error_code, apiKey),
      raw:
        typeof metadata?.raw === "string"
          ? sanitizeDiagnosticPreview(metadata.raw, apiKey, 500)
          : summarizeErrorField(metadata?.raw, apiKey),
      other: metadataEntries,
    },
  };
}

function summarizeContentArrayItem(value: unknown, apiKey: string) {
  const record = getObjectRecord(value);
  const textFields =
    typeof value === "string"
      ? [{
          key: "(item)",
          length: value.length,
          preview: sanitizeResponsePreview(value, apiKey),
        }]
      : record
        ? Object.entries(record)
        .filter(([key, fieldValue]) => /text/i.test(key) && typeof fieldValue === "string")
        .map(([key, fieldValue]) => ({
          key,
          length: (fieldValue as string).length,
          preview: sanitizeResponsePreview(fieldValue as string, apiKey),
        }))
        : [];

  return {
    type: getValueType(value),
    keys: record ? Object.keys(record) : undefined,
    textFields,
  };
}

function summarizeToolCalls(value: unknown, apiKey: string) {
  const calls = Array.isArray(value) ? value : [];

  return {
    present: value !== undefined && value !== null,
    type: getValueType(value),
    count: Array.isArray(value) ? value.length : undefined,
    calls: calls.slice(0, 5).map((call) => {
      const callRecord = getObjectRecord(call);
      const functionRecord = getObjectRecord(callRecord?.function);
      const args = functionRecord?.arguments;

      return {
        keys: callRecord ? Object.keys(callRecord) : undefined,
        type: callRecord?.type,
        function: functionRecord
          ? {
              keys: Object.keys(functionRecord),
              name:
                typeof functionRecord.name === "string"
                  ? sanitizeResponsePreview(functionRecord.name, apiKey)
                  : undefined,
              argumentsType: getValueType(args),
              argumentsLength: getValueLength(args),
              argumentsKeys: getObjectRecord(args) ? Object.keys(getObjectRecord(args) ?? {}) : undefined,
            }
          : undefined,
      };
    }),
  };
}

function logNemotronResponseShape(result: OpenRouterResponse, apiKey: string) {
  const topLevel = getObjectRecord(result);
  const firstChoice = result.choices?.[0];
  const choiceRecord = getObjectRecord(firstChoice);
  const messageRecord = getObjectRecord(choiceRecord?.message);
  const content = messageRecord?.content;
  const reasoning = messageRecord?.reasoning;
  const reasoningDetails = messageRecord?.reasoning_details;
  const contentRecord = getObjectRecord(content);

  console.info("OpenRouter Nemotron successful response shape", {
    topLevelKeys: topLevel ? Object.keys(topLevel) : [],
    error: summarizeNemotronError(topLevel?.error, apiKey),
    choicesLength: Array.isArray(result.choices) ? result.choices.length : undefined,
    firstChoiceKeys: choiceRecord ? Object.keys(choiceRecord) : [],
    messageKeys: messageRecord ? Object.keys(messageRecord) : [],
    messageContent: {
      type: getValueType(content),
      length: getValueLength(content),
      ...(typeof content === "string"
        ? { value: sanitizeResponsePreview(content, apiKey) }
        : {}),
      ...(Array.isArray(content)
        ? {
            itemTypes: content.map(getValueType),
            items: content.slice(0, 10).map((item) => summarizeContentArrayItem(item, apiKey)),
          }
        : {}),
      ...(contentRecord ? { keys: Object.keys(contentRecord) } : {}),
    },
    reasoning: {
      present: messageRecord ? Object.hasOwn(messageRecord, "reasoning") : false,
      type: getValueType(reasoning),
      length: getValueLength(reasoning),
      contentOmitted: true,
    },
    reasoningDetails: {
      present: messageRecord ? Object.hasOwn(messageRecord, "reasoning_details") : false,
      type: getValueType(reasoningDetails),
      length: getValueLength(reasoningDetails),
      contentOmitted: true,
    },
    toolCalls: summarizeToolCalls(messageRecord?.tool_calls, apiKey),
  });
}

function logOpenRouterFailure(
  apiKey: string,
  model: string,
  details: {
    stage: string;
    status?: number;
    statusText?: string;
    contentType?: string | null;
    responseBody?: string;
    error?: string;
    responseLength?: number;
    failureReason?: string;
  }
) {
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

export async function classifyWasteImage(imageUrl: string): Promise<{
  category: ClassifiedWasteCategory;
  confidence: number;
}> {
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
  let selectedModel: string = primaryModel;

  let attemptResponse: Response;
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
  } catch (error) {
    logOpenRouterFailure(apiKey, primaryModel, {
      stage: "request_failed_before_response",
      error: error instanceof Error ? `${error.name}: ${error.message}` : "Unknown fetch error",
    });
    throw new Error("OpenRouter classification request failed.");
  }

  if (!attemptResponse.ok) {
    let responseBody: string;
    try {
      responseBody = await attemptResponse.text();
    } catch {
      responseBody = "<unable to read error response body>";
    }

    const isCapacityOrRateLimit = RETRYABLE_STATUSES.has(attemptResponse.status);
    if (isCapacityOrRateLimit) {
      // Mark attempted models on cooldown so subsequent calls don't redundantly stall
      for (const model of [primaryModel, ...fallbackModels]) {
        markModelCooldown(model, 45 * 1000);
      }
    }

    const modelUnavailable =
      attemptResponse.status === 404 && isModelUnavailable404(responseBody);
    const agenticHarnessRestriction =
      attemptResponse.status === 403 && isAgenticHarnessRestriction403(responseBody);

    logOpenRouterFailure(apiKey, primaryModel, {
      stage: "http_error_response",
      status: attemptResponse.status,
      statusText: attemptResponse.statusText,
      contentType: attemptResponse.headers.get("content-type"),
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
      throw new WasteClassificationCapacityError(
        "Free AI classification models are currently experiencing high traffic or capacity limits. Please wait a moment and try submitting again."
      );
    }

    throw new Error(`OpenRouter classification request failed with status ${attemptResponse.status}.`);
  }

  let result: OpenRouterResponse;
  try {
    result = (await attemptResponse.json()) as OpenRouterResponse;
  } catch {
    logOpenRouterFailure(apiKey, selectedModel, {
      stage: "invalid_success_response_json",
      status: attemptResponse.status,
      statusText: attemptResponse.statusText,
      contentType: attemptResponse.headers.get("content-type"),
    });
    throw new Error("OpenRouter returned an invalid response.");
  }

  if (result.model && typeof result.model === "string") {
    selectedModel = result.model;
    const prioritizedList = [primaryModel, ...fallbackModels];
    const winningIndex = prioritizedList.indexOf(result.model);
    // If a fallback model answered, mark preceding models on cooldown
    if (winningIndex > 0) {
      for (let i = 0; i < winningIndex; i++) {
        markModelCooldown(prioritizedList[i]);
      }
    }
  }

  if (selectedModel === "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free") {
    logNemotronResponseShape(result, apiKey);
  }

  const content = getClassificationText(result);
  if (content === undefined) {
    logOpenRouterFailure(apiKey, selectedModel, {
      stage: "missing_classification_content",
      status: attemptResponse.status,
      contentType: attemptResponse.headers.get("content-type"),
    });
    throw new Error("OpenRouter returned no classification content.");
  }

  let parsed: unknown;
  try {
    parsed = parseClassificationJson(content);
  } catch {
    logOpenRouterFailure(apiKey, selectedModel, {
      stage: "invalid_classification_json",
      status: attemptResponse.status,
      contentType: attemptResponse.headers.get("content-type"),
      responseLength: content.length,
    });
    throw new Error("OpenRouter returned invalid classification JSON.");
  }

  if (typeof parsed !== "object" || parsed === null || !("category" in parsed) || !("confidence" in parsed)) {
    logOpenRouterFailure(apiKey, selectedModel, {
      stage: "incomplete_classification_data",
      status: attemptResponse.status,
      contentType: attemptResponse.headers.get("content-type"),
    });
    throw new Error("OpenRouter returned incomplete classification data.");
  }

  const classification = parsed as { category: unknown; confidence: unknown };
  if (!WASTE_CATEGORIES.includes(classification.category as ClassifiedWasteCategory)) {
    logOpenRouterFailure(apiKey, selectedModel, {
      stage: "unsupported_classification_category",
      status: attemptResponse.status,
      contentType: attemptResponse.headers.get("content-type"),
    });
    throw new Error("OpenRouter returned an unsupported waste category.");
  }

  if (
    typeof classification.confidence !== "number" ||
    !Number.isFinite(classification.confidence) ||
    classification.confidence < 0 ||
    classification.confidence > 100
  ) {
    logOpenRouterFailure(apiKey, selectedModel, {
      stage: "invalid_classification_confidence",
      status: attemptResponse.status,
      contentType: attemptResponse.headers.get("content-type"),
    });
    throw new Error("OpenRouter returned an invalid confidence value.");
  }

  return {
    category: classification.category as ClassifiedWasteCategory,
    confidence: classification.confidence,
  };
}