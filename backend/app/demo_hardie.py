"""Repeatable presentation scenario; assumptions are not property inspection facts."""
from app.schemas import PropertyInput, WildfireRisk


def hardie_demo_home():
    assumed = dict(climateZone="Unknown", siding="Wood clapboard", roof="Asphalt shingles", roofAge="20 years", fortified="None", wildfireMitigation="None", flood="Unknown", moisture="Unknown", backup="None", temperatureProtection="Unknown", windProtection="Unknown")
    recorded = dict(address="53017 Double View Lane", city="Idyllwild", state="CA", zip="92549", yearBuilt="1982", squareFeet="2593", bedrooms="3", bathrooms="2", lotSize="0.52 acres", solar="Solar PV")
    provenance = {k:dict(origin="demo-assumption",source="Presentation scenario supplied by VPSF; not an inspection",date="2026-11-13") for k in assumed}
    provenance.update({k:dict(origin="demo-assumption",source="Fictional VPSF demonstration home in the Idyllwild neighborhood",date="2026-11-13") for k in recorded})
    return PropertyInput(**recorded, **assumed, demoScenario="hardie-wildfire", provenance=provenance,
        latitude=33.729507,longitude=-116.736539,
        wildfire=WildfireRisk(status="available",level="Very High",nationalPercentile=99.9,areaName="Idyllwild-Pine Cove CDP, CA",areaId="0636203",areaType="community",boundaryVintage="2023",latitude=33.729507,longitude=-116.736539,retrievedAt="2026-11-13T17:59:14+00:00"),
        sourceNote="Home details supplied for this evaluation. USFS wildfire exposure describes the surrounding Idyllwild-Pine Cove community, not the likelihood that this individual home will burn. Regional data checked November 13, 2026.")
