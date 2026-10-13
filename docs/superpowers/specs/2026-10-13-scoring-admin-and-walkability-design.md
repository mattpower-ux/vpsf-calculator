# VPSF Scores and Weighting Admin Design

Date: 2026-10-13

## Purpose and scope

The admin must be able to inspect and change the actual VPSF scoring model, organized by the seven pillars, without editing source code. Admins can adjust existing weights, split a factor's points among subfactors, remove factors, and add factors backed by existing facts or new optional homeowner inputs. Only admins can draft and publish scoring changes. Homeowners see the resulting questions and scores but cannot change the model.

This work also connects address-based community scoring to the EPA National Walkability Index. It replaces the misleading hard-coded "WalkScore above 70" claim for assessed homes. The surrounding phone canvas/transparency request is separate and is not included here.

## Current system and constraints

- `backend/app/scoring/engine.py` is the authoritative live scorer, with hard-coded rules and pillar caps of Energy 200, Water 100, Health 200, Resilience 200, Carbon and Materials 150, Financial Risk 100, and Community and Mobility 50. These caps sum to 1,000.
- `frontend/src/App.jsx` also contains a local scoring implementation and fixed pillar prose. Assessed properties use the backend result; the local implementation must not become a second configurable authority.
- `frontend/src/admin/AdminDemo.jsx` has climate/profile controls that modify local React state only. Its percentages and override checkboxes do not change `/api/score`.
- The current admin passcode is hard-coded in the frontend and API. This must be replaced before write access to a scoring model is enabled.
- Score runs already store `model_version`, input snapshots, pillar scores, and explanations. Historical runs must remain unchanged after a new model is published.

## Chosen approach

Use a server-side, versioned, typed rule catalog. The alternatives considered were editable constants layered over the existing hard-coded scorer, which would not support safe additions or deletions, and an arbitrary formula editor, which would be too difficult to validate and audit. The typed catalog supports the requested flexibility while limiting conditions and input types to tested operations.

The published model is the only model used by `/api/score`. One draft is editable at a time; publishing creates an immutable numbered version. The initial published version is seeded to reproduce current backend scores on a representative regression set before the new admin controls are exposed. The backend returns the published version identifier with every score and stores it on every score run.

## Model structure and scoring

Each of the seven pillars has a point budget. Published pillar budgets must sum to exactly 1,000. A factor belongs to one pillar and has a stable ID, display name, source, condition, point allocation, and optional grouping. Source can be an existing property field, an admin-defined custom field, or a vetted location enrichment such as the EPA index. Conditions are typed comparisons: equality or membership for choices, ranges for numbers, and true/false for checkboxes. Existing hazard deductions are represented as bounded negative modifiers; the admin must see their possible range and cannot turn a deduction into an unbounded formula. No executable formulas are accepted from the browser.

The factor editor supports two actions:

1. **Add points** creates a factor with a new allocation and raises that pillar's draft budget by the same amount. If the draft total exceeds 1,000, the admin-only balancing dialog opens. The draft can be saved but cannot be published while unbalanced.
2. **Split points** turns an existing factor's allocation into child allocations. The children can be additive or mutually exclusive. Their maximum combined contribution must not exceed the parent allocation, so the pillar budget does not change.

Deleting a factor from a draft removes its contribution and allocation; the admin can redistribute the freed points. Published versions and old score runs are never mutated or deleted. A slider and numeric input show each editable allocation, its pillar subtotal, and the model total. When the draft exceeds 1,000, a modal states the excess and offers the same factor sliders to bring it to 1,000. Publishing requires all pillar budgets to be nonnegative, the model total to equal 1,000, valid factor conditions, and child allocations within their parent.

The scorer evaluates the published rules against validated facts and clamps each pillar's earned points to that pillar's published budget. Unknown or absent facts earn no positive rule points unless a rule explicitly defines a documented neutral baseline. A homeowner can never use the admin balancing sliders, and a published model cannot return more than 1,000 total points. Existing labels and grade thresholds remain until separately revised.

## New homeowner inputs

Admins may create optional checkbox, single-select, or bounded numeric fields in a chosen pillar. A field definition includes its label, helper text, allowed options or range, default `Unknown`, and a stable ID. After publication, the public model-form endpoint returns only active input definitions; the mobile evaluation form renders them in the relevant pillar section. The backend validates submitted values against that published definition and stores them in an `extraInputs` object in property and score snapshots. A retired field disappears from new forms but stays in historical snapshots. New fields are optional so an admin publish cannot block existing homeowners from completing an evaluation.

