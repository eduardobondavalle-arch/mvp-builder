import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readLocal,
  writeLocal,
  localTransaction,
  STORAGE_KEY,
  sendCommand,
  validateSnapshot,
  CHANGE_EVENT,
} from "../src/fechamento/persistence/repository";
import { localCommercialClient } from "../src/fechamento/persistence/commercial-client";
import { createInitialData } from "../src/fechamento/domain/types";
import { emptyPerson } from "../src/fechamento/domain/operations";
let records: Map<string, string>;
let failWrites: boolean;
beforeEach(() => {
  records = new Map();
  failWrites = false;
  const target = Object.assign(new EventTarget(), {
    localStorage: {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failWrites) throw new Error("Quota exceeded");
        records.set(key, value);
      },
    },
  });
  vi.stubGlobal("window", target);
  vi.stubGlobal("navigator", {
    locks: { request: vi.fn(async (_key: string, operation: () => unknown) => operation()) },
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("persistência local unificada", () => {
  it("não substitui nem apaga uma base inválida", () => {
    records.set(STORAGE_KEY, "conteúdo preservado");
    expect(() => readLocal()).toThrow("preservados");
    expect(records.get(STORAGE_KEY)).toBe("conteúdo preservado");
  });
  it("falha de quota mantém a última versão confirmada", async () => {
    const source = createInitialData();
    writeLocal(source);
    failWrites = true;
    await expect(
      localTransaction((data) => ({ data: { ...data, revision: 1 }, result: true })),
    ).rejects.toThrow("Quota");
    expect(readLocal().revision).toBe(0);
  });
  it("rejeita revisão concorrente e não perde o comando já confirmado", async () => {
    const cmd = {
      type: "create" as const,
      values: {},
      people: [{ ...emptyPerson(), name: "Teste" }],
    };
    await sendCommand(cmd, 0);
    await expect(sendCommand(cmd, 0)).rejects.toThrow("outra aba");
    expect(readLocal().cards).toHaveLength(1);
  });
  it("mantém sequência de transações mesmo depois de uma falha", async () => {
    const first = localTransaction(() => {
      throw new Error("Falha controlada");
    });
    const second = localTransaction((data) => ({ data: { ...data, revision: 1 }, result: "ok" }));
    await expect(first).rejects.toThrow();
    await expect(second).resolves.toBe("ok");
    expect(readLocal().revision).toBe(1);
  });
  it("preserva cadastros, registros diários e upsert sem duplicação", async () => {
    const source = createInitialData();
    source.tables["consultores"]!.push({
      id: "c",
      nome: "Consultor",
      equipe_id: source.tables["equipes"]![0]!.id,
      ativo: true,
    });
    writeLocal(source);
    const payload = {
      consultor_id: "c",
      data: "2026-09-14",
      leads: 10,
      atendimentos: 8,
      agendamentos: 5,
      visitas: 3,
    };
    expect(
      (
        await localCommercialClient
          .from("registros_diarios")
          .upsert(payload, { onConflict: "consultor_id,data" })
      ).error,
    ).toBeNull();
    expect(
      (
        await localCommercialClient
          .from("registros_diarios")
          .upsert({ ...payload, visitas: 4 }, { onConflict: "consultor_id,data" })
      ).error,
    ).toBeNull();
    expect(readLocal().tables["registros_diarios"]).toHaveLength(1);
    expect(readLocal().tables["registros_diarios"]![0]!["visitas"]).toBe(4);
    expect(
      (
        await localCommercialClient
          .from("registros_diarios")
          .upsert({ ...payload, visitas: -1 }, { onConflict: "consultor_id,data" })
      ).error,
    ).not.toBeNull();
    expect(readLocal().tables["registros_diarios"]![0]!["visitas"]).toBe(4);
  });
  it("jornadas antigas não podem receber mutações pela porta comercial", async () => {
    expect(
      (await localCommercialClient.from("jornadas").insert({ cliente_nome: "Bypass" })).error
        ?.message,
    ).toContain("exclusivamente");
    expect(readLocal().cards).toHaveLength(0);
  });
  it("rejeita conteúdo vazio armazenado, sem substituí-lo por uma base inicial", () => {
    records.set(STORAGE_KEY, "");
    expect(() => readLocal()).toThrow("preservados");
    expect(records.get(STORAGE_KEY)).toBe("");
  });
  it("não grava snapshots inválidos nem emite confirmação", () => {
    const source = createInitialData();
    writeLocal(source);
    const confirmed = vi.fn();
    window.addEventListener(CHANGE_EVENT, confirmed);
    const broken = { ...source, cards: [{}] };
    expect(() => writeLocal(broken as never)).toThrow();
    expect(readLocal()).toEqual(source);
    expect(confirmed).not.toHaveBeenCalled();
  });
  it("recusa revisão incorreta, mesmo se a operação alterar o próprio argumento", async () => {
    writeLocal(createInitialData());
    await expect(
      localTransaction((source) => {
        source.revision = 99;
        return { data: source, result: true };
      }),
    ).rejects.toThrow("Revisão");
    expect(readLocal().revision).toBe(0);
  });
  it("transação sem alteração não grava nem emite atualização", async () => {
    writeLocal(createInitialData());
    const confirmed = vi.fn();
    window.addEventListener(CHANGE_EVENT, confirmed);
    failWrites = true;
    await expect(localTransaction((source) => ({ data: source, result: "ok" }))).resolves.toBe(
      "ok",
    );
    expect(confirmed).not.toHaveBeenCalled();
  });
  it("recusa gravação sem bloqueio entre abas e mantém leitura disponível", async () => {
    writeLocal(createInitialData());
    vi.stubGlobal("navigator", {});
    await expect(
      localTransaction((source) => ({ data: { ...source, revision: 1 }, result: true })),
    ).rejects.toThrow("Web Locks");
    expect(readLocal().revision).toBe(0);
  });
  it("detecta gravação externa durante a transação", async () => {
    writeLocal(createInitialData());
    await expect(
      localTransaction((source) => {
        const other = { ...source, revision: 8 };
        records.set(STORAGE_KEY, JSON.stringify(other));
        return { data: { ...source, revision: 1 }, result: true };
      }),
    ).rejects.toThrow("outra aba");
    expect(readLocal().revision).toBe(8);
  });
  it("valida IDs, tabelas, números finitos e formatos JSON sem remover extras", () => {
    const source = createInitialData();
    const withExtra = { ...source, extension: { importedBy: "origem" } };
    expect(validateSnapshot(withExtra)).toBe(withExtra);
    for (const invalid of [
      { ...source, revision: -1 },
      { ...source, revision: Number.MAX_SAFE_INTEGER + 1 },
      { ...source, tables: [] },
      {
        ...source,
        tables: {
          ...source.tables,
          canais: [
            { id: "x", nome: "Canal" },
            { id: "x", nome: "Duplicado" },
          ],
        },
      },
      { ...source, catalogs: [{ ...source.catalogs[0], active: "sim" }] },
      { ...source, extra: Infinity },
      { ...source, extra: undefined },
      JSON.parse(
        JSON.stringify(source).replace('"revision":0', '"revision":0,"__proto__":{"admin":true}'),
      ),
    ])
      expect(() => validateSnapshot(invalid)).toThrow();
  });
  it("valida referências internas, marcos e endereços de anexos em backups", async () => {
    await sendCommand(
      { type: "create", values: {}, people: [{ ...emptyPerson(), name: "Teste" }] },
      0,
    );
    const source = readLocal();
    const cases = [
      (data: typeof source) => {
        data.people[0]!.cardId = "inexistente";
      },
      (data: typeof source) => {
        data.cards[0]!.stageRunId = "inexistente";
      },
      (data: typeof source) => {
        data.cards[0]!.atingiu_fechamento = true;
      },
      (data: typeof source) => {
        data.activities = data.activities.filter((event) => event.type !== "milestone.proposal");
      },
      (data: typeof source) => {
        data.attachments.push({
          id: "attachment",
          cardId: data.cards[0]!.id,
          personId: null,
          documentId: "",
          fieldId: null,
          filename: "Arquivo",
          mimeType: "text/html",
          size: 12,
          storagePath: "",
          url: "javascript:alert(1)",
          uploaderId: "local",
          createdAt: new Date().toISOString(),
          removedAt: null,
        });
      },
    ];
    for (const mutate of cases) {
      const invalid = structuredClone(source);
      mutate(invalid);
      expect(() => validateSnapshot(invalid)).toThrow();
    }
    expect(readLocal()).toEqual(source);
  });
  it("não sobrescreve pré-leads com chaves ausentes ou datas inválidas", async () => {
    expect(
      (
        await localCommercialClient
          .from("pre_leads_diarios")
          .upsert({ data: "2026-09-14", quantidade: 8 }, { onConflict: "data" })
      ).error,
    ).toBeNull();
    const source = readLocal();
    for (const [payload, onConflict] of [
      [{ quantidade: 15 }, "data"],
      [{ data: "2026-02-30", quantidade: 15 }, "data"],
      [{ data: "2026-09-14", quantidade: 15 }, ""],
    ] as const) {
      expect(
        (await localCommercialClient.from("pre_leads_diarios").upsert(payload, { onConflict }))
          .error,
      ).not.toBeNull();
      expect(readLocal()).toEqual(source);
    }
  });
  it("protege IDs, criação, unicidade comercial e lotes atômicos", async () => {
    expect(
      (await localCommercialClient.from("canais").insert({ id: "canal", nome: "Site" })).error,
    ).toBeNull();
    const source = readLocal();
    for (const query of [
      localCommercialClient.from("canais").update({ id: "novo" }).eq("id", "canal"),
      localCommercialClient.from("canais").update({ created_at: "2020-01-01" }).eq("id", "canal"),
      localCommercialClient.from("canais").insert({ id: "canal", nome: "Outro" }),
      localCommercialClient.from("canais").insert({ id: "outro", nome: "Site" }),
      localCommercialClient.from("canais").insert([
        { id: "valido", nome: "Válido" },
        { id: "invalido", nome: "" },
      ]),
    ]) {
      expect((await query).error).not.toBeNull();
      expect(readLocal()).toEqual(source);
    }
  });
  it("respeita single/maybeSingle e executa a mesma consulta de gravação só uma vez", async () => {
    expect((await localCommercialClient.from("canais").select().single()).error).not.toBeNull();
    expect((await localCommercialClient.from("canais").select().maybeSingle()).data).toBeNull();
    expect(
      (await localCommercialClient.from("equipes").select().maybeSingle()).error,
    ).not.toBeNull();
    const insert = localCommercialClient.from("canais").insert({ nome: "Site" }).select().single();
    const results = await Promise.all([insert, insert]);
    expect(results[0]).toEqual(results[1]);
    expect(readLocal().tables["canais"]).toHaveLength(1);
    expect(readLocal().revision).toBe(1);
    const previous = readLocal();
    expect(
      (
        await localCommercialClient
          .from("canais")
          .insert([{ nome: "Social" }, { nome: "Email" }])
          .single()
      ).error,
    ).not.toBeNull();
    expect(readLocal()).toEqual(previous);
  });
  it("mantém auditoria imutável e expõe eventos legados sem eventos globais", async () => {
    expect(
      (
        await localCommercialClient
          .from("auditoria")
          .insert({ id: "audit", entidade: "canal", acao: "criado", usuario: "outro" })
      ).error,
    ).toBeNull();
    expect(
      (await localCommercialClient.from("auditoria").update({ acao: "apagado" }).eq("id", "audit"))
        .error,
    ).not.toBeNull();
    expect(readLocal().tables["auditoria"]![0]!["usuario"]).toBe("Operação local");
    const source = readLocal();
    source.tables["jornada_eventos"] = [
      {
        id: "legacy",
        jornada_id: "original",
        tipo: "transferencia",
        detalhes: { consultor_anterior: "c1" },
        created_at: "2026-09-14T12:00:00Z",
      },
    ];
    source.activities.push({
      id: "config",
      cardId: "",
      actorId: "local",
      actorName: "Local",
      type: "config",
      message: "Configuração",
      field: null,
      before: null,
      after: null,
      justification: null,
      createdAt: "2026-09-14T12:00:00Z",
    });
    writeLocal(source);
    expect((await localCommercialClient.from("jornada_eventos").select()).data).toEqual(
      source.tables["jornada_eventos"],
    );
  });
});
