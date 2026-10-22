"""Project official IBGE geometry to an SVG viewport; retain source geometry locally."""
import json
import math
from pathlib import Path
from datetime import datetime, timezone
from prepare_ibge import UF

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'data/geography'
REGIONS = {'1':'Norte','2':'Nordeste','3':'Sudeste','4':'Sul','5':'Centro-Oeste'}
URL = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao='

def project(point):
    lon, lat = point[:2]
    return math.radians(lon), -math.log(math.tan(math.pi/4+math.radians(lat)/2))

features = []
for level, filename in [('GR','brazil-regions.geojson'),('UF','brazil-states.geojson')]:
    geometry = json.loads((ASSETS/filename).read_text(encoding='utf-8'))
    for feature in geometry['features']:
        code = str(feature['properties']['codarea'])
        polygons = feature['geometry']['coordinates']
        if feature['geometry']['type'] == 'Polygon':
            polygons = [polygons]
        features.append((level, code, polygons))
points = [project(p) for _,_,polygons in features for polygon in polygons for ring in polygon for p in ring]
x0, y0 = min(p[0] for p in points), min(p[1] for p in points)
x1, y1 = max(p[0] for p in points), max(p[1] for p in points)
scale = min(580/(x1-x0), 540/(y1-y0))
offset_x, offset_y = (620-(x1-x0)*scale)/2, (580-(y1-y0)*scale)/2
rows = []
for level, code, polygons in features:
    path = []
    for polygon in polygons:
        for ring in polygon:
            projected = [project(p) for p in ring]
            path.append('M'+' L'.join(f'{offset_x+(x-x0)*scale:.2f},{offset_y+(y-y0)*scale:.2f}' for x,y in projected)+' Z')
    name = REGIONS[code] if level=='GR' else UF[code][1]
    rows.append(dict(level=level, code=code, place=name, region=name if level=='GR' else UF[code][2], uf=None if level=='GR' else UF[code][0], path=' '.join(path)))
snapshot_path = ROOT/'data/aquicultura.json'
snapshot = json.loads(snapshot_path.read_text(encoding='utf-8'))
captured_at = snapshot.get('queries',{}).get('geography',{}).get('source',{}).get('executedAt')
snapshot['queries']['geography'] = dict(rows=rows,payloadColumns=['path'],source=dict(label='IBGE · API de Malhas · Brasil, regiões e UFs', provider='IBGE',urls=[URL+'regiao',URL+'UF'], executedAt=datetime.now(timezone.utc).isoformat(),caveats=['Malha simplificada para visualização; não representa limites municipais nem mudanças históricas de limites.'],evidenceFlow=[dict(title='Geometria oficial', detail='API Malhas v3; qualidade mínima; GeoJSON por região e UF, arquivos preservados em src/content/assets.'),dict(title='Projeção',detail='Mercator esférica ajustada ao viewport 620 × 580. Anéis interiores preservados com preenchimento evenodd. Código: scripts/prepare_geography.py.')]))
snapshot['queries']['geography']['source']['links'] = [dict(label='IBGE · Documentação da API de Malhas v3',href='https://servicodados.ibge.gov.br/api/docs/malhas?versao=3'),dict(label='IBGE · Malha de regiões',href=URL+'regiao'),dict(label='IBGE · Malha de UFs',href=URL+'UF')]
snapshot['queries']['geography']['source']['files'] = ['data/geography/brazil-regions.geojson','data/geography/brazil-states.geojson']
snapshot['queries']['geography']['source']['evidenceFlow'][0]['detail'] = 'API Malhas v3; qualidade mínima; GeoJSON por região e UF, arquivos preservados em data/geography/. Preparação local; não houve nova consulta à API.'
if captured_at:
    snapshot['queries']['geography']['source']['executedAt'] = captured_at
snapshot_path.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',',':')),encoding='utf-8')
print(f'Prepared {len(rows)} official geographic features.')
