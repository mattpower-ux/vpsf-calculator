# Green Builder awards catalog

Imported November 20, 2026 from the March/April 2024, 2025 and 2026 Sustainable Products of the Year articles. Annual JSON files retain editorial source and photo URLs.

- 2024: 50 writeups — https://www.greenbuildermedia.com/blog/2024-green-builder-sustainable-products-of-the-year
- 2025: 54 writeups — https://www.greenbuildermedia.com/blog/2025-sustainable-products-of-the-year
- 2026: 55 writeups — https://www.greenbuildermedia.com/blog/2026-green-builder-sustainable-products-of-the-year
- 159 writeups consolidate to 156 products. LP SmartSide and Arclin Firepoint repeat across years. Five products overlap the prior catalog, giving 151 additions and 169 total listings.
- Blurbs are 25–40 words. Awards are historical editorial recognition, not current technical certification or sponsored status.
- Category/pillar alignment is evidence-based. No Community products were forced into this collection. More faucet and community-specific coverage needs other sources.

## Storage and updates

`backend/app/data/award_products.json` is the portable versioned manifest. Startup/catalog access imports it transactionally into the existing persistent database. `product_catalog_sources` retains source history. Existing product tables remain the admin-controlled source of catalog entries; admin edits, hiding and sponsorship survive imports. The public `/api/products/catalog` JSON endpoint excludes hidden/inactive products and includes no lead data. This export and stable IDs support future app clients.

Run `python backend/scripts/build_award_catalog.py` after editing annual evidence. Run `python backend/scripts/prepare_award_images.py` to download/compress real source images; no generated product imagery. Images are WebP, maximum 640×480, aspect ratio preserved. All 156 images total 3,117,384 bytes. Production serves them from `/catalog-images/` on the frontend CDN. The verification report stores source hashes and asset checksums.

Once a version has been imported online, increment `catalogVersion` in the builder before changing the manifest. Never overwrite an existing persisted version. Updated entries refresh fields still matching the prior import; customized fields remain intact.

## Photo corrections

Manufacturer images replace mismatched/unclear magazine images for American Standard Gold 17, Fusion Air 90-degree, BASF ENERTITE X, Stiebel Eltron Tempra Plus and Benjamin Moore Eco Spec. Annual records retain the final URLs. Photos were visually checked for these corrections; image credits distinguish manufacturer replacements.

## Matching

Catalog browsing includes all products. Home recommendations require known needs; missing information is not assumed to establish a deficiency. Individual fixture tags distinguish toilets, faucets and showerheads. Sinks/bidet seats, utility-scale storage, design tools and unsupported needs stay browse-only. Incidental leak protection does not independently trigger water-heater or water-treatment replacement. Awards and product brands do not alter scoring. Inquiries remain in the existing admin lead queue.
