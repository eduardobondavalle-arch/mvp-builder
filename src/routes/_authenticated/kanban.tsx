import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { BoardProvider } from "@/fechamento/components/providers/board-provider";
import { KanbanBoard } from "@/fechamento/components/board/kanban-board";
export const Route = createFileRoute("/_authenticated/kanban")({
  head: () => ({ meta: [{ title: "Fechamento | Adim Aluguéis" }] }),
  component: () => (
    <AppShell
      title="Fechamento Locação"
      subtitle="Operação de contratos e entrega de chaves. Acompanhe cada fechamento até a entrega das chaves."
    >
      <BoardProvider>
        <KanbanBoard />
      </BoardProvider>
    </AppShell>
  ),
});
