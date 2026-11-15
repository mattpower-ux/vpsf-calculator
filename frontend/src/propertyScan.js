const usable = value => value !== undefined && value !== null
  && (typeof value !== 'string' || !/^(|unknown|none \/ unknown)$/i.test(value.trim()));

/** Merge provider values and evidence together; primary usable facts win. */
export function mergeProviderFields(primary, fallback) {
  const merged = {...primary, provenance:{...primary?.provenance}};
  for (const [key,value] of Object.entries(fallback || {})) {
    if (key === 'provenance' || key === 'sourceNote') continue;
    if (!usable(merged[key]) && usable(value)) {
      merged[key] = value;
      // Missing fallback evidence must not inherit evidence for a different value
      // or be promoted by importedHome's legacy missing-provenance fallback.
      merged.provenance[key] = {...(fallback.provenance?.[key] || {origin:'unknown'})};
    }
  }
  return merged;
}

/** Exact request-address binding, including the render before effect cleanup. */
export function savedMatchForAddress(cached, address) {
  return cached?.lookupAddress === address ? cached.property ?? null : null;
}
