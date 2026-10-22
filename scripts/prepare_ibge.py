"""Read the supplied IBGE workbook without changing it; create reviewed dashboard datasets."""
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime, timezone
import hashlib
import json
from copy import deepcopy
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'prod_anual_aquicultura_ibge.xlsx'
OUTPUT = ROOT / 'reviewed-data.json'
UF = {'11':('RO','Rondônia','Norte'),'12':('AC','Acre','Norte'),'13':('AM','Amazonas','Norte'),'14':('RR','Roraima','Norte'),'15':('PA','Pará','Norte'),'16':('AP','Amapá','Norte'),'17':('TO','Tocantins','Norte'),'21':('MA','Maranhão','Nordeste'),'22':('PI','Piauí','Nordeste'),'23':('CE','Ceará','Nordeste'),'24':('RN','Rio Grande do Norte','Nordeste'),'25':('PB','Paraíba','Nordeste'),'26':('PE','Pernambuco','Nordeste'),'27':('AL','Alagoas','Nordeste'),'28':('SE','Sergipe','Nordeste'),'29':('BA','Bahia','Nordeste'),'31':('MG','Minas Gerais','Sudeste'),'32':('ES','Espírito Santo','Sudeste'),'33':('RJ','Rio de Janeiro','Sudeste'),'35':('SP','São Paulo','Sudeste'),'41':('PR','Paraná','Sul'),'42':('SC','Santa Catarina','Sul'),'43':('RS','Rio Grande do Sul','Sul'),'50':('MS','Mato Grosso do Sul','Centro-Oeste'),'51':('MT','Mato Grosso','Centro-Oeste'),'52':('GO','Goiás','Centro-Oeste'),'53':('DF','Distrito Federal','Centro-Oeste')}

def number(value):
    if isinstance(value, (int, float)):
        return value
    if value == '-':
        return 0
    if value in (None, '...', '..', 'X'):
        return None
    raise ValueError(f'Unrecognized IBGE symbol: {value!r}')

def read_sheet(sheet):
    iterator = sheet.iter_rows(values_only=True)
    headers = [next(iterator) for _ in range(4)]
    products = [(i, name) for i, name in enumerate(headers[3]) if i >= 4 and name]
    result, symbols = {}, Counter()
    level = code = place = None
    for line, row in enumerate(iterator, 5):
        if not row[3] or not str(row[3]).isdigit():
            continue
        if row[0]:
            level, code, place = row[:3]
        year = int(row[3])
        for col, product in products:
            key = (level, str(code), place, year, product)
            if key in result:
                raise ValueError(f'Duplicate key at {sheet.title}:{line}')
            value = row[col]
            if isinstance(value, str):
                symbols[value] += 1
            result[key] = number(value)
    return result, [p for _, p in products], dict(symbols)

