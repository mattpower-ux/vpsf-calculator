# Automatic Property Photo Evidence

**Date:** November 26, 2026  
**Status:** Approved architecture and Render-disk storage design

## Purpose

VPSF should automatically find useful photos after a user enters a property address, use those photos to fill visible gaps in the home record, and still let the homeowner supply better evidence. The workflow must reduce user effort without silently analyzing the wrong property or creating a permanent VPSF copy of third-party listing photography.

Success means:

- An exact-address search usually finds relevant exterior and listing photos when reputable public sources expose them.
- Users see the automatically found photos and their sources before analysis.
- Users can exclude incorrect images.
- Homeowner-added images override automatically found images for the same evidence category.
- Public images are fetched only for transient processing; VPSF stores their source metadata and derived findings, not the image files.
- Homeowner-added images are stored with the archived property record and can be reused in later analyses.
- The selected analysis level and property address remain visible throughout the analysis workflow.
- Existing VPSF scoring rules remain unchanged. Photos supply evidence; they do not create a scoring bonus.

## Scope

This project covers automatic photo discovery, candidate validation, photo review, evidence prioritization, transient analysis of public images, durable storage of homeowner images, archive integration, and persistent workflow context.

It does not bypass logins, CAPTCHAs, robots restrictions, paywalls, or provider access controls. It does not permanently copy public listing photos, claim ownership of them, or treat appearance alone as proof of hidden performance characteristics.

## User Experience

### Address search

After address normalization and property matching, VPSF starts photo discovery alongside permits and other public-record enrichment. The initial calculation flow does not wait indefinitely for photos. It shows a bounded loading state and proceeds when discovery is unavailable.

### Review found photos

The **Analyze my Photos** dialog contains two groups:

1. **Photos found for this property** — source-labeled thumbnails selected for analysis by default.
2. **Your photos** — camera, upload, and video controls for homeowner evidence.

Each automatic thumbnail shows its provider and a link to the source page. Users can exclude a candidate before processing. Automatic photos are never presented as homeowner uploads.

If the system cannot establish a high-confidence property match, it shows no candidate rather than displaying a potentially incorrect home.

### Evidence priority

The evidence order is:

1. Homeowner photo with a readable product label or model plate.
2. Other homeowner photo.
3. Exact-address public photo from a trusted source.
4. Existing public record or inferred value, according to the current field-level provenance rules.

When a homeowner image covers a category already represented by a public image, the homeowner image replaces the public image for that category. It does not erase public-source provenance for unrelated categories.

### Processing and review

Selecting **PROCESS** analyzes the chosen automatic photos and homeowner photos together. The existing cognition processing screen remains in place. The resulting facts open in the current review workflow so users can confirm or correct them before scoring.

Findings identify their evidence source as **Homeowner photo** or **Public listing photo — [provider]**. Appearance-based findings remain reviewable observations unless a readable label or supporting record establishes a specific product or performance claim.

### Persistent context

Every analysis screen displays a compact context line directly below the analysis-level label:

`3. Superior · 2256 Fallen Tree Drive E, Jacksonville, FL 32246`

The component uses the normalized display address, wraps cleanly on phones, and does not compete with screen headings. It appears on data-entry, evidence, processing, review, scoring, and recommendation screens.

## Architecture

### 1. Photo discovery service

The backend owns discovery so provider credentials, request controls, and validation rules are not exposed to the browser. Discovery starts with the normalized property identity already produced by the address flow.

Sources are attempted in this order when configured and legally accessible:

1. Licensed or authorized property/listing feeds.
2. Municipal assessor or property-record imagery.
3. Google Street View metadata/static imagery.
4. Exact-address public listing and brokerage pages discovered through the configured crawler/search service.
5. Other trusted real-estate domains on the maintained provider allowlist.

Provider adapters return a common `PhotoCandidate` model:

```text
candidate_id
property_identity
source_provider
source_page_url
remote_image_url
photo_kind_hint
width
height
discovered_at
match_confidence
match_evidence
```

Candidate IDs are opaque, short-lived references. Remote image URLs are not accepted back from the browser as trusted values.

### 2. Exact-address validation

A candidate is eligible only when its source page or licensed record matches:

- exact house number;
- normalized street name and directional suffix;
- city plus state, or ZIP code;
- unit identifier when the entered property includes one.

