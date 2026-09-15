import { Bell } from "lucide-react";
import { useBoard } from "../providers/board-provider";
import { formatDate } from "../../utils";
import { currentActor } from "../../host";
export function Notifications() {
  const { data, mutate, pending } = useBoard();
  const unread = data.notifications.filter((n) => !n.readAt);
  return (
    <details className="relative">
      <summary className="button-secondary cursor-pointer list-none">
        <Bell size={15} />
        Notificações
        {unread.length > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-primary-foreground">
            {unread.length}
          </span>
        )}
      </summary>
      <div className="absolute left-0 top-11 z-40 max-h-80 w-[min(85vw,380px)] space-y-3 overflow-y-auto rounded-2xl border border-border bg-popover p-4 shadow-lg">
        {unread.map((n) => (
          <div key={n.id} className="rounded-xl border border-border p-3">
            <p className="text-xs font-semibold">
              {data.cards.find((c) => c.id === n.cardId)?.cliente_nome} ·{" "}
              {n.recipientKind === "supervisao" ? "Supervisão" : "Consultor"}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-xs">{n.body}</p>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {formatDate(n.createdAt, true)}
            </p>
            <button
              className="button-ghost mt-2"
              disabled={pending || !currentActor().permissions.includes("write")}
              onClick={() => void mutate({ type: "notification_read", notificationId: n.id })}
            >
              Marcar como lida
            </button>
          </div>
        ))}
        {!unread.length && (
          <p className="text-xs text-muted-foreground">Nenhuma notificação pendente.</p>
        )}
      </div>
    </details>
  );
}
