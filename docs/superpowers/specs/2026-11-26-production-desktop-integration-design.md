# VPSF Production Desktop Integration Design

## Objective

Add an optional desktop presentation to the production VPSF calculator while preserving the existing mobile calculator as the primary experience. Both presentations must operate on the same React state, scoring rules, evidence, drafts, archives, product catalog, and backend services. Switching presentations must not restart the workflow or change a score.

## Success criteria

- The mobile start screen displays `Open Desktop Version` immediately above the MEASURING footer.
- Desktop mode follows the approved four-stage workflow: Choose the home, Document the home, Review scores, Explore recommendations.
- Switching modes preserves the current address, property record, entered answers, evidence, current screen, score, recommendation context, and draft state.
- Changes to calculator data, scoring, products, or navigation are shared automatically because there is one application and one state model.
- Mobile retains the established 390px phone shell, branded header, internal scrolling, and bottom navigation.
- Desktop supports laptop-sized viewports without reproducing or forking scoring logic.
- The production build passes automated tests and is verified on representative phone and laptop layouts before deployment.

## Scope

### Included

- A shared `viewMode` state with mobile and desktop values.
- A production desktop application shell.
- Mode-switch controls in mobile and desktop.
- Desktop layout treatment for property selection, guided home documentation, score review, improvement recommendations, and product exploration.
- Shared Save Draft behavior.
- Desktop stage navigation, property context, guidance rail, seven-pillar progress, and recommendation/product presentation.
- Mode persistence in local storage.
- Automated state-retention, navigation, and responsive tests.
- Render production deployment after verification.

### Excluded

- A separate desktop application, route tree, scoring engine, or backend.
- Changes to VPSF scoring weights.
- New public-record providers or image-analysis algorithms.
- Replacing the established mobile visual identity.
- Rebuilding every secondary administrative or educational screen as a custom desktop composition in the first release. Secondary screens use the shared desktop content frame and remain fully functional.

## Architecture

### Shared application state

`App` remains the owner of calculator state, including `screen`, `home`, evidence, results, recommendations, products, draft and archive behavior. Add one state value:

```text
viewMode: "mobile" | "desktop"
```

The initial value comes from a dedicated local-storage preference. If no preference exists, mobile remains the default. Changing `viewMode` changes only presentation. It must not call `setScreen`, clear result state, rerun scoring, replace `home`, or mutate evidence.

### Shell boundary

Refactor the current `AppChrome` responsibility into a shared shell boundary:

- `CalculatorChrome` chooses the presentation from `viewMode`.
- `MobileCalculatorChrome` retains the current `phoneShell`, banner, measurement footer and bottom navigation.
- `DesktopCalculatorChrome` renders the approved desktop frame around the same active screen content.

The active screen component is created once and passed as children to the selected shell. Individual screen components continue receiving the same props and callbacks.

### Desktop shell regions

The desktop shell has four persistent regions:

1. **Brand header:** VPSF identity, `Return to mobile view`, and free-report message.
2. **Stage navigation:** Choose the home, Document the home, Review scores, Explore recommendations.
3. **Left context rail:** property image, address, audit depth, workflow position, and seven-pillar progress where applicable.
4. **Central work area and right guidance rail:** active screen in the center; Save Draft, evidence guidance, status, and relevant context on the right.

The shell owns layout and workflow context only. It does not calculate data or own separate form values.

## Workflow mapping

Create a pure screen-to-desktop-context mapping rather than scattering screen-number checks throughout layout components. Each mapped screen supplies:

- workflow stage;
- active audit item;
- active pillar, when applicable;
- left-rail visibility;
- right-rail guidance type;
- whether Save Draft is available;
- preferred central content width.

The four stages map as follows:

### 1. Choose the home

- Address entry and search remain the first interaction.
- Existing exterior-photo discovery, upload fallback and analysis-depth selection remain unchanged.
- The mobile-only `Open Desktop Version` control appears above MEASURING.

### 2. Document the home

- Property information, public records, permits, documents, photos and listing imports remain available.
- Superior documentation uses guided pillar groups with optional answers.
- The same field values and evidence review state appear in both presentations.
- Desktop displays one active pillar group at a time with Previous/Next movement; unanswered fields never block progression.
- Save Draft is a compact control at the top of the right guidance rail. Mobile retains its in-content control.

### 3. Review scores

- The overall score and seven pillar scores use the same result object as mobile.
- Score indicators use one graduated red-to-green scale so low scores cannot appear positive by color alone.
- A full-width `How Can I Improve this Score?` action opens the improvement stage without rescoring.

### 4. Explore recommendations

