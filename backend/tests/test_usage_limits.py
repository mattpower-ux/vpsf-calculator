from app.db import SessionLocal, init_db
from app.repositories import get_api_usage, reserve_api_call


def test_reserve_api_call_respects_monthly_limit():
    init_db()
    provider = "rentcast-test"

    with SessionLocal() as db:
        first = reserve_api_call(db, provider, monthly_limit=1)
        second = reserve_api_call(db, provider, monthly_limit=1)
        usage = get_api_usage(db, provider)

    assert first.count == 1
    assert second.count == 1
    assert usage.count == 1


def test_attom_usage_uses_independent_monthly_counter():
    init_db()

    with SessionLocal() as db:
        reserve_api_call(db, "attom", monthly_limit=100)
        attom_usage = get_api_usage(db, "attom")
        rentcast_usage = get_api_usage(db, "rentcast-test-isolated")
        attom_count = attom_usage.count
        rentcast_count = rentcast_usage.count

    assert attom_count >= 1
    assert rentcast_count == 0