House-number prefixes, nearby properties, neighborhood pages, search-result collages, logos, maps, floor plans, agent portraits, and unrelated units are rejected. Matching evidence and provider results are logged without recording image bytes or private credentials.

### 3. Candidate quality and deduplication

The service removes duplicate image URLs and perceptually duplicate thumbnails within one discovery session. It favors landscape images of useful size and ranks likely front exterior, roof, siding, landscaping, HVAC, kitchen, bath, windows, and flooring views.

The initial interface shows no more than 12 candidates. Provider diversity is preferred when multiple sources expose the same image.

### 4. Transient treatment of public photos

Public image bytes are fetched only when generating the review thumbnail or running analysis. They remain in bounded process memory and are discarded after the response or analysis job. VPSF does not write them to its database, archive, object storage, filesystem, CDN, or backups.

The persistent property record may store:

- source provider;
- source page URL;
- discovery timestamp;
- selected/excluded state for the current analysis;
- derived observations and field provenance.

It must not store the public remote image URL as a durable substitute for an owned asset because those URLs expire and encourage hotlinking. A short-lived server-side discovery session may retain it long enough to complete review and processing.

### 5. Persistent treatment of homeowner photos

Homeowner uploads are validated, stripped of unnecessary metadata, normalized, and stored beneath the VPSF API service's Render persistent-disk mount. The database stores an opaque asset identifier, hashed capability token, normalized property identity, relative disk path, category, upload time, MIME type, dimensions, checksum, byte count, last-access time, and analysis provenance. The browser-local property archive stores only the asset identifier, unguessable access token, and safe display metadata.

The Render disk is mounted at `/var/data`. Photos use the dedicated `/var/data/vpsf-photos` subdirectory, exposed to the application as `PHOTO_STORAGE_PATH`. No code may write durable photos outside that subdirectory. Files use generated names and sharded subdirectories; user filenames never become filesystem paths. Other persistent VPSF data must use separate named subdirectories beneath `/var/data`.

Images remain attached to the archived property until the user deletes the image or removes the linked property archive. Deletion removes the database record and disk file. Replacing an image retains the earlier asset only while another archived evaluation still references it. Because clearing browser data cannot notify the server, unreferenced or inactive assets expire after the configurable retention period; the first-version default is 365 days after last authorized access.

Initial limits remain 12 selected images per analysis, JPEG/PNG input, and the existing safe file-size limits. HEIC support can be added later as a separately tested conversion feature.

### 6. Analysis orchestration

The browser builds a single analysis request from selected public candidate IDs and disk-backed homeowner asset capabilities. The backend resolves both types, reads homeowner images only from the configured mount, batches the evidence through the image-analysis service, and releases temporary buffers after each batch.

Each finding carries:

```text
field
suggested_value
confidence
evidence_type
evidence_reference
source_provider
requires_confirmation
```

The existing field allowlist, conflict handling, and homeowner review remain authoritative. Public images cannot overwrite an existing homeowner-confirmed value without explicit review.

### 7. Archive integration

Archived properties persist homeowner asset capabilities and confirmed findings in the browser-local archive. Public candidates themselves are not archived. An archived report may retain the public source citation and the observation derived from it.

Opening an archive shows the saved homeowner thumbnails and can run a fresh automatic discovery to check for newer public evidence. A new discovery never silently changes a previously scored report.

## API Boundaries

Exact route names may follow existing router conventions, but responsibilities remain separate:

- **Discover photos:** accepts normalized property identity and returns safe candidate metadata plus short-lived candidate IDs.
- **Preview candidate:** validates the candidate session, fetches a bounded public image, and returns a no-store thumbnail response.
- **Upload homeowner photo:** validates the multipart image, writes it atomically beneath `PHOTO_STORAGE_PATH`, creates database metadata, and returns an asset capability.
- **Read homeowner photo:** validates the capability and returns a private, no-store image response.
- **Analyze photo evidence:** accepts public candidate IDs plus homeowner asset capabilities, then returns reviewable findings.
- **Delete homeowner photo:** validates the capability, removes the database record, and unlinks the disk file.

Every homeowner-asset and public-thumbnail response uses `Cache-Control: private, no-store`. Capability tokens are never logged and are stored only in the browser-local archive.

## Security, Privacy, and Provider Controls

