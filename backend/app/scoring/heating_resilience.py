from app.scoring.catalog import Factor, ScoreModel


UPGRADE_SUFFIX = "-heating-resilience"


def with_heating_resilience(model: ScoreModel) -> ScoreModel:
    """Add editable policy defaults without replacing existing admin weights."""
    model = model.model_copy(deep=True)
    additions = [
        Factor(id="hr_hydronic_carbon", label="Hydronic heat source carbon ranking", pillar="carbon",
               field="hydronicSource", mode="lookup", options={"Heating Oil": 0, "Natural Gas": 5, "Air-to-Water Heat Pump": 10, "Ground-Source Heat Pump": 15}),
        Factor(id="hr_hydronic_energy", label="Ground-source hydronic heat pump", pillar="energy",
               field="hydronicSource", mode="lookup", options={"Air-to-Water Heat Pump": 10, "Ground-Source Heat Pump": 10}),
        Factor(id="hr_condensing_boiler", label="Condensing boiler, documented AFUE 90%+", pillar="energy",
               field="hvac", mode="lookup", options={"Condensing Boiler (AFUE 90%+)": 5, "Condensing Combination Boiler (AFUE 90%+)": 5}),
        Factor(id="hr_heating_controls", label="Hydronic zoning and outdoor-reset controls", pillar="energy",
               field="heatingControls", mode="lookup", options={"Outdoor Reset": 3, "Zoning + Outdoor Reset": 5}),
        Factor(id="hr_wildfire_mitigation", label="Property wildfire mitigation", pillar="resilience",
               field="wildfireMitigation", mode="lookup", options={"Defensible Space": 5, "Ember-Resistant Vents": 5, "Ember Hardening + Defensible Space": 10}),
        Factor(id="hr_temperature_protection", label="Extreme-temperature envelope protection", pillar="resilience",
               field="temperatureProtection", mode="lookup", options={"Air Sealing": 5, "Insulation Upgrade": 5, "Air Sealing + Insulation": 10}),
        Factor(id="hr_wind_protection", label="Wind and tornado protection", pillar="resilience",
               field="windProtection", mode="lookup", options={"Rated Opening Protection": 5, "Engineered Continuous Load Path": 5, "FEMA / ICC Safe Room": 10}),
    ]
    existing = {factor.id for factor in model.factors}
    model.factors.extend(factor for factor in additions if factor.id not in existing)
    model.version += UPGRADE_SUFFIX
    return ScoreModel.model_validate(model.model_dump())
