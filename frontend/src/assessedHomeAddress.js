export function assessedHomeAddress({ resultMode, selectedProperty, home, hasAssessedHome }) {
  if (resultMode === "demo") return selectedProperty?.address?.trim() || "";
  return hasAssessedHome ? home?.address?.trim() || "" : "";
}

export function assessedHomeStreetAddress(context) {
  const address = assessedHomeAddress(context);
  if (!address) return "";

  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const city = (context.resultMode === "demo" ? context.selectedProperty?.city : context.home?.city)?.trim();
  const cityIndex = city ? parts.findIndex((part, index) => index > 0 && part.toLowerCase() === city.toLowerCase()) : -1;
  if (cityIndex > 0) return parts.slice(0, cityIndex).join(", ");
  if (parts.length > 1 && /^(apt|apartment|unit|suite|ste|floor|#)\b/i.test(parts[1])) return parts.slice(0, 2).join(", ");
  return parts[0] || "";
}
