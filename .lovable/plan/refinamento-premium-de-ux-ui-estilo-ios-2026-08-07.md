# Refinamento premium de UX/UI (estilo iOS)

Nenhuma regra de negócio, consulta, tabela ou funcionalidade muda. Todo o trabalho é de apresentação, animação e percepção de velocidade.

## 1. Design system unificado

Padronizar tokens em `src/styles.css` e usá-los em todos os componentes:

- Escala de raio única (sm/md/lg/xl/2xl derivada de `--radius`).
- Três níveis de sombra: `--shadow-sm` (cards), `--shadow-md` (popovers/dropdowns), `--shadow-lg` (modais).
- Escala de espaçamento consistente para seções, cards e formulários (mais respiro: cards com padding maior, seções com separação uniforme).
- Tipografia refinada: pesos e tamanhos definidos para título de página, título de card, rótulo e número (mono só nos KPIs), com `text-wrap: balance` nos títulos.
- Ícones sempre no mesmo tamanho por contexto (18px navegação, 16px botões, 20px cabeçalhos de card).
- Altura padrão de controles: botões e inputs alinhados na mesma altura.
- Glassmorphism mais leve: reduzir a saturação/opacidade atual para um vidro discreto, com borda de 1px em `border/60`.

## 2. Curvas e durações de animação

Tokens de movimento: `--ease-ios: cubic-bezier(0.32, 0.72, 0, 1)`, `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` e durações de 180ms / 220ms / 280ms. Todas as animações do app passam a usar apenas esses valores (hoje a transição de página usa 420ms).

Um único bloco `@media (prefers-reduced-motion: reduce)` desliga transformações e animações de entrada em todo o sistema.

## 3. Animações e microinterações

- **Página:** fade + slide curto (220ms) no `<main>`, já keyed pelo pathname.
- **Cards / KPIs:** entrada em cascata com atraso escalonado por índice (utilitário `stagger-in` + variável de delay), sem re-render extra.
- **Botões:** `active:scale-[0.97]` + transição de cor/sombra em 180ms, aplicado nas variantes do `Button`.
- **Inputs / selects:** anel de foco animado e leve elevação ao focar.
- **Modais / dialogs:** escala 0.96 → 1 com fade; overlay com blur suave.
- **Dropdown / popover / select:** deslizamento a partir da borda de origem.
- **Tabs e filtros:** indicador de aba com transição suave; troca de filtro sem piscar a tela (dados anteriores mantidos enquanto atualiza).
- **Tabelas:** linhas aparecendo progressivamente na primeira renderização, com hover de linha suave.
- **Tooltips:** fade + escala rápida.
- **Gráficos e funil:** animação de entrada na primeira renderização (Recharts `animationDuration` alinhado aos tokens; barras do funil crescendo).

## 4. Loading sem telas em branco

- Criar componentes de skeleton reutilizáveis: `SkeletonCard`, `SkeletonTable`, `SkeletonKpi`.
- Substituir os textos "Carregando…" e estados vazios de carregamento em Dashboard, Kanban, Auditoria, Acessos, Cadastros, Ciclos e Registro Diário por skeletons com o formato do conteúdo final.
- Manter dados anteriores visíveis durante refetch (placeholder de dados anteriores) para que filtros não causem flash.

## 5. Performance percebida

- Pré-carregar rotas no hover/foco dos itens de navegação (preload por intenção no router).
- Cache do React Query com `staleTime` e `gcTime` adequados para que voltar a uma aba já visitada seja instantâneo.
- Manter estado local dos filtros/abas ao navegar dentro do módulo.
- Memoizar listas e cálculos derivados pesados nas telas grandes (Dashboard, Kanban, Ciclos) para cortar re-renderizações.
- Deixar `willChange`/composição só onde há transform, evitando animações que forcem layout.

## 6. Responsividade

- Cabeçalho: logo + navegação com rolagem horizontal em pílulas no celular; grid `minmax(0,1fr) auto` para não quebrar o título.
- Grids de KPI/cards: 1 coluna no celular, 2 no tablet, 4 no desktop.
- Tabelas largas com rolagem horizontal suave e cabeçalho fixo.
- Áreas de toque mínimas de 44px nos controles principais.

## 7. Acessibilidade

- Contraste revisado nos textos secundários e badges nos dois temas.
- Foco visível em todos os controles interativos.
- `aria-label` nos botões só com ícone.

## Detalhes técnicos

Arquivos afetados: `src/styles.css` (tokens, utilitários de animação, reduced-motion), `src/components/app-shell.tsx`, `src/components/ui/*` (button, card, input, select, dialog, dropdown-menu, popover, table, tabs, tooltip, skeleton), `src/components/funil-visual.tsx`, `src/components/filtros-bar.tsx`, os diálogos existentes e as telas em `src/routes/_authenticated/*`, além de `src/router.tsx` (preload/defaults do Query) e `src/routes/auth.tsx`.

Nenhum arquivo de dados, migração, `src/lib/data.ts`, `src/lib/metrics.ts` ou política de acesso é alterado.

Ao final, publico o app.
