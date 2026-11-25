export async function normalizeAddressForSearch(address, geocode) {
  const query = address.trim();
  try {
    const result = await geocode(query);
    return result?.normalizedAddress?.trim() || query;
  } catch {
    return query;
  }
}
