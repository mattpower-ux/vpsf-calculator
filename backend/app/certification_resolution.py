"""One resolution path for score, advice, previews and historical models."""
from app.certifications import resolve_certifications
from app.certification_store import load_library
from app.schemas import PropertyInput, FieldProvenance


def resolve_home(home: PropertyInput, model, db):
    raw = home.model_dump(mode='json')
    if not model.certificationLibraryVersion:
        return home.model_copy(deep=True), {'libraryVersion': None, 'derivedFeatures': [], 'recognitions': [], 'conflicts': []}
    resolved = resolve_certifications(raw, load_library(db, model.certificationLibraryVersion))
    effective = PropertyInput.model_validate(resolved.pop('effectiveInput'))
    for feature in resolved['derivedFeatures']:
        field = feature.get('target', feature.get('field'))
        effective.provenance[field] = FieldProvenance(origin='inferred', source='Certification: ' + feature['programId'], date=feature.get('issuedDate') or '')
    return effective, resolved