## EPA walkability enrichment

The backend queries the [EPA National Walkability Index map service](https://geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer/0) with the geocoded address point, retrieves `NatWalkInd` for the containing census block group, and records the numeric value, source URL, block-group identifier when returned, and lookup time. EPA describes this as a relative 1-20 block-group index, not an address-level proprietary Walk Score. The interface labels it **EPA National Walkability Index (1-20)** and notes that the service uses 2019 census block groups and the 2021 Smart Location Database; it never calls the value "WalkScore." The lookup runs for fresh scans and can refresh saved properties without triggering a new paid property-data pull.

The initial published Community factor maps index values 1-5 to 0 points, 6-10 to 5, 11-15 to 10, and 16-20 to 15, within the existing 50-point Community budget. This mapping is an explicit VPSF model choice, not an EPA conversion to Walk Score. An unavailable lookup leaves the value unverified and grants no walkability points; it does not invent a city-average or claim that the property is unwalkable. Community pros/cons and score explanations are derived from the assessed home's actual evidence. The hard-coded "WalkScore above 70" pro is removed from assessed results. Prior saved score runs remain as recorded.

## Admin experience

Add **Scores and Weighting** to the admin sidebar. A compact summary shows the published version, draft status, seven pillar budgets, and total out of 1,000. Pillar tabs or expandable sections list every factor with current allocation, input/source, condition, and status. Admins can filter/search, edit, split, add, retire, and preview changes. A comparison view scores at least one saved property under the published and draft models without overwriting its real score. Publish requires a confirmation that names the new version and summarizes the changed allocations. The existing **Climate and Location Metrics** screen must become a view/filter of the same model or be clearly marked as a non-scoring preview; it must not imply that local-only controls are live.

The admin page follows the existing operational visual language: dense but readable rows, restrained colors, real numeric controls, keyboard-accessible dialogs, and responsive layouts. The homeowner mobile frame and navigation stay intact. The public score UI shows the model version and evidence status where relevant but exposes no editing controls.

## Security, persistence, and APIs

Replace the literal `2027` frontend/backend passcode with a server-configured admin credential and short-lived authenticated session. No model write endpoint accepts a browser-supplied hard-coded passcode. Admin routes require server-side authorization; public scoring and read-only form-definition routes expose no admin draft data. Rate-limit login attempts. Use HTTPS on the existing GitHub-to-Render deployment path; no OpenAI Sites.

Persist scoring model versions as new database records, with JSON rule definitions, status, author/time metadata, and a monotonic version identifier. Keep an audit event for draft saves and publishes. API boundaries include read published form definitions, admin read/write draft, validate and preview draft, publish draft, and retrieve version history. The score endpoint loads one published version per request and writes that version identifier to the score run. If the model store is unavailable, scoring fails clearly rather than silently switching to hard-coded points.

The EPA lookup is a separate backend integration with a bounded timeout and cache. A provider error, no matching block group, or missing coordinates returns `unverified`; it does not fail the whole property scan or score request. The client receives a source/status object alongside the numeric value when available.

## Verification and rollout

- Golden tests compare the seeded model against current backend scores and pillar caps for representative homes, including unknown data, high-scoring homes, and hazard adjustments.
- Rule tests cover additive versus exclusive groups, splits, deletion, unknown inputs, caps, model totals, and attempted publication of an over-1,000 draft.
- API tests cover admin-only access, custom-field validation, concurrent draft edits, version history, score-run immutability, and preview not altering saved scores.
- EPA tests mock point lookup success, Bangor-area coordinates, service failure, cache behavior, and the unverified fallback. UI tests verify sourced labels and prevent static unsupported pros.
- Browser checks cover the admin desktop/mobile layout, sliders and dialog focus behavior, plus the homeowner form on a standard phone viewport.
- Roll out by configuring the admin secret on Render, deploying the backend and frontend through GitHub, verifying the seeded model in production, then enabling admin publication. No scoring change is published solely because code was deployed.

## Out of scope

This design does not implement the separate transparent outer-phone background request, change grade thresholds, guarantee a particular Bangor score, or retroactively rescore historical reports. The earlier proposed water-fixture and roof weights can be added as factors after their input definitions and scoring allocations are reviewed within this model.
