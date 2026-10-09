const climateZoneOptions = [
  "Unknown",
  "1A - Very Hot Humid",
  "2A - Hot Humid", "2B - Hot Dry",
  "3A - Warm Humid", "3B - Warm Dry", "3C - Warm Marine",
  "4 - Mixed", "4A - Mixed Humid", "4B - Mixed Dry", "4C - Mixed Marine",
  "5A - Cool Humid", "5B - Cool Dry", "5C - Cool Marine",
  "6A - Cold Humid", "6B - Cold Dry",
  "7 - Very Cold", "8 - Subarctic"
];

export function climateZoneOptionsFor(currentValue) {
  return currentValue && !climateZoneOptions.includes(currentValue)
    ? [currentValue, ...climateZoneOptions]
    : climateZoneOptions;
}
