import { Notifications } from "./notifications";
import { currentActor } from "@/fechamento/host";

import {
  Building2,
  Filter,
  HandCoins,
  KanbanSquare,
  Plus,
  Search,
  Settings2,
  UserRound,
  X,
} from "lucide-react";
import type { CardFilters } from "@/fechamento/domain/types";
import { useBoard } from "../providers/board-provider";

export function BoardToolbar({
  filters,
  onFiltersChange,
  activeView,
  onViewChange,
  onAddClosing,
}: {
  filters: CardFilters;
  onFiltersChange: (filters: CardFilters) => void;
  activeView: "board" | "settings";
  onViewChange: (view: "board" | "settings") => void;
  onAddClosing: () => void;
}) {
  const { data } = useBoard();
  const board = { name: "Fechamentos", description: "Da proposta à conclusão" };
  const filterCount = [
    filters.unitId,
    filters.consultantId,
    filters.captorId,
    filters.channelId,
    filters.recovered,
  ].filter(Boolean).length;

  return (
    <>
      <header className="flex flex-wrap items-center gap-2 pb-4">
        <NavButton
          active={activeView === "board"}
          onClick={() => onViewChange("board")}
          icon={KanbanSquare}
        >
          Fechamentos
        </NavButton>
        {currentActor().permissions.includes("configure") && (
          <NavButton
            active={activeView === "settings"}
            onClick={() => onViewChange("settings")}
            icon={Settings2}
          >
            Configurações
          </NavButton>
        )}
        <Notifications />
        {currentActor().permissions.includes("write") && (
          <button type="button" onClick={onAddClosing} className="button-primary ml-auto">
            <Plus size={16} /> Nova proposta
          </button>
        )}
      </header>

      {activeView === "board" && (
        <div className="page-transition relative z-20">
          <div className="panel mb-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full min-w-52 flex-1 lg:max-w-sm">
                <Search
                  className="pointer-events-none absolute left-3 top-2.5 text-[var(--muted-foreground)]"
                  size={16}
                />
                <input
                  value={filters.query}
                  onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
                  className="input h-9 pl-9 pr-8"
                  placeholder="Buscar cards…"
                  aria-label="Buscar cards"
                />
                {filters.query && (
                  <button
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, query: "" })}
                    className="absolute right-2 top-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    aria-label="Limpar busca"
                  >
                    <X size={17} />
                  </button>
                )}
              </div>

              <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                <Filter size={14} /> Filtros
                <select
                  className="select-compact"
                  aria-label="Filtrar por canal"
                  value={filters.channelId}
                  onChange={(e) => onFiltersChange({ ...filters, channelId: e.target.value })}
                >
                  <option value="">Todos os canais</option>
                  {(data.tables["canais"] ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {String(c["nome"])}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={filters.recovered}
                    onChange={(e) => onFiltersChange({ ...filters, recovered: e.target.checked })}
                  />{" "}
                  Recuperados
                </label>
                {filterCount > 0 && (
                  <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--primary-foreground)]">
                    {filterCount}
                  </span>
                )}
              </span>
              <label className="relative">
                <Building2
                  size={13}
                  className="pointer-events-none absolute left-3 top-2.5 text-[var(--muted-foreground)]"
                />
                <select
                  className="select-compact min-w-40 pl-8"
                  value={filters.unitId}
                  onChange={(event) =>
                    onFiltersChange({
                      ...filters,
                      unitId: event.target.value,
                      consultantId: "",
                      captorId: "",
                    })
                  }
                  aria-label="Filtrar por unidade"
                >
                  <option value="">Todas as unidades</option>
                  {(data.tables["equipes"] ?? []).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {String(unit["nome"])}
                    </option>
                  ))}
                </select>
              </label>
              <select
                className="select-compact min-w-40"
                value={filters.consultantId}
                onChange={(event) =>
                  onFiltersChange({
                    ...filters,
                    consultantId: event.target.value,
                  })
                }
                aria-label="Filtrar por consultor"
              >
                <option value="">Todos os consultores</option>
                {(data.tables["consultores"] ?? [])
                  .filter((c) => !filters.unitId || c["equipe_id"] === filters.unitId)
                  .map((consultant) => (
                    <option key={consultant.id} value={consultant.id}>
                      {String(consultant["nome"])}
                    </option>
                  ))}
              </select>
              <select
                className="select-compact min-w-40"
                value={filters.captorId}
                onChange={(event) => onFiltersChange({ ...filters, captorId: event.target.value })}
                aria-label="Filtrar por captador"
              >
                <option value="">Todos os captadores</option>
                {data.catalogs
                  .filter(
                    (c) =>
                      c.kind === "captor" &&
                      (!filters.unitId || !c.unitId || c.unitId === filters.unitId),
                  )
                  .map((captor) => (
                    <option key={captor.id} value={captor.id}>
                      {captor.name}
                    </option>
                  ))}
              </select>
              {filterCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      query: filters.query,
                      unitId: "",
                      consultantId: "",
                      captorId: "",
                      channelId: "",
                      recovered: false,
                    })
                  }
                  className="button-ghost"
                >
                  <X size={14} /> Limpar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof KanbanSquare;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`press flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium transition ${
        active
          ? "bg-[var(--glass-strong)] text-[var(--foreground)] shadow-sm backdrop-blur-xl"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon size={17} /> <span className="inline">{children}</span>
    </button>
  );
}
