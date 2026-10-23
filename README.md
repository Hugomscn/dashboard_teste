# Dashboard de aquicultura

Dashboard estático em HTML, CSS e JavaScript. A página **Produção** pode ser incorporada em outro portal por iframe usando `?embed=production`.

## Publicar no GitHub Pages

O workflow de GitHub Actions compila `web/` e publica o conteúdo de `web/dist/` sempre que há um push para `main`.

1. No GitHub, abra **Settings → Pages** e escolha **GitHub Actions** como fonte de publicação. Isso é feito uma vez.
2. Edite os arquivos-fonte e envie as alterações para a branch `main`.
3. Acompanhe **Actions → Publish GitHub Pages**. Quando o workflow terminar, a página publicada estará atualizada.

Não edite `web/dist/`: essa pasta é gerada pelo build e ignorada pelo Git. Para incorporar somente a Exploração da produção, use a URL do site com `?embed=production`, por exemplo: <https://hugomscn.github.io/dashboard_teste/?embed=production>.

### Incorporação no Liferay DXP 7.4

Dois endereços de incorporação estão disponíveis:

- `?embed=production`: quadro compacto com indicadores, mapa, ranking, espécies e série temporal. O nível territorial fica na barra principal e a comparação fica junto ao CSV da série. O slider permanece acessível pelo teclado, sem o cabeçalho visual de período. A orientação de uso aparece abaixo como rodapé menor. Temáticos e tabelas adicionais ficam fora desse quadro; fontes abrem em outra aba.
- `?embed=production-full`: apresentação incorporada preservada antes da compactação, com painéis temáticos, tabelas adicionais e navegação para Fontes e metodologia. Exemplo: <https://hugomscn.github.io/dashboard_teste/?embed=production-full>.

O modo `?embed=production` usa fundo branco e tema claro, ocupa toda a largura disponível e dispensa o título externo do painel. Textos usam `1rem` e títulos de caixas `1.125rem`; a base respeita o tamanho padrão do navegador (normalmente 16 px). Rankings e tabelas mantêm suas rolagens internas. O documento conserva altura natural, sem esconder conteúdo para eliminar barras.

O acesso a Fontes e metodologia da apresentação preservada oferece retorno à produção e preserva o recorte. A Visão geral continua disponível na versão completa, fora desses modos de incorporação.

Na página pública de teste da Embrapa, em 22/10/2026, o widget estava com o ajuste automático ativo. O script do portal atribuía ao iframe `document.body.scrollHeight` **da página do portal**, sem medir o documento externo. A inspeção encontrou 2.543 px de altura do iframe e 4.294 px de conteúdo da versão publicada, numa janela em que a largura interna era aproximadamente 683 px. Isso não confirma ajuste automático ao maior conteúdo do dashboard.

Aumentar a altura do iframe pode eliminar a rolagem da página interna se houver espaço para todo o conteúdo. A altura necessária varia com a largura, fontes, filtros e seções expandidas; deve ser medida novamente após a publicação, incluindo celular e metodologia. Essa configuração pertence ao widget/portal: o dashboard não altera a altura do iframe entre domínios. Não aplicar `overflow: hidden` à página como substituto do dimensionamento.

Verificação local da adaptação: textos de 16 px e títulos de 18 px com a configuração padrão do navegador, sem transbordamento horizontal em larguras de 390, 698 e 1.280 px. O painel inicial ocupou aproximadamente 4.803 px numa largura externa de 698 px. Numa simulação com iframe de 6.500 px, a página interna não apresentou rolagem vertical, a página externa manteve sua rolagem e o ranking de espécies manteve a própria barra. Essa altura serve como teste, não como valor universal para o widget. O tamanho do widget público não foi alterado.

Para publicar alterações de código, não é necessário compilar localmente: o GitHub Actions executa o build no push.

## Arquivos principais

- `web/src/`: interface, estilos e componentes do dashboard.
- `web/index.html`: página de entrada.
- `data/aquicultura.json`: dados usados pelo build.
- `data/tilapia-poles-membership.json`: cadastro necessário para gerar os dados dos polos.
- `scripts/build-web.mjs`: gera o site estático em `web/dist/`.
Atalhos locais, servidor de pré-visualização, testes, planilha original, arquivos intermediários, malhas geográficas de entrada, imagens de prévia, relatórios e versão arquivada são materiais de apoio; não são necessários para compilar e publicar o dashboard. Permanecem neste computador e estão excluídos do repositório por `.gitignore`.