- Allow HTTPS only.
- Resolve and pin public destinations to block SSRF, private IPs, redirects to private networks, oversized responses, and unsupported MIME types.
- Maintain provider allowlists and per-provider adapters rather than crawling arbitrary user-supplied URLs.
- Enforce download, redirect, dimension, byte, time, and concurrency limits.
- Do not send provider cookies, user sessions, or login credentials.
- Do not bypass CAPTCHAs, paywalls, or robots restrictions.
- Never log image bytes, capability tokens, API keys, or absolute disk paths.
- Strip image metadata from homeowner uploads before disk storage unless a future feature explicitly needs it.
- Present clear copy that homeowner uploads are saved with the property archive and can be deleted.

## Failure Handling

- **No candidates:** continue without photos and offer camera/upload controls.
- **Low-confidence match:** suppress the candidate and record a non-user-facing diagnostic reason.
- **Provider blocks access:** skip that provider; do not retry aggressively or bypass controls.
- **Candidate expires before processing:** offer a refresh while retaining homeowner images.
- **One image fails:** continue with the remaining selected images and identify the skipped item.
- **Analysis times out:** preserve homeowner uploads and the current selection so the user can retry.
- **Disk unavailable or full:** do not imply that a homeowner image was saved; retain it only in the current browser session and show a clear retry message.

## Data and Scoring Rules

Photo evidence populates or suggests existing fields only. No score points are awarded for selecting Superior, finding more photos, uploading images, or using a particular source. Scores change only when existing VPSF feature rules receive supported values.

Certification, permit, document, public-photo, and homeowner-photo evidence continue to use field-level provenance. When evidence conflicts, homeowner-confirmed values and readable product documentation take precedence, while the conflict remains reviewable.

## Testing

### Backend

- Exact-address acceptance across suffix and directional variations.
- Rejection of neighboring addresses, unit mismatches, house-number prefixes, and untrusted domains.
- Candidate ranking, deduplication, bounded attempts, and provider fallback.
- Public image bytes never reach persistent storage.
- Homeowner images are written atomically beneath the configured mount, capability-protected, retrieved, replaced, reference-counted, expired, and deleted correctly.
- SSRF, redirects, MIME, dimensions, byte limits, timeouts, and partial-provider failures.
- Evidence precedence and provenance in mixed public/homeowner batches.

### Frontend

- Automatic thumbnails display provider labels and source links.
- Users can exclude automatic candidates.
- Homeowner uploads replace the relevant automatic category.
- PROCESS works with automatic-only, homeowner-only, and mixed evidence.
- Address and analysis level persist on all applicable screens.
- Archive reopening restores homeowner images but refreshes public candidates separately.
- Loading, empty, blocked-provider, expired-candidate, upload-failure, and timeout states.

### Device verification

Run the full Basic, Informed, and Superior flows at phone and laptop widths. Verify thumbnail selection, camera/upload controls, processing, review, scoring, archive reopening, deletion, and keyboard/screen-reader navigation.

## Rollout and Observability

Ship behind a backend feature flag. Start with trusted sources that already have stable adapters. Track aggregate, non-image metrics:

- discovery success by provider;
- exact-match rejection reasons;
- candidates shown and selected;
- transient fetch failures;
- homeowner upload/storage failures;
- analysis completion and correction rates.

Do not record the photographs themselves in diagnostics. After live verification on a varied address set, enable the flow for all users and retain the manual-photo fallback.

## Render Disk Operations

The 1 GB disk is attached only to the paid VPSF API web service at `/var/data`. Render disks are single-service, single-instance storage and disable horizontal scaling and zero-downtime deploys. A deployment will briefly stop the API before the replacement instance starts. Builds, pre-deploy commands, one-off jobs, and the frontend service cannot access the disk.

Start with the smallest practical capacity and monitor usage; Render permits increasing disk size but not decreasing it. Render currently creates encrypted daily snapshots retained for seven days, but snapshots restore the entire disk rather than individual files. Database metadata and disk files therefore require a reconciliation command that runs inside the API process, not during build or pre-deploy.

## Implementation Preconditions

Before enabling durable uploads, confirm the disk remains attached to the VPSF API service at `/var/data` and configure `PHOTO_STORAGE_PATH=/var/data/vpsf-photos`. Verify runtime creation of the photo subdirectory plus write/read/delete behavior after the deployment becomes live. The interface must disclose that photos are stored privately with the property archive and retained according to the configured policy.
