// Map a set of labels to one of the WasteCategory values.
// This is a simple rule-based mapper; it can be tuned later or replaced with a custom model.
const CATEGORY_KEYWORDS = {
    pending: [],
    Plastic: ["plastic", "bottle", "container", "bag", "polyethylene", "PET"],
    Paper: ["paper", "cardboard", "newspaper", "book", "envelope"],
    Glass: ["glass", "bottle", "jar"],
    Metal: ["metal", "can", "aluminum", "tin", "steel"],
    Organic: ["food", "fruit", "vegetable", "organic", "compost"],
    "E-waste": ["electronic", "phone", "battery", "charger", "computer"],
    "Non-recyclable": ["trash", "waste", "non-recyclable", "garbage"],
};
export function mapLabelsToCategory(labels) {
    const lowerLabels = labels.map((l) => ({ label: l.label.toLowerCase(), score: l.score }));
    const scores = {
        pending: 0,
        Plastic: 0,
        Paper: 0,
        Glass: 0,
        Metal: 0,
        Organic: 0,
        "E-waste": 0,
        "Non-recyclable": 0,
    };
    for (const l of lowerLabels) {
        for (const category of Object.keys(CATEGORY_KEYWORDS)) {
            for (const kw of CATEGORY_KEYWORDS[category]) {
                if (l.label.includes(kw.toLowerCase())) {
                    scores[category] += l.score;
                }
            }
        }
    }
    let best = null;
    let bestScore = 0;
    for (const c of Object.keys(scores)) {
        if (scores[c] > bestScore) {
            bestScore = scores[c];
            best = c;
        }
    }
    // normalize confidence to percentage (0-100)
    const confidence = Math.min(100, Math.round(bestScore * 100));
    return { category: best, confidence };
}
