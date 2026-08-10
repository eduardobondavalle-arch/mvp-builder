import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Canal, Ciclo, Consultor, Equipe } from "@/lib/data";
import { filtrosVazios, type Filtros } from "@/lib/metrics";

export function FiltrosBar({
  filtros,
  onChange,
  ciclos,
  equipes,
  consultores,
  canais,
  mostrarPeriodo = true,
}: {
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  ciclos: Ciclo[];
  equipes: Equipe[];
  consultores: Consultor[];
  canais: Canal[];
  /** Quando falso, esconde os campos de ciclo e datas (o período vem de fora). */
  mostrarPeriodo?: boolean;
}) {
  const consultoresFiltrados =
    filtros.equipeId === "all"
      ? consultores
      : consultores.filter((c) => c.equipe_id === filtros.equipeId);


  const campos = [
    ...(mostrarPeriodo
      ? [{
      label: "Ciclo",
      value: filtros.cicloId,
      onValueChange: (v: string) => onChange({ ...filtros, cicloId: v }),
      todos: "Todos os ciclos",
      options: ciclos.map((c) => ({
        value: c.id,
        label: `${c.nome}${c.status === "aberto" ? " • aberto" : ""}`,
      })),
    }]
      : []),
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
      options: consultoresFiltrados.map((c) => ({
        value: c.id,
        label: c.ativo ? c.nome : `${c.nome} (inativo)`,
      })),
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
    <div className="space-y-3">
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
      {mostrarPeriodo && (
      <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <span className="label-caps mb-1.5 block">Período — de</span>
          <Input
            type="date"
            value={filtros.de}
            onChange={(e) => onChange({ ...filtros, de: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label-caps mb-1.5 block">Período — até</span>
          <Input
            type="date"
            value={filtros.ate}
            onChange={(e) => onChange({ ...filtros, ate: e.target.value })}
          />
        </label>
        <p className="text-xs text-muted-foreground xl:col-span-1">
          Sem período informado, o recorte usa as datas do ciclo selecionado.
        </p>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onChange(filtrosVazios)}>
            Limpar filtros
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}
