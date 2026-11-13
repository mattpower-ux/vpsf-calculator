export const presentationAddress = "53017 Double View Lane, Idyllwild, CA 92549";

export function isPresentationAddress(address) {
  const normalized = String(address || "").toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  return /^53017 double view (?:lane|ln)(?: idyllwild(?: (?:ca|california))?(?: 92549)?)?$/.test(normalized);
}
