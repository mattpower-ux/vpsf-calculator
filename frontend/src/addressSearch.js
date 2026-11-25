export async function normalizeAddressForSearch(address, geocode) {
  const query = address.trim();
  try {
    const result = await geocode(query);
    if (result?.address?.trim() && result?.city?.trim() && result?.state?.trim()) {
      const region = [result.state.trim(), result.zip?.trim()].filter(Boolean).join(" ");
      return `${result.address.trim()}, ${result.city.trim()}, ${region}`;
    }
    return result?.normalizedAddress?.trim() || query;
  } catch {
    return query;
  }
}