def main():
    workbook = openpyxl.load_workbook(INPUT, read_only=True, data_only=True)
    quantities, products, quantity_symbols = read_sheet(workbook.worksheets[0])
    values, value_products, value_symbols = read_sheet(workbook.worksheets[1])
    assert products == value_products, 'Quantity/value product columns differ'
    assert quantities.keys() == values.keys(), 'Quantity/value record keys differ'
    years = sorted({key[3] for key in quantities})
    now = datetime.now(timezone.utc).isoformat()
    direct, states, municipalities = [], {}, {}
    product_index = {name: str(i) for i, name in enumerate(products)}
    for (level, code, place, year, product), quantity in quantities.items():
        value = values[(level, code, place, year, product)]
        if level in ('BR', 'GR'):
            direct.append(dict(level=level, code=code, place=place, region=place if level=='GR' else 'Brasil', year=str(year), product=product, tonnes=quantity/1000 if quantity is not None else None, valueReais=value*1000 if value is not None else None))
        elif level == 'MU':
            uf, state, region = UF[code[:2]]
            skey = (uf, year, product)
            if skey not in states:
                states[skey] = dict(level='UF', code=code[:2], place=state, uf=uf, region=region, year=str(year), product=product, tonnes=0, valueReais=0, observedQuantity=0, observedValue=0)
            s = states[skey]
            if quantity is not None:
                s['tonnes'] += quantity / 1000
                s['observedQuantity'] += 1
            if value is not None:
                s['valueReais'] += value * 1000
                s['observedValue'] += 1
            mkey = (code, year)
            if mkey not in municipalities:
                municipalities[mkey] = dict(code=code, municipality=place, uf=uf, region=region, year=str(year), tonnes=0, valueReais=0, observedQuantity=0, observedValue=0, productData={})
            m = municipalities[mkey]
            if quantity != 0 or value != 0:
                m['productData'][product_index[product]] = [quantity/1000 if quantity is not None else None, value*1000 if value is not None else None]
            if quantity is not None:
                m['tonnes'] += quantity/1000
                m['observedQuantity'] += 1
            if value is not None:
                m['valueReais'] += value*1000
                m['observedValue'] += 1
        else:
            raise ValueError(level)
    for item in [*states.values(), *municipalities.values()]:
        if not item['observedQuantity']:
            item['tonnes'] = None
        if not item['observedValue']:
            item['valueReais'] = None
    aggregates = direct + list(states.values())
    for m in municipalities.values():
        m['productData'] = json.dumps(m['productData'], separators=(',', ':')) if m['observedQuantity'] else None
    # Independently reconcile municipal sums against the workbook's national and regional rows.
    differences = []
    for row in direct:
        children = [s for s in states.values() if s['year']==row['year'] and s['product']==row['product'] and (row['level']=='BR' or s['region']==row['region'])]
        for field, tolerance in [('tonnes', 0.0001), ('valueReais', 1)]:
            observed = [s[field] for s in children if s[field] is not None]
            total = sum(observed) if observed else None
            if row[field] is None and total is None:
                continue
            if row[field] is None or total is None or abs(total-row[field]) > tolerance:
                differences.append(dict(year=row['year'], place=row['place'], product=row['product'], metric=field, direct=row[field], municipalSum=total))
    missing = {str(year): [r['product'] for r in direct if r['level']=='BR' and r['year']==str(year) and r['tonnes'] is None] for year in years}
    caveats = [f'{years[-1]} é preliminar, conforme as notas do arquivo.', 'Valores monetários nominais, sem ajuste de inflação.', 'UF derivada dos dois primeiros dígitos do código municipal; somas estaduais calculadas a partir dos municípios presentes no arquivo.', 'Totais somam apenas os 20 produtos selecionados na planilha. Outros produtos não estão incluídos.', 'Categorias não disponíveis permanecem nulas; o símbolo - é zero absoluto. Totais de produtos disponíveis não equivalem a cobertura integral de categorias não pesquisadas.']
    if differences:
        max_difference = max(abs(r['direct'] - r['municipalSum']) for r in differences if r['direct'] is not None and r['municipalSum'] is not None)
        caveats.append(f'{len(differences)} diferenças de conciliação monetária, até R$ {max_difference:.0f} por produto/território/ano. Totais Brasil/regiões usam as linhas originais, não as somas municipais. Não foi atribuído motivo definitivo às diferenças.')
    source = dict(label='IBGE · Pesquisa da Pecuária Municipal · Tabela 3940 (arquivo fornecido)', provider='Arquivo local fornecido pelo usuário', files=[INPUT.name], coverage=dict(start=str(years[0]),end=str(years[-1])), executedAt=now, caveats=caveats, evidenceFlow=[dict(title='Fonte',detail=f'{INPUT.name}; abas {workbook.worksheets[0].title} e {workbook.worksheets[1].title}.'),dict(title='Preparação reproduzível',detail='Executar scripts/prepare_ibge.py no ambiente conda dados_env. Preencher rótulos territoriais mesclados, juntar quantidade/valor pela chave território × ano × produto, preservar ausências; kg / 1000 = toneladas; mil reais × 1000 = reais.'),dict(title='Cobertura',detail=f'{years[0]}–{years[-1]}, {len(products)} produtos, {len(set(k[0] for k in municipalities))} municípios presentes no arquivo. Não houve consulta de atualização ao IBGE.')], metricDefinitions=[dict(label='Produção (t)',definition='Soma das quantidades disponíveis dos produtos selecionados; quilogramas divididos por 1.000.'),dict(label='Valor da produção (R$)',definition='Soma dos valores disponíveis dos produtos selecionados; mil reais multiplicados por 1.000. Valores nominais.'),dict(label='Valor médio por kg',definition='Valor nominal da produção dividido pela quantidade em kg, somente para pares quantidade/valor disponíveis. Não é preço de varejo.'),dict(label='Variação anual',definition='(Valor do ano selecionado / valor do ano anterior − 1) × 100, usando o mesmo território e os mesmos produtos com observações nos dois anos. Base nula ou zero torna a variação indisponível.')])
    snapshot = dict(surface='dashboard',title='Produção aquícola · IBGE',status='reviewed',buildStatus='creating',generatedAt=now,filters=[dict(id='year',label='Ano',field='year',mode='through',defaultValue=str(years[-1]),queryIds=['production','municipalities']),dict(id='region',label='Região',field='region',defaultValue='all',queryIds=['production','municipalities']),dict(id='product',label='Produto',field='product',defaultValue='all',queryIds=['production']),dict(id='uf',label='UF',field='uf',defaultValue='all',queryIds=['municipalities'])], queries=dict(production=dict(rows=aggregates,source=source,methods=[dict(language='python',code='scripts/prepare_ibge.py: read_sheet() e main(); execução a partir do XLSX original.')]),municipalities=dict(rows=list(municipalities.values()),source={**source,'label':'IBGE · Municípios · totais dos produtos disponíveis','metricDefinitions':source['metricDefinitions'][:2]})),metadata=dict(products=products,years=years,missingProducts=missing,sourceSha256=hashlib.sha256(INPUT.read_bytes()).hexdigest()))
    municipal_definitions = [*source['metricDefinitions'][:3], dict(label='Municípios com produção',definition='Número de códigos municipais distintos do recorte com quantidade disponível maior que zero no ano selecionado. Não representa número de estabelecimentos nem produtores.')]
    snapshot['queries']['municipalities']['source'] = deepcopy(snapshot['queries']['municipalities']['source'])
    snapshot['queries']['municipalities']['payloadColumns'] = ['productData']
    snapshot['queries']['municipalities']['source']['evidenceFlow'].append(dict(title='Detalhamento por produto', detail='productData contém pares [toneladas, reais] indexados pela posição em metadata.products. Índice ausente significa zero; par nulo significa dado indisponível. Payload nulo indica ano municipal sem observações.'))
    snapshot['filters'][3]['queryIds'] = ['production','municipalities']
    snapshot['queries']['municipalities']['source']['metricDefinitions'] = municipal_definitions
    # The source has identical missingness between quantities and values. Required for municipal unit values.
    if any((quantities[k] is None) != (values[k] is None) for k in quantities):
        raise ValueError('Quantity/value missingness differs; municipal unit-value calculation needs paired measures.')
    for query in snapshot['queries'].values():
        query['source']['evidenceFlow'].append(dict(title='Eixo temporal',detail='Observações anuais; os eixos e seletores mostram somente anos. O intervalo controla a série histórica e o último ano controla os indicadores e distribuições.'))
    OUTPUT.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    app_snapshot = ROOT / 'data' / 'aquicultura.json'
    if app_snapshot.exists():
        old_snapshot = json.loads(app_snapshot.read_text(encoding='utf-8'))
        snapshot['id'] = old_snapshot['id']
        snapshot['buildStatus'] = 'complete'
        if 'geography' in old_snapshot['queries']:
            snapshot['queries']['geography'] = old_snapshot['queries']['geography']
        app_snapshot.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    report = dict(file=INPUT.name,sha256=snapshot['metadata']['sourceSha256'],years=years,products=products,quantitySymbols=quantity_symbols,valueSymbols=value_symbols,aggregateRows=len(aggregates),municipalRows=len(municipalities),municipalities=len(set(k[0] for k in municipalities)),missingNationalProducts=missing,reconciliationDifferences=differences,nationalTotals=[dict(year=str(y),tonnes=sum(r['tonnes'] or 0 for r in direct if r['level']=='BR' and r['year']==str(y)),valueReais=sum(r['valueReais'] or 0 for r in direct if r['level']=='BR' and r['year']==str(y))) for y in years])
    (ROOT/'quality-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:report[k] for k in ['aggregateRows','municipalRows','municipalities','missingNationalProducts','nationalTotals']},ensure_ascii=False))
    print(f'Reconciliation differences: {len(differences)}; Snapshot: {OUTPUT.stat().st_size/1e6:.2f} MB')

if __name__ == '__main__':
    main()
