# V1 — operação e integração

## O que está integrado

O Comercial continua usando seu AppShell, dashboards, relatórios/PDF, Registro Diário, Pré-leads, cadastros, ciclos, metas, TV, filtros, rankings e auditoria. O novo Fechamento usa Kanban, cards, drag-and-drop, teclado, rolagem lateral, modal e controles derivados do `fechamento-locacao`.

As rotas antigas de login e gestão de acessos redirecionam ao painel. Não há login nem criação de contas nesta V1.

## Primeiro uso

1. Em **Cadastros**, mantenha unidades/equipes, consultores e canais. Unidades e equipes usam os mesmos IDs para preservar rankings e metas.
2. Em **Fechamento → Configurações**, cadastre captadores por unidade, tipos de imóvel, garantias, origens e motivos de perda/reprovação.
3. Cadastre campos, documentos e obrigatoriedade na entrada de cada etapa. Tarefas têm sequência, SLA e indicação de exigência ao sair.
4. Use **Nova proposta** para preencher negociação, pessoas e documentos. O envio cria um único processo e registra o marco Proposta.
5. Movimente o card pelo seletor de etapa ou arraste-o. O diálogo explica pendências dos requisitos e coleta motivo/parecer quando necessário.

## Regras implementadas

- Nove etapas fixas. Os prazos das etapas são os definidos na especificação (12h; Aprovado 48h; conclusão sem prazo).
- Primeiro Fechamento Enviado e primeira Entrega das Chaves registram marcos permanentes. Perda e recuperação mantêm esses marcos, inclusive em relatórios e conversões.
- Cancelamento de Proposta é definitivo. Recuperações elegíveis duram 12h e retornam ao Fechamento Enviado no mesmo ID. Motivos judiciais podem tornar a reprovação definitiva.
- Pendência exige explicação e só retorna ao Fechamento Enviado. Gera notificações internas para Supervisão e Consultor.
- Direção exige parecer e registro do desfecho. Não há workflow de aprovação para diretores.
- Pessoas têm registros próprios e cônjuges relacionados por ID. Documentos e campos são validados por pessoa/entidade.
- Comentários são um feed; análise é um registro separado; auditoria registra ator, instante, campo, antes/depois e justificativa.
- Tarefas têm uma execução ativa por card. A sequência é preservada ao entrar na etapa; alterações de configuração valem para a próxima entrada. Retorno cria nova execução e exige refazer as tarefas seguintes, preservando todo histórico. SLA de tarefa e etapa coexistem.
- SAC agenda a entrega; esse horário passa a ser o prazo do card. A entrega efetiva deve ser confirmada antes da conclusão.
- Exclusão administrativa exige capacidade externa `delete` e justificativa; é lógica e preserva o histórico. A operação local padrão não concede essa capacidade administrativa.

## Persistência local

`src/fechamento/persistence/repository.ts` grava a base versionada na chave `adim-platform:v1`. Transações são serializadas, exigem Web Locks e recusam revisões concorrentes. Use Chrome ou Edge em localhost ou HTTPS. Sem esse recurso, a leitura e a exportação continuam disponíveis, mas a gravação é recusada para preservar a base. A UI mostra sucesso depois da gravação. Falhas de quota ou dados inválidos não apagam a base.

Cadastros e dados agregados do Comercial usam uma porta compatível com suas consultas anteriores; jornadas são uma projeção dos processos, não uma segunda coleção editável. Anexos locais têm limite de 2 MB por arquivo e também consomem a quota do navegador. O backup JSON inclui documentos e dados pessoais: mantenha-o nos locais já autorizados pela operação.

Os relógios são calculados por data/hora absoluta. Mesmo com o navegador fechado, uma recuperação expirada não pode ser executada; a auditoria de expiração é materializada na próxima atualização do painel. Não há serviço de mensagens externo conectado.

## Implantação na plataforma hospedeira

O hospedeiro ainda não foi identificado nesta sessão. O contrato fica em `src/fechamento/host.ts`. Antes da montagem do app, o hospedeiro fornece `window.adimPlatform` com:

