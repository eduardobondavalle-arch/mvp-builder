# Publicacao

## Codigo

A integracao esta publicada na branch `main` de [mvp-builder](https://github.com/eduardobondavalle-arch/mvp-builder). A branch `integracao-adim-v1` conserva o commit original da integracao. O repositorio `fechamento-locacao` permanece como origem dos componentes reaproveitados.

## Hospedagem Vercel

Producao:

https://comercial-fechamento-adim.vercel.app

Projeto Vercel:

- Conta/equipe: `eduardo-0639`
- Projeto: `comercial-fechamento-adim`
- Framework: TanStack Start
- Runtime: Node.js 22.x
- Build: `npm run build`
- Instalacao: `npm ci`

Com Node.js 22 instalado, execute na raiz deste repositorio:

```sh
npm ci
npm run build
npm run deploy
```

`npm run deploy` publica em producao pela Vercel. A autorizacao da Vercel pertence a conta de hospedagem; o aplicativo abre diretamente no painel e nao cria login proprio.

Para validar sem publicar:

```sh
npm run deploy:check
```

A publicacao nao exige variaveis Supabase na versao com persistencia local. O `.env` foi retirado do versionamento e permanece ignorado. Credenciais da Vercel ficam no armazenamento local da ferramenta, fora do repositorio.

## Dados da aplicacao

O deploy disponibiliza a aplicacao por HTTPS. Os registros continuam no armazenamento de cada navegador, vinculados ao dominio acessado. A base de `localhost` nao e copiada automaticamente para o dominio publicado: exporte o backup local e importe na base vazia do dominio de destino, quando necessario.

Banco compartilhado, identidade do hospedeiro e armazenamento remoto de documentos continuam dependendo do adaptador descrito no [guia V1](GUIA-V1.md).

## Estado em 15/09/2026

- GitHub: integracao publicada em `main`.
- Vercel: deploy de producao concluido e pronto.
- URL publica: https://comercial-fechamento-adim.vercel.app
- Validacao de hospedagem: rotas `/`, `/dashboard`, `/kanban`, `/registro-diario`, `/cadastros`, `/relatorios` e `/tv` responderam `200`, sem marcador de tela de login.
