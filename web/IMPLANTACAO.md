# Implantar o dashboard

Publique `index.html`, `assets/`, `data/` e `build-manifest.json` juntos em um servidor HTTP/HTTPS, na raiz ou em subpasta. Não abra o HTML diretamente pelo explorador de arquivos.

Não há dependência de conta, plugin, chave de API, serviço de IA, CDN ou banco de dados. Scripts, estilos e dados são carregados do próprio servidor. Forneça `.js` como `text/javascript` e `.json` como `application/json`. Configure compressão HTTP para os dados e HTTPS conforme as práticas do ambiente.

O navegador abre `data/catalog.json` e as consultas marcadas para pré-carga. Os arquivos municipais completos não são solicitados na abertura; a página de polos usa um subconjunto automático em `data/poleProduction.json`. Preserve todos os arquivos de `data/` e `assets/`, inclusive o catálogo e os arquivos `.gz`. O servidor Node de desenvolvimento negocia gzip; em outros servidores, configure a compressão ou o atendimento dos arquivos pré-comprimidos conforme a plataforma.

Dados de produção correspondem ao arquivo fornecido (2013–2025), sem atualização automática. Atualizações são preparadas no projeto-fonte e substituem os arquivos desta pasta. Não aplique cache permanente a nomes de arquivos que permaneçam iguais.

Filtros/detalhamentos ficam na URL. Todos os dados do JSON distribuído são acessíveis a quem tiver acesso ao site: filtros alteram somente a visualização. Se precisar de acesso restrito, configure autenticação no servidor. A aplicação não realiza publicação nem mudanças de acesso.
