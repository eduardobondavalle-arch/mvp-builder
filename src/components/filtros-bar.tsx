import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Canal, Ciclo, Consultor, Equipe } from "@/lib/data";
import type { Filtros } from "@/lib/metrics";

export function FiltrosBar({
  filtros,
  onChange,
  ciclos,
  equipes,
  consultores,
  canais,
}: {
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  ciclos: Ciclo[];
  equipes: Equipe[];
  consultores: Consultor[];
  canais: Canal[];
}) {
  const consultoresFiltrados =
    filtros.equipeId === "all"
      ? consultores
      : consultores.filter((c) => c.equipe_id === filtros.equipeId);

  const campos = [
    {
      label: "Ciclo",
      value: filtros.cicloId,
      onValueChange: (v: string) => onChange({ ...filtros, cicloId: v }),
      todos: "Todos os ciclos",
      options: ciclos.map((c) => ({
        value: c.id,
        label: `${c.nome}${c.status === "aberto" ? " • aberto" : ""}`,
      })),
    },
    {
      label: "Equipe",
      value: filtros.equipeId,
      onValueChange: (v: string) => onChange({ ...filtros, equipeId: v, consultorId: "all" }),
      todos: "Todas as equipes",
      options: equipes.map((e) => ({ value: e.id, label: e.nome })),
    },
    {
      label: "Consultor",
      value: filtros.consultorId,
      onValueChange: (v: string) => onChange({ ...filtros, consultorId: v }),
      todos: "Todos os consultores",
      options: consultoresFiltrados.map((c) => ({ value: c.id, label: c.nome })),
    },
    {
      label: "Canal de origem",
      value: filtros.canalId,
      onValueChange: (v: string) => onChange({ ...filtros, canalId: v }),
      todos: "Todos os canais",
      options: canais.map((c) => ({ value: c.id, label: c.nome })),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {campos.map((campo) => (
        <label key={campo.label} className="block">
          <span className="label-caps mb-1.5 block">{campo.label}</span>
          <Select value={campo.value} onValueChange={campo.onValueChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{campo.todos}</SelectItem>
              {campo.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ))}
    </div>
  );
}
