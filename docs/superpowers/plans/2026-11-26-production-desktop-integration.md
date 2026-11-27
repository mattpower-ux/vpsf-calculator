# Production Desktop Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved optional desktop presentation to the production VPSF calculator, including the complete score-improvement and product-recommendation experience, without forking calculator state or logic.

**Architecture:** `App` continues to own all property, evidence, scoring, recommendation, product, draft, archive, and navigation state. A persisted `viewMode` chooses either the established mobile shell or a new responsive desktop shell around the same active screen tree. Pure mapping helpers derive desktop workflow context from existing screen IDs.

**Tech Stack:** React, Vite, CSS-in-JSX already used by `App.jsx`, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-26-production-desktop-integration-design.md`

## Global Constraints

- Mobile remains the default and retains the established phone presentation.
- Desktop and mobile use one React state model and one set of screen components.
- No scoring weights, backend APIs, evidence semantics, or product eligibility rules change.
- Switching views preserves current workflow state and does not rescore.
- Preserve unrelated worktree files and QA assets.

## Review Focus

- Missing or malformed stored view preference falls back to mobile.
- Switching shells at a deep workflow screen preserves the current screen and property state.
- Desktop mode remains usable when the viewport is narrower than a normal laptop.
- Screens without scores, photos, recommendations, or products retain their existing fallback behavior.
- The improvement path shows only relevant products and retains Premiere Partner ordering from the existing recommendation data.

---

### Task 1: View preference and desktop context contracts

**Files:**
- Create: `frontend/src/calculatorViewMode.js`
- Create: `frontend/src/calculatorViewMode.test.js`
- Create: `frontend/src/desktopWorkflow.js`
- Create: `frontend/src/desktopWorkflow.test.js`

**Interfaces:**
- Produces: `readCalculatorViewMode(storage)`, `writeCalculatorViewMode(storage, mode)`, `normalizeCalculatorViewMode(value)`, and `desktopContextForScreen(screen)`.
- Consumes: production screen IDs and browser local storage.

- [ ] Write failing tests for default/valid/invalid mode values, persistence, and workflow mapping coverage.
- [ ] Run `node --test frontend/src/calculatorViewMode.test.js frontend/src/desktopWorkflow.test.js` and confirm the missing-module failure.
- [ ] Implement the pure helpers with mobile fallback and a four-stage context map.
- [ ] Re-run the focused tests and confirm all pass.
- [ ] Commit the task.

### Task 2: Shared mobile and desktop shells

**Files:**
- Create: `frontend/src/DesktopCalculatorChrome.jsx`
- Create: `frontend/src/desktopCalculatorChrome.css`
- Create: `frontend/src/desktopCalculatorChrome.test.js`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `viewMode`, `desktopContextForScreen`, current `home`, result, selected pillar, screen, navigation callbacks, and the existing active screen node.
- Produces: `CalculatorChrome` presentation switch; `MobileCalculatorChrome` preserving the current phone shell; `DesktopCalculatorChrome` wrapping the same children.

- [ ] Write failing contract tests for the mobile switch control, desktop return control, four stage labels, property context, and one shared children slot.
- [ ] Run the focused shell test and confirm the expected failure.
- [ ] Add view-mode state to `App`, persist it separately, and split the existing shell without duplicating children.
- [ ] Add desktop header, stage navigation, property rail, central work area, guidance rail, Save Draft placement, and responsive rail collapse.
- [ ] Re-run focused tests and the existing shell layout test.
- [ ] Commit the task.

### Task 3: Score review and improving-performance desktop composition

**Files:**
- Create: `frontend/src/desktopImprovementPath.js`
- Create: `frontend/src/desktopImprovementPath.test.js`
- Modify: `frontend/src/DesktopCalculatorChrome.jsx`
- Modify: `frontend/src/desktopCalculatorChrome.css`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: existing result, advice, recommended products, product click/detail callbacks, `selectedRecommendation`, and screen navigation.
- Produces: desktop score-review action and prioritized improvement rows with up to two relevant clickable products per recommendation.

- [ ] Write failing tests for priority ordering, two-product limits, missing-product fallback, and retained Premiere Partner ordering.
- [ ] Run the focused test and confirm failure for missing behavior.
- [ ] Add the full-width `How Can I Improve this Score?` transition using existing navigation.
- [ ] Add desktop recommendation rows: recommendation left, product thumbnails/brand/type right, existing detail opening on click.
- [ ] Verify mobile retains its existing stack and desktop uses the new composition only in desktop mode.
- [ ] Re-run focused and product recommendation tests.
- [ ] Commit the task.

### Task 4: Workflow transitions, state retention, and accessibility

**Files:**
- Create: `frontend/src/desktopWorkflowIntegration.test.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/DesktopCalculatorChrome.jsx`
- Modify: `frontend/src/desktopCalculatorChrome.css`

**Interfaces:**
- Consumes: all existing screen transitions, draft callbacks, restart behavior, and shell switch callbacks.
- Produces: keyboard-accessible mode changes and uninterrupted Basic/Superior, pillar, scoring, and improvement flows.

- [ ] Write failing contract tests covering mode switch retention, all seven pillar stage mappings, restart, score review, improvement path, product detail, and mode focus targets.
- [ ] Run the focused test and confirm the expected failures.
- [ ] Complete navigation labels/current-state semantics, mode-switch focus behavior, responsive DOM order, and missing-data fallbacks.
- [ ] Re-run integration tests plus all `frontend/src/*.test.js` tests.
- [ ] Commit the task.

### Task 5: Build, visual QA, review, and deployment

**Files:**
- Modify only files required by verified defects.
- Add QA screenshots under `docs/qa/2026-11-26-desktop-integration/` only when they are generated by this task.

**Interfaces:**
- Consumes: completed desktop integration.
- Produces: verified production build and deployed GitHub/Render revision.

- [ ] Run the full frontend Node test suite and record the pass/fail count.
- [ ] Run `npm run build` in `frontend` and confirm exit code 0.
- [ ] Exercise address entry, Basic flow, Superior flow, all pillar transitions, score review, improvement path, product detail, Save Draft, and both mode switches on phone and laptop viewports.
- [ ] Run a fresh whole-branch code review and fix Critical/Important findings with regression tests.
- [ ] Push the verified branch through the existing GitHub-to-Render path.
- [ ] Confirm the deployed revision and repeat the critical phone/laptop smoke flow on the live URL.

