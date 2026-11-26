# Automatic property photo evidence QA

## Automated checks

- Backend discovery, transient preview, and disk-asset tests: 16 focused tests passed.
- Frontend photo manifest, persistent context, Basic tradeoff copy, and production build passed.
- Full frontend suite: 258 tests; the only initial failure was Help point length, corrected and rechecked.

## Storage and privacy

- Automatic public candidates retain metadata only and previews use `private, no-store`.
- Homeowner files are decoded and re-encoded to remove metadata before disk storage.
- Browser-held capabilities are hashed in the database and are required for read/delete.
- Render storage root: `/var/data/vpsf-photos` on the existing 1 GB VPSF API disk.

## Deployment checks pending

- Phone and laptop review of automatic-only, homeowner-only, and mixed selections.
- Runtime write/read/delete beneath the Render mount.
- Exact-address discovery checks for three properties in different states.
