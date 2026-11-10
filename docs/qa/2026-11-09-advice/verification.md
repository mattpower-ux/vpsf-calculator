# Advice, product matching and Eco-Tips release

## Scope
Four evidence-aware Key Takeaway sections; canonical product matching and pillar/category filters; explicit sponsorship; 28 sourced Eco-Tips and authenticated draft/publish/retire/restore tools. No scoring weights changed. Irrigation is now explicitly collected for advisory matching, separate from landscaping and scoring.

## Verification
- Backend: 142 tests passed, including compatibility, unknown provenance, efficient equipment, authenticated writes, revision conflicts and tip lifecycle.
- Frontend: 85 tests passed; production build passed (existing large-bundle advisory remains).
- Independent review: four P2 findings fixed: confirmed Unknown compatibility, efficient-boiler replacement, missing irrigation input, and catalog return state.
- Local browser: 390 x 844 phone and 1366 x 768 laptop. Four takeaways show street address and evidence; old roof and conventional irrigation identified from explicit inputs. No horizontal overflow observed.
- Catalog directory -> Browse All -> detail -> Return preserves full catalog. Water filter shows irrigation match instead of unrelated boilers. Sponsorship label verified from local admin metadata update.
- Local admin: draft save, publish, retire, restore verified. Drafts remain private; published version recovery restores the feed.
- Production backend ff6acc1 verified: 28 published tips, four takeaway pillars, current scoring model version. Efficient boiler/no irrigation returns no replacement matches.

## Deployment and recovery
Backend deployed first. Additive product_advice and eco_tips tables only; existing score runs and leads remain in their existing tables. Render SQLite startup makes a one-time consistent backup beside the production database before adding these tables. Application rollback can return to 1e10f88 while leaving additive tables in place. Tip revisions can be restored in admin.

## Editorial limits
Unreviewed specifications and installation compatibility are explicitly marked Needs verification. Legacy products are not presumed sponsored. Admin must explicitly designate sponsorship. No manufacturer messages are sent; inquiry routing remains through VPSF admin.

## Live release verification
- API Render deployment dep-dbp5mq942hec73d4gfrg live; frontend dep-dbp5nrlg1s2s73c11jgg live at ff0adff.
- WordPress embed: live pillar/category controls, catalog detail navigation, sourced Eco-Tips and changed tip on Menu reentry verified. Sections reset collapsed.
- Live phone-width catalog and laptop menu screenshots inspected. Local personalized takeaway and recommendation flows verified at both viewport sizes.
- Local PDF download completed and UI confirmed download. Existing report tests pass; no new visual PDF redesign in this release.
- Sara's three corresponding punchlist items updated after live verification on November 9, 2026.
