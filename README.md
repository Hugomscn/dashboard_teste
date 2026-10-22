# Dashboard independente de aquicultura

Aplicação própria em HTML, CSS e JavaScript nativo, com gráficos SVG e dados locais. Não usa a estrutura de autoria anterior, não depende de ChatGPT, Codex, plugins, contas, chaves de API, CDN ou bibliotecas externas. O navegador carrega somente arquivos do servidor em que a aplicação está hospedada.

Fonte: `prod_anual_aquicultura_ibge.xlsx`, preservada sem alterações. Cobertura do arquivo: 2013–2025, 20 produtos e 4.280 municípios. A migração de interface não atualizou nem substituiu observações da planilha.

## Abrir

No Windows, dê duplo clique em `abrir-dashboard.cmd` e acesse **http://127.0.0.1:4173/** em qualquer navegador. Mantenha a janela do terminal aberta enquanto usar o dashboard. O inicializador usa Node.js, quando disponível, e Python como alternativa. O acesso é local ao computador.

Também é possível executar `./iniciar-dashboard.ps1` no PowerShell. Se a política local bloquear scripts não assinados, use `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\iniciar-dashboard.ps1` ou o atalho `abrir-dashboard.cmd`; isso autoriza somente essa execução e não altera a política permanente do Windows.

Alternativa com Node.js 20 ou superior, sem instalar pacotes:

```powershell
node scripts/serve-web.mjs
```

## Usar

- **Visão geral:** indicadores, participação regional e principais espécies. A evolução usa um gráfico combinado: barras de produção em toneladas no eixo esquerdo e linha de valor nominal em reais no eixo direito. O slider permanece abaixo, dentro da mesma caixa; CSV e leitura dos pontos preservam as duas medidas.
- **Produção:** mapa, ranking e detalhamento reunidos em um único painel. O menu Nível alterna Regiões, Estado/UF e Polos de tilápia. O controle segmentado Produção (t) / Valor (R$), na barra superior de filtros, controla mapa, gráficos de barras, série temporal e painéis temáticos. Barras curtas mantêm seus valores ao lado; as demais mostram valores internos.
- **Mapa:** uma escala sequencial representa a medida selecionada. Nos níveis Regiões e Estado/UF, a referência é nacional, por ano, espécie e nível; selecionar uma área preserva a escala. Zero, ausência de dados e áreas fora do recorte são distintos. Nos polos, o mapa destaca Estados/UF abrangidos e soma somente municípios cadastrados; as áreas exibidas não delimitam os polos.
- **Painéis temáticos:** ficam na página Produção, nos níveis Regiões e Estado/UF. Três botões retangulares alternam Aquicultura, Nativos × Exóticos e Tilápia × Redondos, com estado selecionado acessível pelo teclado. Tabela e áreas normalizadas em 100% compartilham uma única caixa. O gráfico tem mais espaço horizontal que a tabela. Ela apresenta toneladas ou valor nominal em reais, conforme a medida selecionada, e a participação correspondente para todos os anos disponíveis. Tooltips e CSV acompanham a medida. O território selecionado se aplica à seção; ela considera todas as espécies e não é restringida pelo Ano anual ou pelo período das séries. “Outros” permanece no denominador e nas duas medidas. Ausências ou totais não positivos não geram uma falsa composição de 100%.
- **Polos de tilápia:** são um nível da mesma exploração. O ranking territorial passa a comparar polos e o detalhamento por espécie é substituído por municípios. A avaliação é exclusivamente de tilápia, por produção ou valor. Por isso, a composição temática entre espécies não aparece nesse nível. O cadastro contém 11 polos e 222 municípios, dos quais 221 têm registros locais. Wenceslau Braz (PR) permanece identificado como ausente, sem atribuição de zero. A consulta municipal geral continua fora da interface.
- **Fontes e metodologia:** uma única página reúne referências, critérios, unidades, cobertura e limites.
- **Filtros anuais:** Ano define indicadores, mapas, distribuições e tabelas, independentemente do período da série. Região, UF e Espécie integram as seleções feitas nos gráficos. Cada página mantém seu recorte durante a navegação; links e histórico do navegador preservam a visualização.
- **Série temporal:** na página Produção, um único gráfico de linhas está dentro da Exploração da produção e acompanha a medida escolhida. A comparação padrão usa o território e a espécie selecionados; as comparações entre regiões ou espécies continuam disponíveis. Nos polos, selecionar um município também orienta a série. O slider fica abaixo, alinhado ao comprimento do gráfico. Um único controle com duas extremidades delimita ano inicial/final, também acessível pelo teclado. O período mínimo contém dois anos disponíveis; ponteiros não se cruzam nem assumem o mesmo ano. A regra vale para links antigos, teclado, arraste e ações dos pontos. Arrastar sobre o gráfico e usar ações de pontos altera somente esse período. A página territorial permite comparar as cinco regiões ou as cinco maiores espécies do território no fim da série.
- **Navegação territorial:** clicar novamente no Estado/UF selecionado desmarca a seleção. O botão Voltar e o caminho Brasil → região → Estado/UF retornam um nível. Percentuais usam Brasil ou a região indicada como referência, mantendo ano, espécie e medida.
- **Dados:** cartões oferecem CSV; nas tabelas, o CSV contém todos os resultados da busca/ordenação, além da página visível. A barra superior oferece tema claro/escuro e impressão.

