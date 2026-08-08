# Registro Diário: preenchimento livre

Hoje o salvamento do dia bloqueia o lançamento quando os números não seguem a ordem do funil, exibindo erros como "Visitas não podem exceder os agendamentos do dia". Isso impede casos reais (ex.: visita de um agendamento feito em dia anterior).

## Mudança

Remover as travas de coerência ao salvar o registro diário, deixando cada campo (leads, atendimentos, agendamentos, visitas) livre:

- Sai o bloqueio de atendimentos maiores que leads.
- Sai o bloqueio de agendamentos maiores que atendimentos.
- Sai o bloqueio de visitas maiores que agendamentos.

Segue valendo: apenas números inteiros a partir de zero, gravação por consultor/dia, auditoria de cada alteração e os totais consolidados do dia — nada de banco, permissões ou métricas muda.

## Detalhe técnico

Em `src/routes/_authenticated/registro-diario.tsx`, remover o laço de validação dentro de `salvar.mutationFn` que lança os três erros; o restante do fluxo (upsert em `registros_diarios`, upsert de pré leads e `registrarAuditoria`) permanece igual.
