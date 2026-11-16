# VPSF certification reference library

Reviewed November 15, 2026. Version: research-2026-11-15.

This is the sourced research index for certification-derived feature discovery. It covers all eight requested program families. **It is not yet a live API, admin editor or automatic scoring integration.** The [implementation design](implementation-design.md) explains that transition. Rules must be published against an exact reviewed edition before use; naming a program in this index does not enable automatic assumptions for every certificate carrying that name.

A [machine-readable program index](index.json) provides stable IDs, document locations, candidate facts and prohibited assumptions. Its `automaticScoringEnabled` flag is false: it is a research manifest, not an executable rule set.

## Program index

| Program family | Reference | Useful evidence to discover | Important boundary |
| --- | --- | --- | --- |
| WaterSense labeled homes | [Water / energy / indoor air](water-energy-indoor-air.md#watersense-labeled-homes) | Required labeled bathroom fixtures | Does not establish dishwasher, irrigation type or automatic shutoff |
| ENERGY STAR Certified Homes | [Water / energy / indoor air](water-energy-indoor-air.md#energy-star-certified-homes) | Rating and inspection evidence, installed-system details in project reports | Performance pathway is not a guaranteed equipment package |
| EPA Indoor AirPlus | [Water / energy / indoor air](water-energy-indoor-air.md#epa-indoor-airplus) | Tier-specific ventilation and material requirements | Certified and Gold differ; generic older label is insufficient |
| LEED residential | [LEED / NGBS](leed-ngbs.md) | Prerequisites plus actual earned-credit evidence | Gold/Platinum alone does not identify optional features |
| NGBS Green | [LEED / NGBS](leed-ngbs.md) | Mandatory practices and verified project selections | Edition, building type and certification path matter |
| Phius / Passive House | [Passive / resilience](passive-resilience.md) | Tested/modelled envelope and ventilation performance | Phius and Passive House Institute are separate rule sets |
| FORTIFIED | [Passive / resilience](passive-resilience.md) | Roof, opening and structural protections by designation and peril | Roof designation does not imply noncombustible siding |
| Wildfire Prepared Home | [Passive / resilience](passive-resilience.md) | Specified wildfire-protection measures by Base/Plus and edition | Do not turn a fire classification into a particular material or brand |

## How to read the references

**Mandatory:** supported by the exact program edition and applicable scope, subject to recorded exceptions and changes since certification. A candidate to fill a missing fact.

**Conditional:** depends on climate, building type, tier, equipment or compliance path. Apply only after that condition is established.

**Optional:** requires the home's actual checklist/scorecard; never select it because the overall label seems prestigious.

**Report-only:** useful physical/performance information with no exact supported VPSF input or scoring rule yet. Do not force it into a vaguely similar scored field.

All derived features need their source and time basis retained. Specific current home information overrides defaults, and the same feature receives points only once. Certification itself carries no additional bonus in the proposed replacement model.

## Known coverage limits

This is an initial rule-discovery index, not a transcription of every proprietary standard or historical edition. Each reference lists reviewed scope and unresolved requirements. Unreviewed versions and ambiguous claims stay recognition-only. Source links must remain attached to future admin rules; cached pages are not a substitute for the certificate's applicable edition.

The fixture fields needed for the clearest WaterSense mappings are not built-in scoring inputs in this checkout. Existing direct certification lookup bonuses must be transitioned at the same release that activates feature-based credit. The design preserves old score runs, versions the new rules and avoids double counting.