A intensidade das cores representa a medida escolhida; cinza significa área fora do recorte, sem representar produção zero. Valores e participações aparecem ao passar o cursor ou focar uma área. “Espécie” é o nome de exibição das categorias originais do IBGE, algumas das quais agrupam espécies. A prioridade desta revisão é a experiência no navegador de computador.

## Compilar e hospedar

```powershell
node scripts/build-web.mjs
node --test tests/*.test.mjs
```

Também existem os atalhos `npm run build`, `npm test` e `npm start`, caso npm esteja instalado. Não é necessário `npm install`.

Para uma futura hospedagem, copie **todo o conteúdo de `web/dist/`** para a pasta pública de um servidor HTTP/HTTPS. Caminhos relativos permitem hospedagem na raiz ou em subpastas. Não é necessário serviço de IA, Node ou Python no servidor de produção: esses programas servem apenas para preparar/compilar ou servir os arquivos localmente. Esta revisão permanece somente local, sem publicação. O ZIP em `entregas/` corresponde à entrega anterior e não foi atualizado nesta revisão.

Abrir `index.html` diretamente por `file://` não é o modo de execução: os módulos e o JSON devem ser servidos por HTTP/HTTPS. A atualização dos dados é manual; nenhuma API de produção é consultada em segundo plano.

## Estrutura

- `web/src/app.js`: interface, navegação, filtros, tabelas e página de fontes.
- `web/src/territory.js`: referências de comparação e retorno de nível territorial.
- `web/src/year-range.js`: controle único do período com duas extremidades.
- `web/src/data-store.js`: carregador genérico por catálogo, com cache de requisições, recuperação de falha e carregamento sob demanda.
- `web/src/themes.js`: regras de agrupamento e cálculo das séries temáticas compartilhadas por visualização e CSV.
- `web/src/area-chart.js`: gráfico reutilizável de composição temporal em 100%.
- `web/src/combo-chart.js`: barras de quantidade e linha nominal, com eixos independentes, ausências preservadas e seleção de período reutilizada dos gráficos de linhas.
- `web/src/map-scale.js`: escala quantitativa reutilizável, preservando zero e ausência de dados.
- `web/src/poles.js`: cálculos por códigos IBGE, seleção exclusiva de tilápia e união sem duplicar municípios.
- `data/tilapia-poles-membership.json`: composição consultada no painel da Embrapa em 20/10/2026, com 2025 selecionado, e referência IBGE do município ausente.
- `scripts/prepare-poles.mjs`: vincula os nomes/códigos e gera `data/tilapia-poles.json`; a compilação executa este passo automaticamente, sem internet.
- `web/archive/`: consulta municipal anterior preservada fora da compilação ativa.
- `web/src/charts.js`: gráficos SVG, seleção anual e ações dos pontos/barras/fatias.
- `web/src/model.js`: regras de cálculo reutilizadas e conferidas na migração.
- `web/src/state.js`: validação dos filtros e operações das tabelas.
- `web/src/styles.css`: estilos próprios, impressão e adaptação de largura.
- `data/aquicultura.json`: dados canônicos, metadados e fontes.
- `data/geography/`: malhas GeoJSON oficiais preservadas.
- `scripts/prepare_ibge.py` e `scripts/prepare_geography.py`: preparação no ambiente `dados_env`.
- `scripts/build-web.mjs` e `scripts/serve-web.mjs`: preparação e servidor local, usando somente a biblioteca padrão do Node.
- `tests/`: verificações dos cálculos, filtros, CSV, integridade e independência.
- `aquicultura/`: versão anterior preservada como referência; não é usada para executar ou compilar a aplicação atual.

## Atualizar a planilha

Use uma exportação da mesma tabela, com a mesma organização de abas/colunas:

```powershell
conda run -n dados_env python scripts/prepare_ibge.py
conda run -n dados_env python scripts/prepare_geography.py
node scripts/build-web.mjs
node --test tests/*.test.mjs
```

A ingestão preserva a identidade do conjunto e a geometria existente. A preparação geográfica usa GeoJSON locais, sem internet. `quality-report.json` conserva a conferência da planilha. Substitua os arquivos hospedados e recarregue a página.

## Carregamento modular

A abertura usa `data/catalog.json`, `production.json` e `geography.json`. Os polos carregam somente `poles.json` e `poleProduction.json`, um subconjunto automático dos registros originais dos municípios cadastrados. A base municipal completa fica preservada e disponível para uso futuro, mas não é carregada por essas páginas. O JSON completo também permanece na distribuição por compatibilidade e não é solicitado na abertura.

