# Publicação

## Código

A integração está publicada na branch `main` de [mvp-builder](https://github.com/eduardobondavalle-arch/mvp-builder). A branch `integracao-adim-v1` conserva o commit da integração. O repositório `fechamento-locacao` permanece como origem dos componentes reaproveitados.

## Hospedagem Cloudflare

O build gera um Worker chamado `eduardobondavalle-arch-mvp-builder`, com manifesto em `.output/server/wrangler.json` e arquivos públicos em `.output/public`. O domínio padrão será informado pela Cloudflare ao concluir a publicação.

Com Node.js 22.12+ instalado, execute na raiz deste repositório:

```sh
npm ci
npx --yes wrangler@4.131.2 login
npm run deploy
```

`npm run deploy` recompila o sistema e publica o manifesto gerado. A autorização OAuth do Wrangler pertence à conta de hospedagem; o aplicativo abre diretamente no painel sem autenticação própria. Escolha a conta Cloudflare que deve ser dona da aplicação quando houver mais de uma.

Para validar o pacote sem publicá-lo, depois de `npm run build`:

```sh
npm run deploy:check
```

A publicação não exige variáveis Supabase na versão com persistência local. O `.env` foi retirado do versionamento e permanece ignorado. Credenciais do Wrangler devem ficar no armazenamento local da ferramenta, fora do repositório.

## Dados da aplicação

O deploy disponibiliza a aplicação por HTTPS. Os registros continuam no armazenamento de cada navegador, vinculados ao domínio acessado. A base de `localhost` não é copiada automaticamente para o domínio publicado: exporte o backup local e importe na base vazia do domínio de destino, quando necessário.

Banco compartilhado, identidade do hospedeiro e armazenamento remoto de documentos continuam dependendo do adaptador descrito no [guia V1](GUIA-V1.md).

## Estado em 15/09/2026

- GitHub: integração publicada em `main`, commit `6543a81`.
- Pacote Cloudflare: validação com `--dry-run` aprovada.
- Deploy público: aguardando autorização da conta Cloudflare.
