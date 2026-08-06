# Identidade visual Adim Aluguéis

Aplicar no painel a marca e o visual do site oficial adimalugueis.com.br.

## Marca

- Baixar a logo oficial (símbolo laranja + wordmark "ADiM aluguéis") do site e usá-la no cabeçalho do app, substituindo o ícone genérico de prédio e o texto "Adim Aluguéis / Inteligência Comercial".
- Gerar o favicon a partir do símbolo laranja da logo (versão quadrada pequena em `public/`) e trocar o favicon padrão do Lovable.

## Visual

O site oficial é claro e limpo: fundo branco, superfícies cinza muito claro (#f6f6f6), texto preto e laranja (#ea4c02 / #ed4c00) como cor de ação. O painel hoje é escuro. Proposta: migrar para esse tema claro para ficar coerente com a marca.

- Fundo branco, cartões brancos com borda cinza clara, seções secundárias em cinza #f6f6f6.
- Laranja da marca como `primary` (botões, links, destaques, barras de meta, etapas do funil) e cor 1 dos gráficos.
- Tipografia sem serifa próxima à do site (Montserrat/Inter), mantendo o mono só nos números grandes de métricas.
- Sombras suaves e cantos arredondados discretos, no lugar do brilho/glow do tema escuro.
- Estados semânticos mantidos: verde para sucesso/meta atingida, vermelho para perda/alerta.

## Escopo técnico

- `src/styles.css`: reescrever os tokens de `:root` para a paleta clara da marca (background, card, primary laranja, muted, border, chart-1..5), ajustar `--shadow-panel`/`--shadow-glow` e o gradiente do body.
- `src/routes/__root.tsx`: fonte do site via `<link>` no head e novo `rel="icon"`.
- `src/components/app-shell.tsx`: logo importada como asset no cabeçalho.
- `src/components/funil-visual.tsx` e demais telas: revisar só onde houver contraste ruim no tema claro (nenhuma regra de negócio muda).

Nada de lógica, dados ou banco é alterado — apenas apresentação.
