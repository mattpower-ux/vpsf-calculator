# Analysis depth release verification — 2026-11-15

Moderate now uses a 13-field key-features form after property details, then review and score. Inclusive begins with seven pillar evidence checklists, targeted missing-detail prompts, optional evidence tools, full forms, an on-device saved draft, and expanded supporting findings. Completeness is separate from points. No scoring rules changed.

## Verified
- Responsive browser viewports: phone 390x844; laptop 1440x1000.
- Both paths reached score overview, retained their analysis label, and returned 200 for the same untouched demo home.
- Moderate-to-Inclusive switch retained edited roof age (18).
- Inclusive draft retained HVAC age after reload/resume. Draft excludes original documents/images; saves only bounded assessment data on this device, with an explicit disclosure and Delete control.
- No horizontal page overflow observed on laptop; phone layouts visually inspected.
- Frontend: 158 tests passed. Production root build passed. git diff --check passed.
- Backend: 32 relevant existing tests passed. Identical 68-field payloads returned 545 for Moderate and Inclusive with identical pillar scores, confidence, explanations and improvements.
- Independent review resolved edited-document provenance and findings/count consistency issues. 20 relevant helper tests passed after correction.
- Impeccable detector returned no findings for new screen components/styles.

## Scope and limits
Browser viewport testing, not physical-device camera testing. Existing scoring, extraction services, automatic photo sourcing, and thumbnail restrictions unchanged. Completeness summarizes available provenance; it does not authenticate documents. Draft storage is browser-local and opt-in, not cloud sync.
