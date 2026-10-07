export function assessedHomeAddress({ resultMode, selectedProperty, home, hasAssessedHome }) {
  if (resultMode === "demo") return selectedProperty?.address?.trim() || "";
  return hasAssessedHome ? home?.address?.trim() || "" : "";
}
