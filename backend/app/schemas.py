from pydantic import BaseModel, Field


class PropertyInput(BaseModel):
    address: str = ""
    city: str = ""
    state: str = ""
    zip: str = ""
    squareFeet: str = ""
    yearBuilt: str = ""
    homeType: str = "Single Family Detached"
    stories: str = "1"
    bedrooms: str = ""
    bathrooms: str = ""
    garage: str = ""
    lotSize: str = ""
    climateZone: str = ""
    occupancy: str = "Owner Occupied"
    hvac: str = "Unknown"
    waterHeater: str = "Unknown"
    roof: str = "Unknown"
    windows: str = ""
    insulation: str = ""
    solar: str = "None"
    hers: str = "Code-Minimum"
    evReady: str = "None"
    fortified: str = "None"
    flood: str = "Unknown"
    moisture: str = "Unknown"
    backup: str = "None"
    healthCert: str = "None"
    ventilation: str = "None / Unknown"
    materials: str = "Unknown"
    iaq: str = "None"
    daylighting: str = "Standard"
    carbonStrategy: str = "No Accounting"
    carbonConcrete: str = "Unknown"
    structure: str = "Unknown"
    waterStandard: str = "Code-Minimum"
    leak: str = "None"
    reuse: str = "None"
    landscape: str = "Standard Landscaping"
    pietim: str = "30-35%"
    insurance: str = "None / Unknown"
    warranty: str = "Unknown"
    maintenance: str = "None"
    walkscore: str = "Unknown"
    transit: str = "None / Unknown"
    greenspace: str = "None / Unknown"
    amenities: str = "None"
    bike: str = "None / Unknown"
    sourceNote: str | None = None


class ListingImportRequest(BaseModel):
    source: str = Field(pattern="^(mls|zillow|realtor|redfin)$")
    address: str | None = None
    listingId: str | None = None
    url: str | None = None


class ScoreResponse(BaseModel):
    scores: dict[str, int]
    total: int
    grade: str
    label: str
    meaning: str
    modelVersion: str
    explanations: dict[str, str] = Field(default_factory=dict)
    confidence: int = 60
    propertyId: int | None = None
    scoreRunId: int | None = None


class ProductRecommendation(BaseModel):
    id: str
    brand: str
    product: str
    pillar: str
    category: str
    weight: str = "Standard"
    summary: str = ""
    imageUrl: str | None = None


class LeadRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    role: str | None = None
    productId: str | None = None
    propertyAddress: str | None = None
    zip: str | None = None
    action: str = "Requested info"


class LeadResponse(BaseModel):
    id: int
    status: str = "accepted"


class AdminSummary(BaseModel):
    properties: int
    scoreRuns: int
    products: int
    leads: int