| Propriedade                          | Responsabilidade                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `actor`                              | ID, nome e capacidades já autorizadas pelo hospedeiro                                              |
| `commercialScope`                    | Escopo empresarial ou unidades visíveis, sem nova matriz de perfis                                 |
| `commercialClient`                   | Cliente dos dados comerciais existentes, com autorização e persistência do hospedeiro              |
| `load()`                             | Carregar snapshot do Fechamento e catálogos comerciais compatíveis, limitados ao escopo autorizado |
| `execute(command, expectedRevision)` | Validar identidade no servidor, executar o domínio e gravar atomicamente com controle de revisão   |
| `upload(file, cardId)`               | Armazenar documento privado e retornar localização autorizada para download                        |
| `subscribe(listener)`                | Informar alterações externas para atualização das telas                                            |

O domínio em `src/fechamento/domain/operations.ts` é compartilhável com o servidor. A autorização enviada pelo navegador não substitui a verificação de sessão e capacidades no servidor. O adaptador deve obter o ator validado pelo hospedeiro e executar `execute(source, command, actor)` dentro da transação do repositório remoto.

O adaptador comercial deve usar a mesma origem de unidades/consultores/canais do snapshot para evitar cadastros divergentes. Notificações internas são registros persistentes; o hospedeiro pode entregá-las ao destinatário pelo mecanismo já existente. A V1 local não cria credenciais, RLS própria, matrizes de perfis nem disparos de e-mail.

**Estado de implantação:** a experiência local é executável; persistência compartilhada, identidade real, anexos privados e entrega externa de notificações dependem da conexão do adaptador. Não houve alteração de banco remoto nem publicação nesta sessão.

## Migração

**Backup V1:** exportar pelo painel; restaurar somente em base vazia, sem sobrescrever trabalho ativo. O original importado e a base anterior são preservados antes da confirmação.

**Comercial legado:** importar JSON contendo `jornadas` e, quando necessário, `tables` com cadastros, ciclos, metas e registros relacionados. Preservar IDs, valores, datas, marcos e históricos disponíveis. Conflitos e marcos sem data devem ser resolvidos explicitamente; não converter silenciosamente.

**Fechamento legado com colunas livres:** os nomes e significados das colunas variam. É necessário mapear cada coluna para o workflow V1 e reconciliar seus marcos históricos antes de importar. O importador recusa conversões ambíguas; a exportação original permanece preservada. Nenhuma base desse sistema foi fornecida nesta sessão.

## Validação

Os testes de domínio cobrem caminhos positivos, cancelamento, reprovação, recuperação, pendência, direção, gates, documentos, tarefas/retrabalho, SLA, soft delete, marcos e métricas. Os testes de persistência cobrem erros e concorrência. Playwright verifica telas comerciais sem login, proposta/movimentação, configurações e responsividade. As fixtures pertencem exclusivamente aos testes.

Resultados da validação local de 14/09/2026:

| Verificação                           | Resultado                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm test`                            | 75 testes passaram: domínio, persistência e migração                                                 |
| `npm run test:e2e`                    | 5 fluxos passaram no Chrome, incluindo registro diário, pré-leads, ciclos, metas e recarga da página |
| `npm run typecheck`                   | Passou                                                                                               |
| `npm run build`                       | Passou; avisos sobre tamanho de bundle e resolução de caminhos do Vite                               |
| ESLint dos arquivos alterados e novos | Sem erros; dois avisos de Fast Refresh                                                               |
| `git diff --check`                    | Sem erros de whitespace                                                                              |

O lint completo ainda encontra problemas nos arquivos legados fora do recorte alterado: predominantemente formatação e finais de linha CRLF, além de um `prefer-const`. As telas preservadas não foram reformatadas em massa.

As alterações estão na branch local `integracao-adim-v1`. O repositório de referência permaneceu intacto. Os testes usam o armazenamento de sessões isoladas do navegador; não validam uma implantação remota, migração de clientes reais ou conexão com banco compartilhado.
