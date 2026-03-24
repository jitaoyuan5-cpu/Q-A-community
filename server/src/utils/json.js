export const parseJsonField = (value, fallback = null) => {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  if (typeof value === "object") {
    return value;
  }
  return fallback;
};
