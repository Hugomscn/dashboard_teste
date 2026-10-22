# Dashboard de aquicultura

Dashboard estático em HTML, CSS e JavaScript. A página **Produção** pode ser incorporada em outro portal por iframe usando `?embed=production`.

## Publicar no GitHub Pages

O workflow de GitHub Actions compila `web/` e publica o conteúdo de `web/dist/` sempre que há um push para `main`.

1. No GitHub, abra **Settings → Pages** e escolha **GitHub Actions** como fonte de publicação. Isso é feito uma vez.
2. Edite os arquivos-fonte e envie as alterações para a branch `main`.
3. Acompanhe **Actions → Publish GitHub Pages**. Quando o workflow terminar, a página publicada estará atualizada.

Não edite `web/dist/`: essa pasta é gerada pelo build e ignorada pelo Git. Para incorporar somente a Exploração da produção, use a URL do site com `?embed=production`, por exemplo: <https://hugomscn.github.io/dashboard_teste/?embed=production>.

Para publicar alterações de código, não é necessário compilar localmente: o GitHub Actions executa o build no push.

## Arquivos principais

- `web/src/`: interface, estilos e componentes do dashboard.
- `web/index.html`: página de entrada.
- `data/aquicultura.json`: dados usados pelo build.
- `data/tilapia-poles-membership.json`: cadastro necessário para gerar os dados dos polos.
- `scripts/build-web.mjs`: gera o site estático em `web/dist/`.
Atalhos locais, servidor de pré-visualização, testes, planilha original, arquivos intermediários, malhas geográficas de entrada, imagens de prévia, relatórios e versão arquivada são materiais de apoio; não são necessários para compilar e publicar o dashboard. Permanecem neste computador e estão excluídos do repositório por `.gitignore`.
