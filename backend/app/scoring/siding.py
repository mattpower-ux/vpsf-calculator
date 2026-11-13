from app.scoring.catalog import Factor, ScoreModel

SIDING_SUFFIX = "-noncombustible-siding"


def with_noncombustible_siding(model: ScoreModel) -> ScoreModel:
    model = model.model_copy(deep=True)
    if not any(f.id == "noncombustible_siding" for f in model.factors):
        model.factors.append(Factor(id="noncombustible_siding", label="Noncombustible siding", pillar="resilience", field="siding", mode="equals", points=30, matches=["Fiber cement", "Brick", "Stucco", "Metal", "Noncombustible"]))
    if not model.version.endswith(SIDING_SUFFIX):
        model.version += SIDING_SUFFIX
    return model
