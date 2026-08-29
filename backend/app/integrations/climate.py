HOT_HUMID_STATES = {"FL", "LA", "MS", "AL", "GA", "SC", "HI"}
MIXED_HUMID_STATES = {"NC", "TN", "AR", "KY", "VA", "MD", "DE", "NJ", "MO", "IL", "IN", "OH", "WV", "PA", "DC"}
MARINE_STATES = {"CA", "OR", "WA"}
COLD_STATES = {"ME", "NH", "VT", "MA", "RI", "CT", "NY", "MI", "WI", "MN", "ND", "SD", "MT", "WY", "ID"}
DRY_STATES = {"AZ", "NM", "NV", "UT", "CO"}


def estimate_climate_zone(state: str, zip_code: str = "") -> str:
    state = (state or "").upper()
    zip_code = zip_code or ""

    if state == "FL":
        return "2A - Hot Humid"
    if state == "TX":
        if zip_code.startswith(("75", "76", "79")):
            return "3A - Warm Humid"
        if zip_code.startswith(("77", "78")):
            return "2A - Hot Humid"
        return "3A - Warm Humid"
    if state in HOT_HUMID_STATES:
        return "3A - Warm Humid"
    if state in MIXED_HUMID_STATES:
        return "4A - Mixed Humid"
    if state in MARINE_STATES:
        return "3C - Marine"
    if state in COLD_STATES:
        return "5A - Cool Humid"
    if state in DRY_STATES:
        return "3B - Warm Dry"
    return "Unknown"