O carregador identifica cada consulta por descritores do catálogo, deduplica requisições simultâneas e permite tentar novamente após falha. Novas consultas usam a mesma infraestrutura. Seleções de produção e contextos geográficos têm caches limitados, associados à identidade do conjunto de linhas; não há dependência do desenho de cada painel.

A compilação gera arquivos `.gz` automaticamente. O servidor Node negocia gzip quando aceito pelo navegador; a alternativa Python continua funcional sem essa negociação. Na hospedagem, configure compressão HTTP ou o uso dos arquivos gzip conforme o servidor. Não foi adotada uma reescrita geral da renderização: novos componentes continuam usando o mesmo ciclo de desenho e controles existentes.

As classificações e os polos são configurações separadas dos gráficos. A lista de polos é uma composição observada em 2025 no painel da Embrapa e aplicada a todos os anos locais; não é uma reconstrução histórica de limites. A compilação confere a correspondência dos nomes e falha diante de nova ausência ou ambiguidade não documentada. Totais dos polos usam os dados locais disponíveis, sem substituir a produção nacional.

## Critérios e limites

Brasil/regiões usam os agregados originais. UFs são somas municipais pelo código IBGE; níveis sobrepostos não são somados entre si. Quantidades reconciliam. Há 489 diferenças monetárias de até R$ 51 por produto/território/ano, registradas sem atribuir causa não demonstrada.

Ausências permanecem ausências; `-` é zero absoluto. Totais incluem somente produtos disponíveis na seleção do arquivo. Variações anuais usam pares comparáveis nos dois anos. Valor médio por kg é razão de somas, não média simples nem preço de varejo. Valores são nominais. 2025 é preliminar segundo as notas do arquivo.

## Verificação da migração

Testes automatizados conferem totais, conciliação dos 13 anos, dados municipais dos 20 produtos, filtros, buscas, ordenação, CSV, hashes dos arquivos e preservação do XLSX. Os arquivos entregues são verificados quanto à ausência de scripts/integrações da plataforma e dependências remotas.

Nesta revisão, a verificação no navegador de computador cobre seleção/desmarcação de UF, retorno ao mapa regional, percentuais contextuais, seleção de espécie, comparação temporal e independência entre Ano e os dois limites da série. A página única de fontes também foi conferida. Os testes automatizados verificam ainda a preservação municipal e os denominadores territoriais. A impressão usa o recurso nativo do navegador e uma folha de estilos própria; não houve conferência em impressora física.

## Verificação da integração de Produção

Os testes verificam os dois anos mínimos em todas as combinações de limites, preservação do Ano independente, escala por medida, denominadores monetários e estabilidade do domínio nacional ao selecionar um Estado/UF. Mantêm-se as conciliações temáticas, os cálculos dos polos, a identidade dos dados e a carga sob demanda.

No navegador de computador foram conferidos o painel em três colunas, troca de produção/valor, seleção de Estado/UF, menus temáticos, tabela anual, ponteiros pelo teclado e polos com detalhamento municipal. O mapa de polos representa Estados/UF abrangidos; a geometria municipal e uma consulta municipal geral ficam para uma revisão futura.

## Revisão de apresentação das séries

O título visível passa a ser Produção aquícola. Em Fontes e metodologia, os rótulos retiram “Tabela 3940 (arquivo fornecido)” e o fornecedor “Arquivo local fornecido pelo usuário”; “Preparado” passa a “Atualizado”. A data exibida e os metadados originais continuam preservados, sem sugerir uma nova coleta.

Os testes do gráfico combinado verificam a independência entre escalas, a ordem dos anos, os limites das barras e a distinção entre ausência e zero. A conferência no navegador inclui a medida e o filtro da série integrada, os três botões temáticos e a largura maior do gráfico de participação no computador.

A troca de páginas tem uma entrada suave de 180 ms, desativada quando o sistema solicita movimento reduzido. Alterar filtros não repete a animação. A barra superior usa espaçamento vertical reduzido e o controle de medida mantém o estilo de bordas retas do projeto.

## Interação das séries temporais

Linhas-guia horizontal e vertical acompanham o cursor dentro do gráfico, com o ano mais próximo e a leitura em cada eixo. O tooltip reúne as séries do ano; o foco pelo teclado oferece a mesma leitura. O combinado mantém toneladas e reais em eixos próprios, sem comparar numericamente medidas de unidades diferentes.

Ao encurtar o intervalo, as barras ocupam uma fração constante do espaço de cada ano. Escalas, posições e rótulos são recalculados para o recorte. Pontos, linhas e barras usam uma transição SVG de 280 ms entre as posições dos anos comuns; movimento reduzido desativa essa animação. O slider conserva o domínio completo e o mínimo de dois anos.

`web/src/time-interaction.js` compartilha as linhas-guia e a transição entre os renderizadores de linhas e combinado, sem dependências externas.
