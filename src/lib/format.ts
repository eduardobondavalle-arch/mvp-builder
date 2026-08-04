export const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v ?? 0);

export const pct = (v: number | null | undefined, digits = 1) =>
  `${(v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: digits })}%`;

export const dateBR = (v: string | null | undefined) => {
  if (!v) return "—";
  const [y, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const daysBetween = (a: string, b: string) =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
