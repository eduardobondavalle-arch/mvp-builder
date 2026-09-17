import { useEffect, useRef, useState } from "react";
import type { TaskDefinition } from "../../domain/types";

type Props = {
  tasks: TaskDefinition[];
  activeTaskId: string | null;
  lastTaskId: string | null;
  executedTaskIds: string[];
  dueAt: string | null;
  now: number;
  disabled: boolean;
  onSelect: (taskId: string) => Promise<boolean>;
};

function remainingLabel(dueAt: string | null, now: number) {
  if (!dueAt) return "Sem tarefa ativa";
  const minutes = Math.ceil(Math.abs(Date.parse(dueAt) - now) / 60_000);
  const duration =
    minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}min` : `${minutes}min`;
  return Date.parse(dueAt) < now ? `Atrasada ${duration}` : `${duration} restantes`;
}

export function TaskWheelSelector({
  tasks,
  activeTaskId,
  lastTaskId,
  executedTaskIds,
  dueAt,
  now,
  disabled,
  onSelect,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);
  const hoverReady = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const [changing, setChanging] = useState(false);
  const selectedIndex = Math.max(
    0,
    tasks.findIndex((task) => task.id === (activeTaskId ?? lastTaskId)),
  );
  const executed = new Set(executedTaskIds);
  const waitingToStart = !activeTaskId && !lastTaskId;
  const canSelect = (index: number) =>
    !disabled &&
    !changing &&
    index >= 0 &&
    index < tasks.length &&
    (waitingToStart
      ? index === 0
      : index !== selectedIndex &&
        (index === selectedIndex + 1 || (index < selectedIndex && executed.has(tasks[index]!.id))));

  async function select(index: number) {
    if (!canSelect(index) || inFlight.current) return;
    inFlight.current = true;
    setChanging(true);
    try {
      await onSelect(tasks[index]!.id);
    } finally {
      setChanging(false);
      inFlight.current = false;
    }
  }

  const wheelAction = useRef<(direction: number) => void>(() => {});
  wheelAction.current = (direction) => {
    const index = selectedIndex + direction;
    if (canSelect(index)) void select(index);
  };
  const wheelAllowed = useRef<(direction: number) => boolean>(() => false);
  wheelAllowed.current = (direction) => canSelect(selectedIndex + direction);
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      if ((!hoverReady.current && document.activeElement !== element) || Math.abs(event.deltaY) < 5)
        return;
      const direction = event.deltaY > 0 ? 1 : -1;
      if (!wheelAllowed.current(direction)) return;
      event.preventDefault();
      wheelAction.current(direction);
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, []);

  const adjacent = [selectedIndex - 1, selectedIndex, selectedIndex + 1].filter(
    (index) => index >= 0 && index < tasks.length,
  );
  return (
    <div
      ref={rootRef}
      className={`task-wheel ${tasks.length === 0 ? "task-wheel--empty" : ""}`}
      role="group"
      aria-label="Seletor da tarefa atual"
      tabIndex={tasks.length ? 0 : -1}
      onPointerEnter={() => {
        hoverTimer.current = setTimeout(() => {
          hoverReady.current = true;
        }, 180);
      }}
      onPointerLeave={() => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverReady.current = false;
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        void select(selectedIndex + (event.key === "ArrowDown" ? 1 : -1));
      }}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const distance =
          touchStart.current - (event.changedTouches[0]?.clientY ?? touchStart.current);
        touchStart.current = null;
        if (Math.abs(distance) > 28) void select(selectedIndex + (distance > 0 ? 1 : -1));
      }}
    >
      <span className="task-wheel__caption">Tarefa atual</span>
      <div className="task-wheel__surface" aria-busy={changing}>
        <span className="task-wheel__indicator" aria-hidden="true" />
        {tasks.length === 0 ? (
          <span className="task-wheel__empty">Nenhuma tarefa configurada</span>
        ) : (
          adjacent.map((index) => {
            const task = tasks[index]!;
            const position = index - selectedIndex;
            return (
              <button
                key={task.id}
                type="button"
                className={`task-wheel__item task-wheel__item--${position === 0 ? "active" : position < 0 ? "previous" : "next"}`}
                title={task.name}
                aria-label={`${task.name}${position === 0 && activeTaskId ? ", tarefa atual" : ""}`}
                aria-current={position === 0 && activeTaskId ? "step" : undefined}
                disabled={!canSelect(index)}
                onClick={() => void select(index)}
              >
                <span className="task-wheel__number">{String(index + 1).padStart(2, "0")}</span>
                <span className="task-wheel__name">{task.name}</span>
              </button>
            );
          })
        )}
        <span className="task-wheel__glass" aria-hidden="true" />
      </div>
      {tasks.length > 0 && (
        <span
          className={`task-wheel__sla ${dueAt && Date.parse(dueAt) < now ? "task-wheel__sla--late" : ""}`}
        >
          {changing ? "Alterando tarefa…" : remainingLabel(dueAt, now)}
        </span>
      )}
    </div>
  );
}
