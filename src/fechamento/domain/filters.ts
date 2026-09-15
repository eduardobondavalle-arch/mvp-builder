import type { AppData, CardFilters } from "./types";
export function filterCards(data: AppData, filters: CardFilters) {
  const query = filters.query.trim().toLocaleLowerCase("pt-BR");
  return data.cards.filter(
    (card) =>
      !card.deletedAt &&
      (!filters.unitId || card.unitId === filters.unitId) &&
      (!filters.consultantId || card.consultor_id === filters.consultantId) &&
      (!filters.captorId || card.captorId === filters.captorId) &&
      (!filters.channelId || card.canal_id === filters.channelId) &&
      (!filters.recovered || card.recovered) &&
      (!query ||
        `${card.cliente_nome} ${card.cpf} ${card.imovel} ${card.address}`
          .toLocaleLowerCase("pt-BR")
          .includes(query)),
  );
}
