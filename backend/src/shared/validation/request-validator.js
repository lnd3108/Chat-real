export const parseBody = (schema, body) => schema.parse(body);

export const parseQueryInteger = (value, { min, max, fallback }) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalizedMin = Number.isFinite(min) ? min : parsed;
  const normalizedMax = Number.isFinite(max) ? max : parsed;

  return Math.min(Math.max(parsed, normalizedMin), normalizedMax);
};

export const parseTrimmedString = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};
