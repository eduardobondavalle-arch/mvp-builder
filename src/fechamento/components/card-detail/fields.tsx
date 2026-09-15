import type { AppData, FieldDefinition, Person, Value } from "../../domain/types";
import type { PersonDraft } from "../../domain/operations";
import { emptyPerson } from "../../domain/operations";
import { Plus, UserRound, UsersRound, ShieldCheck } from "lucide-react";

export function fieldOptions(
  data: AppData,
  field: FieldDefinition,
  values: Record<string, Value> = {},
) {
  const table = (
    { unitId: "equipes", consultor_id: "consultores", canal_id: "canais" } as Record<string, string>
  )[field.id];
  if (table)
    return (data.tables[table] ?? [])
      .filter(
        (row) =>
          row["ativo"] !== false &&
          (field.id !== "consultor_id" ||
            !values["unitId"] ||
            row["equipe_id"] === values["unitId"]),
      )
      .map((row) => ({ id: row.id, name: String(row["nome"]) }));
  const kind = (
    {
      captorId: "captor",
      propertyTypeId: "property_type",
      captureOriginId: "capture_origin",
      guaranteeId: "guarantee",
      "analise.reasonId": "reason",
    } as Record<string, string>
  )[field.id];
  if (kind)
    return data.catalogs.filter(
      (c) =>
        c.kind === kind &&
        c.active &&
        (!c.unitId || !values["unitId"] || c.unitId === values["unitId"]),
    );
  return field.options.map((name) => ({ id: name, name }));
}
export function FieldControl({
  field,
  value,
  onChange,
  data,
  values = {},
  disabled = false,
}: {
  field: FieldDefinition;
  value: Value | undefined;
  onChange: (value: Value) => void;
  data: AppData;
  values?: Record<string, Value>;
  disabled?: boolean;
}) {
  if (field.type === "attachment") return null;
  const name = field.name;
  const control = {
    className: "input mt-1 text-sm normal-case tracking-normal",
    disabled,
    "aria-label": name,
  };
  return (
    <label className="field-label">
      {name}
      {field.requiredAt.length > 0 && (
        <span className="ml-1 text-primary" title="Obrigatoriedade definida por etapa">
          *
        </span>
      )}
      {field.type === "long_text" ? (
        <textarea
          {...control}
          rows={3}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "select" || field.type === "boolean" ? (
        <select
          {...control}
          value={value == null ? "" : String(value)}
          onChange={(e) =>
            onChange(
              field.type === "boolean"
                ? e.target.value === ""
                  ? null
                  : e.target.value === "true"
                : e.target.value,
            )
          }
        >
          <option value="">Selecione</option>
          {field.type === "boolean" ? (
            <>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </>
          ) : (
            fieldOptions(data, field, values).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))
          )}
        </select>
      ) : (
        <input
          {...control}
          type={
            field.type === "date"
              ? "date"
              : field.type === "datetime"
                ? "datetime-local"
                : ["number", "currency", "percentage"].includes(field.type)
                  ? "number"
                  : field.type === "phone"
                    ? "tel"
                    : "text"
          }
          step="any"
          min={field.type === "currency" || field.type === "percentage" ? 0 : undefined}
          max={field.type === "percentage" ? 100 : undefined}
          value={value == null ? "" : String(value)}
          onChange={(e) =>
            onChange(
              ["number", "currency", "percentage"].includes(field.type)
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
    </label>
  );
}
export function GeneralFields({
  data,
  values,
  custom,
  onChange,
  onCustom,
  includeIdentity = true,
}: {
  data: AppData;
  values: Record<string, Value>;
  custom: Record<string, Value>;
  onChange: (key: string, value: Value) => void;
  onCustom: (key: string, value: Value) => void;
  includeIdentity?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.fields
        .filter(
          (f) =>
            f.active &&
            f.section === "geral" &&
            (includeIdentity || !["cliente_nome", "cpf", "telefone"].includes(f.id)),
        )
        .map((field) => (
          <FieldControl
            key={field.id}
            field={field}
            data={data}
            values={values}
            value={field.native ? values[field.id] : custom[field.id]}
            onChange={(value) =>
              field.native ? onChange(field.id, value) : onCustom(field.id, value)
            }
          />
        ))}
    </div>
  );
}
export function PeopleEditor({
  data,
  people,
  onChange,
}: {
  data: AppData;
  people: PersonDraft[];
  onChange: (people: PersonDraft[]) => void;
}) {
  const update = (personId: string, key: string, value: Value, custom = false) =>
    onChange(
      people.map((p) =>
        p.id !== personId
          ? p
          : custom
            ? { ...p, custom: { ...p.custom, [key]: value } }
            : { ...p, [key]: value },
      ),
    );
  const labels: Record<Person["role"], string> = {
    locatario: "Locatário",
    fiador: "Fiador",
    conjuge: "Cônjuge",
    morador: "Morador",
  };
  return (
    <div className="space-y-7">
      {(["locatario", "fiador", "conjuge", "morador"] as const).map((role) => {
        const entries = people.filter((p) => p.role === role && p.active);
        const Icon = role === "fiador" ? ShieldCheck : role === "morador" ? UsersRound : UserRound;
        return (
          <section key={role}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Icon size={17} />
              {role === "conjuge"
                ? "Cônjuges"
                : role === "locatario"
                  ? "Locatários"
                  : role === "fiador"
                    ? "Fiadores"
                    : "Moradores"}
            </h3>
            <div className="space-y-3">
              {entries.map((person, index) => (
                <div
                  key={person.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold">
                      {labels[role]} {index + 1}
                    </p>
                    <button
                      type="button"
                      className="button-ghost text-rose-700"
                      onClick={() =>
                        onChange(
                          people.map((p) =>
                            p.id === person.id || p.relatedTo === person.id
                              ? { ...p, active: false }
                              : p,
                          ),
                        )
                      }
                    >
                      Remover pessoa
                    </button>
                  </div>
                  {role === "conjuge" && (
                    <label className="field-label mb-3">
                      Pessoa relacionada
                      <select
                        className="input mt-1"
                        value={person.relatedTo ?? ""}
                        onChange={(e) => update(person.id, "relatedTo", e.target.value || null)}
                      >
                        <option value="">Selecione o locatário / fiador</option>
                        {people
                          .filter((p) => p.active && ["locatario", "fiador"].includes(p.role))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name || labels[p.role]}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {data.fields
                      .filter((f) => f.active && f.section === role)
                      .map((field) => (
                        <FieldControl
                          key={field.id}
                          field={field}
                          data={data}
                          value={
                            field.native
                              ? (person as unknown as Record<string, Value>)[
                                  field.id.split(".").at(-1)!
                                ]
                              : person.custom[field.id]
                          }
                          onChange={(value) =>
                            update(
                              person.id,
                              field.native ? field.id.split(".").at(-1)! : field.id,
                              value,
                              !field.native,
                            )
                          }
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="button-secondary mt-3"
              onClick={() => onChange([...people, emptyPerson(role)])}
            >
              <Plus size={14} />
              Adicionar {labels[role].toLowerCase()}
            </button>
          </section>
        );
      })}
    </div>
  );
}
