# Water, energy and indoor-air certification reference

Reviewed: 2026-11-15. Research reference, not enabled scoring rules. Claims below describe requirements at certification, not a current inspection. Match the actual certificate, edition, scope and project exceptions before deriving a feature. Unknown editions remain recognition-only.

## WaterSense labeled homes

**Reviewed edition:** Specification for Homes v2.0, February 2021. Covers single-family and multifamily, new and existing homes; use the applicable certification organization's scope. A WaterSense product label, builder partnership, HERS H2O rating or WERS rating alone is not proof of whole-home WaterSense certification.

**Primary sources:** [Specification v2.0](https://www.epa.gov/sites/default/files/2021-02/documents/watersense_final_homes_specification_v2.0.pdf), sections 1–2 and Appendix B, printed B-1; [EPA certification process](https://www.epa.gov/watersense/certifying-homes); [maintenance guidance](https://www.epa.gov/watersense/home-maintenance).

| Requirement | Safe derived fact | VPSF treatment |
| --- | --- | --- |
| Appendix B: toilets must carry WaterSense labels | Toilets were WaterSense-labeled at certification | Candidate fixture-category input; do not invent fixture count or model |
| Appendix B: bathroom sink faucets must carry WaterSense labels | Bathroom sink faucets were WaterSense-labeled | Do not extend to kitchen/tub faucets |
| Appendix B: showerheads must carry WaterSense labels | Showerheads were WaterSense-labeled | Candidate showerhead-category input |
| Appendix B: pressure and visible-leak checks | Passed specified leak checks at certification | Historical report fact; never map to automatic shutoff or current leak-free status |
| Section 2.2: efficiency threshold through approved method | Met program's whole-home efficiency criterion | Report fact; not a measured household bill reduction and no extra bonus |

The three fixture requirements are mandatory regardless of the chosen efficiency method. Dishwasher efficiency, washer efficiency, reuse, irrigation type and shutoff hardware are not established by that checklist. Obtain project evidence for those. Earlier WaterSense editions need their own reviewed rules; never apply v2 retrospectively by program name alone.

**Code gap:** this checkout has a broad `waterStandard` input but no dedicated built-in toilet, bathroom faucet or showerhead inputs in PropertyInput. Add explicit feature categories before enabling these mappings. Do not preserve the existing 60-point WaterSense lookup as a shortcut. Previously agreed category weights can be implemented with explicit scope; certificate recognition supplies no counts and must not multiply a per-category credit by an invented fixture count.

## ENERGY STAR Certified Homes

**Reviewed edition:** Single-Family New Homes national v3.2, Revision 14. Program family must distinguish SFNH from multifamily and manufactured-home programs, regional requirements, version and revision. Use certificate/project documents to establish the applicable edition; address or certification year alone does not establish it.

**Primary sources:** [National Program Requirements v3.2 Rev.14](https://www.energystar.gov/sites/default/files/2025-01/National%20Program%20Requirements%20Version%203.2_Rev%2014.pdf), Certification Process steps 1–4, Exhibit 2, footnotes 5 and 10; [national requirements hub](https://www.energystar.gov/partner-resources/residential-new/national-page).

The certification process allows a custom set of efficiency measures to meet a modeled ERI target. Exhibit 2 requires field and water-management checklists and one of the HVAC design/verification tracks. This establishes a documented performance/verification process, but does not identify every installed product.

Safe report facts include compliance with the specified edition and its required verification process. Request the home's rating report to populate its actual energy rating, insulation levels, window performance, air leakage and equipment specifications. The reference-design equipment in Exhibit 1 is not a list of equipment guaranteed to be installed in the certified home. Footnote 10 explicitly distinguishes recommended ENERGY STAR products from mandatory installed products.

Do not infer a fixed HERS band, heat pump, solar panels, battery, smart thermostat, ENERGY STAR dishwasher, balanced ventilation or an ERV solely from this certificate. Likewise, checklist completion does not justify the broad existing `Enhanced Moisture Management` score without defining which physical details earn that credit. Project-specific exceptions must be preserved. Earlier and regional versions are recognition-only until separately mapped.

## EPA Indoor AirPlus

**Reviewed edition:** Version 2 Verification Requirements, July 2024; tiers Certified and Gold. The program document hub also provides Version 1 Rev.5. The former is not a replacement mapping for all older certificates.

**Primary sources:** [Program document hub](https://www.epa.gov/indoorairplus/indoor-airplus-program-documents); [v2 verification requirements](https://www.epa.gov/system/files/documents/2024-07/iap-v2-verification-requirements_508.pdf), Introduction, items 4.2.1, 4.6.1–4.6.6, 4.11–4.12, 5.4.2, and 6.1–6.7.

| Edition/tier rule | Safe derived fact | VPSF treatment |
| --- | --- | --- |
| v2 Certified, 4.6.1 | Mechanical ventilation installed | Report-only until a general mechanical-ventilation field exists; not necessarily balanced or heat recovery |
| v2 Gold, 4.6.1 | Balanced mechanical ventilation installed | Candidate exact mapping to `ventilation = Balanced Ventilation`; no assumption of ERV/HRV |
| v2 Gold, 4.2.1 | Humidity monitoring provided, with allowed alternatives | Report-only; not broad pollutant/CO2 IAQ monitoring |
| v2, sections 6.1–6.7 | Covered material categories meet specified emission/formaldehyde criteria where applicable | Report category-specific requirements; do not convert to all materials being zero-VOC |
| v2, 5.4.2 | Applicable airtightness threshold met | Report threshold only with dwelling size/type; not an invented measured ACH50 result |
| v2 Gold prerequisite | ENERGY STAR certification prerequisite | Record relationship, but do not invent ENERGY STAR edition or duplicate feature credit |

Filtration requirements depend on tier and system type, with alternatives and exceptions. Do not infer a single universal installed MERV rating without the project details. Requirements marked Gold do not apply to Certified. Advisories are not mandatory requirements. N/A and approved exceptions must remain distinguishable from compliance.

The existing `healthCert = EPA Indoor airPLUS` does not specify edition or tier: it cannot trigger Gold-specific features. The existing `materials = Low / No-VOC` combines different claims and is too broad for automatic inference from partial category coverage. The narrowly supported Gold balanced-ventilation mapping is a better initial scoring candidate.

## Common application rules

- A certificate-derived feature remains tagged as derived, with rule ID, certificate evidence, edition, clause and award date. It is not marked homeowner-confirmed or freshly inspected.
- Current specific evidence and homeowner corrections override these defaults; explicit None is not an unanswered field.
- A feature already recorded gets no additional credit from another certificate. Uncertain or expired/revoked claims do not silently populate scoring inputs.
- Ask about relevant replacements only when needed; do not show the homeowner the full standard checklist.
- The certificate's name carries no separate points once the feature-inference scoring model is released.
