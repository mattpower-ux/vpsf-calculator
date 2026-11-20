"""Build the portable editorial manifest from reviewed annual research files.

Run from the repository root. No network or live database writes.
"""
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, unquote

ROOT = Path(__file__).resolve().parents[2]
BRANDS = {'KitchenAid (Whirlpool)':'KitchenAid','LG Electronics':'LG','LP Building Solutions':'LP','Nichiha USA':'Nichiha','Mohawk Flooring':'Mohawk','DalTile':'Daltile','KOHLER':'Kohler','Florim USA / MILEstone':'MILEstone','MILEstone (Florim USA)':'MILEstone'}
TAG_ALIASES = {'battery-storage':'battery','energy-monitoring':'energy-management','electrical-load-management':'energy-management','greywater':'graywater','greywater-reuse':'graywater','dishwashing':'dishwasher','solar-generation':'solar','solar-hot-water':'water-heating','thermostats':'smart-thermostat','windows-doors':'windows','low-carbon-concrete':'low-carbon-materials'}
ALLOWED_TAGS = {'heating','water-heating','irrigation','leaks','fixtures','rainwater','ventilation','roofing','fire-resistant-siding','insulation','air-sealing','windows','solar','battery','energy-management','lighting','appliances','water-treatment','graywater','low-carbon-materials','smart-thermostat','ember-protection','storm-protection','moisture-control','ev-charging','toilets','faucets','showerheads','dishwasher'}
CATEGORY_GROUPS = {
 'Appliances': ['Induction Range','Washer-Dryer','Laundry','Refrigeration','Cooking'],
 'Heat Pumps': ['Heat Pump','Hydronic Heating and Cooling','Air-to-Water Heat Pump','Air Handlers'],
 'Fixtures': ['Toilet','Sink','Bidet Seat'],
 'Water Reuse': ['Greywater Reuse'],
 'Leak Protection': ['Leak Detection','Leak Detection and Shutoff'],
 'Energy Management': ['Heating Controls','Energy Monitoring','Building HVAC Controls','Home Energy Management','Electrical Panels','Thermostat'],
 'Battery Storage': ['Home Battery Storage','Solar and Storage'],
 'Insulation': ['Cellulose Insulation','Insulated Framing','Insulated Sheathing','Insulation and Weather Barrier','Framing and Air Sealing','Structural Insulated Panels','Insulated Backer Board'],
 'Windows and Doors': ['Windows','Doors','Impact Glazing','Automated Window Shading','Skylights','Ventilated Interior Door'],
 'Ventilation': ['Ventilation','Ventilation Controls','HVAC Air Filtration','Energy Recovery Ventilation','Air Filtration','Dehumidification'],
 'Flooring and Surfaces': ['Resilient Flooring','Countertops and Surfaces','Countertops','Carpet Tile and Rugs','Porcelain Tile','Tile Flooring','Wall Tile','Floor and Wall Tile','Flooring','Surfaces'],
 'Paints and Finishes': ['Interior Paint','Paint','Wood Floor Finish','Upholstery','Acoustic Wall Coverings','Wall Protection','Wall Panels'],
 'Siding': ['Siding and Trim','Siding Installation'],
 'Decking and Lumber': ['Composite Decking','Decking','Thermally Modified Lumber','Siding and Decking','Wood Substitute'],
 'Solar': ['Solar Panels','Solar Roofing','Solar Canopy','Solar Charging'],
 'Roofing': ['Architectural Zinc Roofing and Cladding'],
 'Fire Protection': ['Fire-Resistant Sheathing','Fire-Resistant Wall Material','Fire Suppression'],
 'Structure and Materials': ['Low-Carbon Cement','Deck Framing','Steel Framing','Concrete Additive','Concrete Additives','Masonry','Drywall Finishing','Retaining Walls','Cabinet Supports'],
 'Landscaping and Drainage': ['Fencing','Pavers','Permeable Paving'],
 'Lighting': ['LED Lighting','Lighting and Air Distribution'],
 'Design and Tools': ['Carbon Design Software','Tool Accessories'],
}
CATEGORIES = {item:group for group,items in CATEGORY_GROUPS.items() for item in items}
CHECKS = {'heating':'space-and-electrical','water-heating':'space-and-electrical','irrigation':'irrigation','leaks':'fixture-fit','fixtures':'fixture-fit','toilets':'fixture-fit','faucets':'fixture-fit','showerheads':'fixture-fit','dishwasher':'appliance-fit','rainwater':'reuse-code','graywater':'reuse-code','ventilation':'ventilation-design','roofing':'roof-design','fire-resistant-siding':'siding-assembly','insulation':'envelope-design','air-sealing':'envelope-design','windows':'window-fit','solar':'solar-design','battery':'battery-design','energy-management':'controls-compatibility','lighting':'appliance-fit','appliances':'appliance-fit','water-treatment':'water-quality','low-carbon-materials':'material-assembly','smart-thermostat':'controls-compatibility','ember-protection':'ember-design','storm-protection':'storm-design','moisture-control':'moisture-design','ev-charging':'ev-electrical'}

