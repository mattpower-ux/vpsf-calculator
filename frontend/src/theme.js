export function themeFromSearch(search) {
  return new URLSearchParams(search).get("theme") === "greenpro" ? "greenpro" : "default";
}
