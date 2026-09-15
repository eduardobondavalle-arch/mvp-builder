# Consolidação Adim — V1

## Bases e decisão

- Comercial: `mvp-builder`, commit `5549e3db8a974d57871f4856e4605f1d0c22588a`.
- Fechamento: `fechamento-locacao`, commit `a971c8852b0387b9154f6663c898bf6da906bd24`.
- Base executável: Comercial (React 19, TanStack Start, Tailwind 4). Portar componentes React do Fechamento; não incorporar um segundo roteador Next.js.
- O usuário confirmou operação sem login e sem tela de login. Identidade e capacidades externas pertencem a um adaptador da plataforma hospedeira. A execução local não representa uma sessão autenticada.

## Reaproveitamento concreto

| Origem     | Componentes / lógica                                                                                      | Tratamento                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Comercial  | `src/components/app-shell.tsx`, `nav-scroll`, `toggle-tema`, `skeletons`, biblioteca `ui`, logo e favicon | Manter; adaptar apenas navegação e identidade externa                                             |
| Comercial  | rotas `dashboard`, `relatorios`, `registro-diario`, `ciclos`, `cadastros`, `tv`, `auditoria`              | Preservar telas, textos, filtros, gráficos, tabelas e exportação                                  |
| Comercial  | `lib/metrics.ts`, `periodos.ts`, `pdf.ts`, `filtros-bar`, `funil-visual`                                  | Preservar cálculos e recortes; substituir contagem por coluna por marcos permanentes              |
| Comercial  | `Jornada`, consultores/equipes, canais, ciclos, metas, registros diários, pré-leads                       | Preservar campos e IDs; fornecer projeção comercial do processo                                   |
| Fechamento | `kanban-board`, `kanban-column`, `card-tile`, `board-toolbar`                                             | Portar drag-and-drop, teclado, rolagem nas bordas, filtros, cards e estilos                       |
| Fechamento | `ui/modal`, `card-detail-modal`, `create-closing-modal`, `board-settings-panel`                           | Reutilizar modal, controles e padrões visuais; adaptar conteúdo às quatro abas e configurações V1 |
| Fechamento | `rank.ts`, formatação, estilo de SLA, comentários e anexos                                                | Reutilizar; estender SLA para tarefas e entrega agendada                                          |

## Substituições

1. A rota `/kanban` passa a renderizar o novo Fechamento. O editor antigo de jornadas deixa de alimentar o funil.
2. Colunas genéricas tornam-se nove etapas fixas. Comissionamento e gestão própria de usuários não integram a V1.
3. Checklist livre torna-se execução sequencial de tarefas, com snapshots de nome, ordem, SLA e responsável.
4. Mutação livre de etapa torna-se comando validado no domínio, com gates e eventos permanentes.
5. Exclusão física torna-se exclusão administrativa lógica com justificativa.

## Implementação e validação

1. Modelo: manter todos os campos de Jornada; pessoas relacionadas por ID; valores comerciais distintos; análise e comentários separados.
2. Domínio: caminhos fixos, primeiros marcos idempotentes, cancelamento e recuperação, pendência, parecer da Direção, tarefas, SLA e auditoria.
3. Persistência: repositório unificado local versionado, sem dados de clientes fictícios; contrato externo para implantação. Erros nunca devem limpar armazenamento ou aparentar gravação bem-sucedida.
4. UI: proposta completa, pessoas repetíveis, documentos, abas, configurações, tarefas e estados semânticos sobre os componentes existentes.
5. Comercial: projeção compatível, preservação dos dados agregados e regressão de métricas, rankings e metas.
6. Verificações: testes do domínio e persistência; tipagem, build e fluxos no navegador. Registrar limitações reais da integração externa.

## Migração de dados

Importar exportações de jornadas mantendo IDs, campos, datas e flags históricas; não inferir perda de marcos a partir da etapa atual. Dados de Fechamento com colunas arbitrárias exigem mapeamento explícito para as nove etapas, nunca exclusão ou conversão silenciosa. Preservar a exportação original como backup antes de ativar uma base importada.

## Decisões ainda externas

A plataforma hospedeira não foi identificada. Seu adaptador deve fornecer identidade, capacidades, persistência compartilhada e entrega das notificações. Até sua conexão, o ambiente local grava neste navegador e mantém notificações operacionais internas; não envia e-mails ou mensagens externas.
