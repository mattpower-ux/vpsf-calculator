export function themeFromSearch(search) {
  const theme = new URLSearchParams(search).get("theme");
  return theme === "greenpro" ? "greenpro" : "brand";
}
