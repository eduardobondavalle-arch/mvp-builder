# Plataforma Comercial + Fechamento Adim

Integração do Comercial `mvp-builder` com os componentes do `fechamento-locacao`, conforme a especificação V1. A aplicação abre diretamente no painel, sem login. Produção: https://comercial-fechamento-adim.vercel.app.

## Executar

Requer Node.js 22.12+ e npm.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Abra http://127.0.0.1:5173. Cadastre consultores e canais em **Cadastros** e configure as regras em **Fechamento → Configurações**.

A execução local armazena dados neste navegador. Exporte backups em **Dados e migração**. Persistência compartilhada depende do adaptador da plataforma; nenhum banco remoto foi migrado ou publicado.

## Verificar

```sh
npm test
npm run typecheck
npm run build
# Com a aplicação em execução e Google Chrome instalado:
npm run test:e2e
```

## Documentação

- [Publicação no GitHub e Vercel](docs/DEPLOY.md)
- [Guia de operação, persistência e contrato de integração](docs/GUIA-V1.md)
- [Plano de migração e componentes reaproveitados](docs/PLANO-MIGRACAO-V1.md)
