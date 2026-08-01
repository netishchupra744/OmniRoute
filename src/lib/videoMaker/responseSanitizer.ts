const SECRET_KEY_PATTERN = /(authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|cookie|secret|password|credential)/i;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi;

export function sanitizeProviderPayload(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[TRUNCATED_DEPTH]";
  if (typeof value === "string") {
    return value.replace(BEARER_PATTERN, "Bearer [REDACTED]").slice(0, 100_000);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 500).map((item) => sanitizeProviderPayload(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 500)) {
      result[key] = SECRET_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : sanitizeProviderPayload(nested, depth + 1);
    }
    return result;
  }
  return value;
}