- Recommendations are stacked by priority in the central area.
- Each recommendation includes up to two relevant products from the existing product catalog.
- Premiere Partners appear first when they match the recommendation need; sponsorship does not make an irrelevant product eligible.
- Product cards show a thumbnail, brand and product type and open the existing full product detail/blurb.
- The initial demonstration pairs are:
  - Resilience: James Hardie fiber-cement siding, then a relevant roofing product.
  - Energy: Carrier heat-pump solution, then Nu-Wool insulation.
  - Water: Niagara efficient fixture, then Moen Flo leak monitor and shutoff.
- Mobile stacks each recommendation above a compact two-product row.

## Mode switching

### Mobile to desktop

`Open Desktop Version` is a button immediately above the MEASURING text. It changes `viewMode` in the current tab. It does not navigate to another application or serialize and reload calculator state.

### Desktop to mobile

`Return to mobile view` is placed in the desktop header. It restores the mobile shell around the same active screen and state.

### Persistence

Store only the presentation preference under a dedicated key. Existing draft and evaluation storage remain separate. A corrupted or unknown preference falls back to mobile.

### Restart

Restart returns to the original address-entry screen. It does not silently delete a saved draft or archived evaluation. Existing restart semantics remain authoritative for transient state cleanup.

## Responsive behavior

- Mobile mode retains the current phone-shell dimensions on wide preview canvases and the full-device treatment on narrow physical devices.
- Desktop mode targets laptop and larger browser widths.
- If desktop mode is selected at a narrow viewport, the desktop shell collapses rails before allowing overflow: right guidance moves below the central content, then the left rail collapses to a compact property header.
- Forms use two or three columns only when labels and controls remain readable; otherwise they reflow to one column.
- DOM order follows reading and keyboard order: header, stage navigation, property context, central task, guidance, footer actions.
- Touch targets remain at least 44px in mobile mode.

## Save Draft behavior

Both Save Draft controls call the same existing draft operation. Desktop places the control above `Why we’re asking`; mobile keeps it in the active task flow. Saving does not change screens. Success and failure feedback use the existing toast or error system and must be announced accessibly.

## Accessibility

- Mode-switch controls are real buttons with explicit labels.
- Active stages and active pillars expose programmatic current-state information.
- Score color is always paired with a numeric value and written interpretation.
- Product cards have meaningful image alternative text and visible keyboard focus.
- Mode switching moves focus to the active screen heading and does not strand focus in a removed shell.
- Reduced-motion preferences disable nonessential transitions.

## Error and edge handling

- Missing property images retain the existing fallback and upload path.
- Missing scores render the existing score-unavailable recovery rather than an empty desktop panel.
- Missing recommendations or products show the recommendation without fabricated product matches.
- Broken product images use the existing product-image fallback.
- An invalid stored `viewMode` value falls back to mobile.
- A shell-rendering error must not alter saved property data; the application error boundary should allow return to mobile mode when possible.

## Testing strategy

### Unit and contract tests

- Default mode is mobile when no preference exists.
- Valid stored mode is restored; invalid values fall back to mobile.
- Mode switching does not change `screen`, home values, evidence, result, selected pillar, selected recommendation, or selected product.
- Screen-to-desktop-context mapping covers every production screen.
- Restart returns to address entry without deleting saved drafts.
- Recommendation-to-product matching retains relevance and Premiere Partner ordering.

### Interaction tests

- Mobile start screen opens desktop mode from the footer link.
- Desktop returns to mobile mode from the header.
- Address search, Basic flow and Superior flow operate in both presentations.
- All seven pillar transitions work with unanswered fields.
- Save Draft works from both placements.
- Review scores opens from Full Review.
- Improvement Path opens from scores.
- Product cards open the existing product detail and return correctly.

### Visual verification

- Representative phone viewport.
- Existing 390px preview shell on a wide canvas.
- Laptop viewport around 1366×768.
- Larger desktop viewport.
- Long address, missing photo, incomplete evidence, low score, and product-image fallback states.

## Implementation boundaries

- Prefer extracting shell and context-map modules from `App.jsx` where that reduces coupling.
- Do not duplicate screen components or scoring logic.
- Keep backend API contracts unchanged unless a concrete desktop requirement proves otherwise.
- Preserve existing unrelated worktree changes and untracked QA assets.

## Deployment

1. Run the complete frontend test suite and production build.
2. Test mobile and desktop workflows locally against representative data.
3. Deploy through the existing GitHub-to-Render path.
4. Confirm the deployed commit and verify mode switching, address search, draft retention, scoring and recommendation/product navigation on the live URL.
5. Keep mobile as the default so deployment does not change the first-run experience for existing users.
