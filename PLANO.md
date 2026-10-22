# Dashboard de aquicultura — revisão da exploração territorial

Prioridade atual: navegador de computador. A adaptação para celular fica para uma etapa posterior. Esta revisão é local, sem publicação.

## Organização implementada

- [x] Visão geral: indicadores anuais, participação regional, principais espécies e séries.
- [x] Territórios e espécies: mapas de regiões/UFs integrados à composição por espécie, tabelas e comparações.
- [x] Fontes e metodologia reunidas em uma única página.
- [x] Espécie substitui Produto nos controles e títulos da interface; categorias e dados originais permanecem preservados.
- [x] Consulta municipal retirada da interface ativa, com implementação anterior em web/archive/, registros e funções de cálculo preservados.

## Interações implementadas

- [x] Ano independente para indicadores, mapas, gráficos de distribuição e tabelas.
- [x] Período exclusivo das séries em um controle com duas extremidades, acessível pelo teclado e integrado ao arraste/ações dos gráficos.
- [x] Desmarcar UF clicando novamente nela; voltar um nível por botão ou caminho territorial.
- [x] Percentuais com referência no Brasil e na região indicada, preservando ano e espécie.
- [x] Comparação das cinco regiões mantida mesmo com uma região selecionada.
- [x] Produção (t) por UF inclui todas as UFs do escopo, sem limite das dez maiores.
- [x] Comparação temporal por território/espécie selecionados, pelas cinco regiões ou pelas cinco maiores espécies no fim do período.

## Dados e distribuição

Aplicação própria em HTML/CSS/JavaScript e SVG, sem dependências externas. data/aquicultura.json e a planilha original preservam registros, fontes e identidade. Brasil/regiões usam agregados originais; UFs são somas municipais. Ausências permanecem nulas, valores monetários são nominais e 2025 é preliminar segundo o arquivo.

Preparação em Python no ambiente conda dados_env. Compilação local por scripts/build-web.mjs, saída em web/dist/. A pasta aquicultura/ conserva o projeto anterior e não é dependência da versão ativa.

## Validação

- [x] Testes automatizados de totais, conciliação, filtros, CSV, integridade e independência.
- [x] Testes de denominadores territoriais, retorno de nível e separação Ano/período.
- [x] Verificação no navegador de seleção/desmarcação, retorno do mapa e participação contextual.
- [x] Verificação no navegador da alteração independente de Ano e dos dois limites da série.
- [x] Verificação da composição por espécie, comparação temporal e página única de fontes.

## Ampliação de 20/10/2026

- [x] Seleção direta de região/UF integrada ao detalhamento por espécie.
- [x] Mapa, ranking territorial e gráfico de espécies lado a lado no computador.
- [x] Menu único de produção/valor por espécie e valores legíveis nas barras.
- [x] Três comparações temáticas com séries em toneladas e áreas de 100%, preservando Outros e ausências.
- [x] Cadastro dos 11 polos de tilápia observado no painel da Embrapa; municípios detalhados somente nesse recorte.
- [x] Vínculo por código IBGE, composição e limitações documentadas, município ausente preservado sem zero atribuído.
- [x] Catálogo de dados, carga sob demanda, subconjunto automático dos polos, caches limitados e gzip reutilizáveis.
- [x] Testes de conciliação temática, cálculos dos polos, integridade da distribuição e carga modular.

Consulta municipal geral, atualização automática por API de produção e valores reais com deflator continuam fora desta revisão. Uma reescrita geral da renderização permanece adiada para evitar retrabalho.

## Integração da página Produção

- [x] Página única Produção, com Regiões, Estado/UF e Polos de tilápia como níveis.
- [x] Um painel visual com mapa, ranking e detalhamento, sob uma medida comum.
- [x] Escala quantitativa e legenda; zero, ausência e exclusão de escopo distintos.
- [x] Nos polos, Estados/UF abrangidos no mapa e municípios no detalhamento, exclusivamente para tilápia.
- [x] Uma comparação temática selecionável, tabela anual com toneladas/porcentagens e áreas de 100% complementares.
- [x] Pelo menos dois anos disponíveis nas séries, incluindo URL, teclado e ações dos gráficos.
- [x] Verificação automatizada dos cálculos e conferência das principais interações no navegador.

Geometria e consulta municipal geral permanecem fora do escopo. Os temáticos comparam todas as espécies no território e todos os anos disponíveis; no nível exclusivamente de tilápia dos polos, o foco é sua comparação territorial e municipal.

## Séries e painéis compartilhados

- [x] Visão geral com barras de produção e linha nominal no mesmo gráfico, e slider interno abaixo.
- [x] Produção com uma série de linhas por medida, dentro da exploração e com slider alinhado abaixo.
- [x] Seleção territorial, polos e municípios orientando a série padrão, com comparações alternativas preservadas.
- [x] Temáticos em uma caixa compartilhada, gráfico de participação mais largo e botões retangulares.
- [x] Título sem IBGE e ajustes de rótulos em Fontes e metodologia, preservando dados e rastreabilidade.
- [x] Verificações de eixos independentes, ausências, zeros e interações no navegador.
