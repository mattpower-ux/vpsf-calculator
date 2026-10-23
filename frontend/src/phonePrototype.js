export function phonePrototypeEnabled(development, search, screenWidth = Infinity, screenHeight = Infinity) {
  const phone = Math.min(screenWidth, screenHeight) > 0 && Math.min(screenWidth, screenHeight) <= 600;
  return phone || (development && new URLSearchParams(search).get("phonePreview") === "1");
}
