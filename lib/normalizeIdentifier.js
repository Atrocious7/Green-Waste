export function normalizeIdentifier(value) {
    const seen = new WeakSet();
    function normalize(current) {
        if (typeof current === "string") {
            return /^[0-9a-f]{24}$/i.test(current) ? current.toLowerCase() : null;
        }
        if (current === null || typeof current !== "object")
            return null;
        if (seen.has(current))
            return null;
        seen.add(current);
        try {
            const toHexString = current.toHexString;
            if (typeof toHexString === "function") {
                const hex = toHexString.call(current);
                return typeof hex === "string" && /^[0-9a-f]{24}$/i.test(hex) ? hex.toLowerCase() : null;
            }
            const id = current._id;
            return id === undefined ? null : normalize(id);
        }
        catch {
            return null;
        }
    }
    return normalize(value);
}
