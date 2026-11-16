import pytest

from app.schemas import PropertyInput
from app.scoring.catalog import CustomField, Factor, ScoreModel, evaluate_model
from app.scoring.certifications import CertificationMigrationConflict, with_certification_features as migrate
from app.scoring.seed import seed_model_v1


def test_historical_model_is_unchanged_and_migration_is_idempotent():
    original = seed_model_v1()
    before = original.model_dump()
    migrated = migrate(original)
    assert original.model_dump() == before
    assert migrated.version == original.version + '-certifications-v1'
    assert migrated.certificationLibraryVersion == 'certifications-v1'
    assert original.certificationLibraryVersion is None
    again = migrate(migrated)
    assert again.model_dump() == migrated.model_dump()
    again.factors[0].options['Code-Minimum'] = 99
    assert migrated.factors[0].options['Code-Minimum'] == 40
    migrated.factors[0].options['Code-Minimum'] = 88
    assert original.model_dump() == before


@pytest.mark.parametrize('facts', [
    {},
    {'hers': '1-10', 'hvac': 'Heat Pump', 'solar': 'Solar PV + Battery'},
    {'carbonStrategy': 'Documented EPDs + CLF Benchmark', 'roof': 'Metal'},
    {'carbonStrategy': 'Partial Material Disclosure', 'ventilation': 'Balanced ventilation'},
    {'leak': 'Auto Shutoff', 'reuse': 'Rainwater', 'landscape': 'Drought Tolerant'},
])
def test_uncertified_physical_feature_baselines_are_unchanged(facts):
    model = seed_model_v1()
    home = PropertyInput(**facts)
    assert evaluate_model(home, migrate(model)) == evaluate_model(home, model)


@pytest.mark.parametrize('claims', [
    {'fortified': 'FORTIFIED Gold'}, {'fortified': 'Wildfire Prepared Home'},
    {'healthCert': 'EPA Indoor airPLUS'}, {'healthCert': 'WELL or Fitwel Residential'},
    {'waterStandard': 'WaterSense Home v2'}, {'waterStandard': 'HERS H2O'},
    {'waterStandard': 'WERS Rated'}, {'carbonStrategy': 'Zero Carbon Certified'},
])
def test_equal_effective_features_score_equally_regardless_of_certificates(claims):
    model = migrate(seed_model_v1())
    features = {'ventilation': 'Balanced ventilation', 'roof': 'Metal',
                'toilets': 'WaterSense', 'bathroomFaucets': 'WaterSense', 'showerheads': 'WaterSense'}
    plain = PropertyInput(**features)
    certified = PropertyInput(**features, **claims)
    assert evaluate_model(certified, model) == evaluate_model(plain, model)


@pytest.mark.parametrize('field,low_flow', [('toilets', 4), ('bathroomFaucets', 3), ('showerheads', 5)])
def test_fixture_categories_are_exclusive_and_have_no_count_multiplier(field, low_flow):
    model = migrate(seed_model_v1())
    for value, points in [('Unknown', 0), ('Standard', 0), ('Low-flow', low_flow), ('WaterSense', 5)]:
        home = PropertyInput(**{field: value}, bathrooms='9')
        assert evaluate_model(home, model)['water'] == 20 + points
    assert evaluate_model(PropertyInput(toilets='WaterSense', bathroomFaucets='WaterSense',
                                        showerheads='WaterSense'), model)['water'] == 35


def test_balanced_ventilation_and_erv_have_equal_single_credit_and_class_a_is_report_only():
    model = migrate(seed_model_v1())
    for value in ['Balanced ventilation', 'ERV', 'Balanced ERV']:
        assert evaluate_model(PropertyInput(ventilation=value), model)['health'] == 60
    assert evaluate_model(PropertyInput(roofFireRating='Class A'), model) == evaluate_model(PropertyInput(), model)
    assert not any(f.active and f.field == 'roofFireRating' for f in model.factors)


def test_renamed_certificate_lookup_is_migrated_by_field_preserving_custom_baseline():
    model = seed_model_v1()
    factor = next(f for f in model.factors if f.field == 'fortified')
    factor.id = 'admin_resilience'
    factor.default = 32
    factor.options = {'None': 32, 'FORTIFIED Gold': 100, 'FORTIFIED Silver': 70}
    migrated = migrate(model)
    for value in ['None', 'Unknown', 'FORTIFIED Gold', 'FORTIFIED Silver']:
        assert evaluate_model(PropertyInput(fortified=value), migrated)['resilience'] == 32


def test_unrelated_custom_rules_and_retired_rules_are_preserved():
    model = seed_model_v1()
    model.customFields.append(CustomField(id='custom_feature', label='Feature', pillar='health', kind='checkbox'))
    custom = Factor(id='custom_credit', label='Custom credit', pillar='health', field='custom_feature',
                    mode='equals', matches=['True'], points=7)
    retired = Factor(id='old_certificate', label='Retired certificate', pillar='health', field='healthCert',
                     mode='contains', matches=['Custom'], points=13, active=False)
    carbon = Factor(id='custom_carbon', label='Disclosure', pillar='carbon', field='carbonStrategy',
                    mode='equals', matches=['Partial Material Disclosure'], points=4)
    model.factors.extend([custom, retired, carbon])
    migrated = migrate(model)
    for expected in [custom, retired, carbon]:
        assert next(f for f in migrated.factors if f.id == expected.id) == expected
    assert migrated.customFields == model.customFields
    home = PropertyInput(extraInputs={'custom_feature': True}, carbonStrategy='Partial Material Disclosure')
    assert evaluate_model(home, migrated) == evaluate_model(home, model)


@pytest.mark.parametrize('factor', [
    Factor(id='custom_cert', label='Custom health', pillar='health', field='healthCert',
           mode='contains_any', matches=['Indoor', 'None'], points=12),
    Factor(id='custom_cert', label='Custom carbon', pillar='carbon', field='carbonStrategy',
           mode='contains', matches=['Carbon'], points=12),
    Factor(id='custom_cert', label='Custom baseline', pillar='water', field='waterStandard',
           mode='lookup', options={'Code-Minimum': 10, 'WaterSense Home v2': 30}, default=20),
    Factor(id='custom_cert', label='Mixed physical and certificate', pillar='health', field='healthCert',
           mode='lookup', options={'None': 0, 'EPA Indoor airPLUS + ERV': 30}),
    Factor(id='toilets', label='ID collision', pillar='water', field='leak',
           mode='equals', matches=['Auto'], points=9),
])
def test_ambiguous_custom_rules_raise_explicit_conflict_without_mutation(factor):
    model = seed_model_v1()
    model.factors.append(factor)
    before = model.model_dump()
    with pytest.raises(CertificationMigrationConflict, match=factor.id):
        migrate(model)
    assert model.model_dump() == before


def test_legacy_metadata_defaults_to_none_and_round_trips():
    model = ScoreModel.model_validate(seed_model_v1().model_dump(exclude={'certificationLibraryVersion'}))
    assert model.certificationLibraryVersion is None
    migrated = migrate(model)
    assert ScoreModel.model_validate_json(migrated.model_dump_json()) == migrated
