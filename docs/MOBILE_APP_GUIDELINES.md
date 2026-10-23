# VPSF Mobile App Guidelines

Saved October 23, 2026, at Matt's request. These are planning guidelines, not authorization to begin implementation or change the live website. Platform requirements should be verified when work resumes.

## Options

| Approach | User experience | Relative effort |
| --- | --- | --- |
| Progressive Web App (PWA) | Installable website with a home-screen icon and app-like presentation; installation capabilities vary by browser and platform | Lowest |
| Packaged mobile app | iPhone/Android app reusing the calculator and backend, with mobile-specific improvements | Moderate |
| Fully native app | Separately built mobile interface | Highest; probably unnecessary initially |

## Recommended Direction

First make the existing calculator feel native on phones, then make it installable. Consider packaging for App Store and Google Play distribution afterward if store availability is important.

Keep the website and mobile app on a shared scoring backend to avoid divergent results. Preserve the live website and scoring logic during the initial prototype.

## Shared Feature Requirement

All future calculator improvements must carry through to phone, tablet, and laptop layouts. Use the same React screens, inputs, validation, content, API client, scoring, and recommendations; responsive CSS changes presentation only. Do not fork a mobile calculator or duplicate business logic. Verify new workflows at phone, tablet, and desktop sizes before release.

The approved phone layout activates on devices whose shorter screen dimension is 600px or less, with CSS scoped to viewport widths of 600px or less. This avoids activating the phone layout inside narrow desktop embeds. Development previews can opt in with `?phonePreview=1`. Tablet and laptop layouts remain unchanged. This is not an installed app and does not add offline support or new persistence behavior.

## Mobile Experience

- Fill the phone screen without a decorative phone border.
- Respect notches, safe areas, the software keyboard, and phone navigation.
- Make photo uploads, document capture, and video playback comfortable.
- Preserve unfinished evaluations and handle interrupted connections.
- Clearly distinguish saved information from calculations requiring the server.
- Scope offline support explicitly: saved results may be available offline; property lookups and current server-side scoring still require connectivity.

## Work Codex Can Handle

- Audit the existing code and propose an implementation architecture.
- Build a local prototype and adapt the mobile interface.
- Implement installation support and automated tests.
- Prepare mobile builds and store submission materials, subject to access to required tooling.
- Maintain a shared scoring backend for web and mobile.

## Matt's Responsibilities

- Own developer accounts and complete enrollment, payments, and agreements.
- Handle credentials, signing approvals, and account verification.
- Decide privacy, support, and any paid-feature policies.
- Perform a short round of testing on actual phones.
- Approve public release.

## Constraints and Next Milestone

iPhone store builds require access to Apple's build and signing tooling through a Mac or an appropriate hosted build service. Store acceptance is not guaranteed. Verify current platform rules, hosting capabilities, costs, and review requirements before implementation.

Proposed first milestone: a working, installable phone prototype using the existing calculator, with no scoring-logic changes and no disruption to the live website.

Use the existing repository and GitHub/project-host deployment workflow. Do not use OpenAI Sites unless Matt explicitly requests it.