def slug(text):
    text=unicodedata.normalize('NFKD',text).encode('ascii','ignore').decode().lower()
    return re.sub('[^a-z0-9]+','-',text).strip('-')[:115]

def https(url):
    p=urlsplit(url.strip().replace('%C2%A0',''))
    return urlunsplit(('https',p.netloc,p.path or '/',p.query,''))

def identity(row):
    brand=BRANDS.get(row['brand'],row['brand'])
    if brand=='LP' and 'SmartSide' in row['product']: return 'lp-smartside-trim-siding'
    if brand=='Arclin' and 'Firepoint' in row['product']: return 'arclin-firepoint'
    return row.get('existingId') or slug(brand+' '+row['product'])

def build():
    products={}; sources=[]; counts={}
    for year in [2024,2025,2026]:
        rows=json.loads((ROOT/f'docs/research/product-awards/{year}.json').read_text(encoding='utf-8-sig'))
        counts[year]=len(rows)
        sources.append({'year':year,'title':f'Green Builder March/April {year}: Sustainable Products of the Year','url':rows[0]['sourceUrl'],'writeups':len(rows)})
        for row in rows:
            key=identity(row); old=products.get(key)
            tags={TAG_ALIASES.get(t,t) for t in row['needTags']} & ALLOWED_TAGS
            name=row['product'].lower()
            if 'fixtures' in tags:
                if any(t in name for t in ['toilet','phantom']): tags.discard('fixtures'); tags.add('toilets')
                elif 'faucet' in name: tags.discard('fixtures'); tags.add('faucets')
                elif 'showerhead' in name: tags.discard('fixtures'); tags.add('showerheads')
            # A wall/trim accessory or decking is not a noncombustible siding replacement.
            if 'trim-over' in name or 'decking' in name: tags.discard('fire-resistant-siding')
            # Secondary convenience features are not a reason to replace equipment.
            if 'water-heating' in tags or 'water-treatment' in tags: tags.discard('leaks')
            # A basin or bidet seat does not establish reduced faucet/toilet flow.
            if row['category'] in {'Sink','Bidet Seat'}: tags=set()
            requirements={CHECKS[t] for t in tags}
            if any(t in name for t in ['hydronic','air-to-water','air to water','chilled beam']): requirements.add('hydronic')
            # Utility-scale products and tools remain browsable, never inferred as a home need.
            if 'acb-261' in name or row['category'] in {'Building HVAC Controls','Tool Accessories','Carbon Design Software'}: tags=set(); requirements=set()
            award={'year':year,'sourceUrl':row['sourceUrl'],'sourceTitle':row['sourceTitle']}
            awards=(old['awards'] if old else [])+[award]
            products[key]={
                'id':key,'brand':BRANDS.get(row['brand'],row['brand']),'product':row['product'],
                'pillar':row['pillars'][0].title(),'pillars':row['pillars'],'category':CATEGORIES.get(row['category'],row['category']),
                'summary':row['summary'],'companyUrl':https(row['companyUrl']),
                'imageUrl':f'https://vpsf-calculator.onrender.com/catalog-images/{key}.webp',
                'imageSourceUrl':https(row['imageUrl']),'imageCredit':'Photo: '+BRANDS.get(row['brand'],row['brand'])+(' / Green Builder' if 'greenbuildermedia.com' in row['imageUrl'] or 'hubspot' in row['imageUrl'] else ''),
                'awards':awards,'needTags':sorted(tags),'requirements':sorted(requirements),
                'verificationNotes':' '.join(row.get('requirements',[]))[:600],
                **({'existingId':row['existingId']} if row.get('existingId') else {})
            }
    manifest={'schemaVersion':1,'catalogVersion':'gbm-awards-2024-2026-v1','sources':sources,'products':list(products.values())}
    target=ROOT/'backend/app/data/award_products.json'
    target.write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    report={'sourceWriteups':counts,'uniqueAwardProducts':len(products),'existingCatalogMatches':[p['id'] for p in products.values() if p.get('existingId')], 'repeatAwards':{p['id']:[a['year'] for a in p['awards']] for p in products.values() if len(p['awards'])>1}, 'pillarCounts':dict(Counter(t for p in products.values() for t in p['pillars'])),'categoryCounts':dict(Counter(p['category'] for p in products.values()))}
    (ROOT/'docs/research/product-awards/import-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps(report,indent=2))

if __name__=='__main__': build()
