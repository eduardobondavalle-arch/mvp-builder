import { createInitialData as empty } from "../src/fechamento/domain/types";
export function createInitialData() {
  const data = empty();
  data.tables["consultores"]!.push({
    id: "consultant",
    nome: "Consultor E2E",
    equipe_id: data.tables["equipes"]![0]!.id,
    ativo: true,
  });
  data.tables["canais"]!.push({ id: "channel", nome: "Site", ativo: true });
  data.tables["motivos_perda"]!.push({ id: "reason", nome: "Desistência", ativo: true });
  data.catalogs.push({
    id: "reason",
    kind: "reason",
    name: "Desistência",
    unitId: "",
    active: true,
    definitive: false,
  });
  return data;
}
