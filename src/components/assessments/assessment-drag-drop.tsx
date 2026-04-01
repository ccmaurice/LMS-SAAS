"use client";

import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { DragDropBankItem, DragDropTarget } from "@/lib/assessments/drag-drop-schema";

type Props = {
  questionId: string;
  targets: DragDropTarget[];
  bank: DragDropBankItem[];
  valueJson: string;
  onChange: (json: string) => void;
  disabled?: boolean;
};

function parseAssignments(raw: string): Record<string, string> {
  try {
    const j = JSON.parse(raw) as { assignments?: Record<string, string> };
    if (j.assignments && typeof j.assignments === "object") return { ...j.assignments };
  } catch {
    /* ignore */
  }
  return {};
}

export function AssessmentDragDrop({ questionId, targets, bank, valueJson, onChange, disabled }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const assignments = useMemo(() => parseAssignments(valueJson), [valueJson]);

  const setAssignments = useCallback(
    (next: Record<string, string>) => {
      onChange(JSON.stringify({ assignments: next }));
    },
    [onChange],
  );

  const placedBankIds = useMemo(() => new Set(Object.values(assignments)), [assignments]);

  const unplacedBank = useMemo(
    () => bank.filter((b) => !placedBankIds.has(b.id)),
    [bank, placedBankIds],
  );

  const onDropOnTarget = (targetId: string, bankId: string | null) => {
    if (disabled) return;
    const next = { ...assignments };
    const prevBankAtTarget = next[targetId];
    if (bankId === null) {
      delete next[targetId];
    } else {
      for (const [tid, bid] of Object.entries(next)) {
        if (bid === bankId && tid !== targetId) delete next[tid];
      }
      next[targetId] = bankId;
    }
    if (prevBankAtTarget && prevBankAtTarget !== bankId) {
      /* previous chip returns to pool implicitly via unplacedBank */
    }
    setAssignments(next);
  };

  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        Drag items into the matching slots. You can clear a slot by dragging back to the bank or using the × control.
      </p>
      <div
        className="flex flex-wrap gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 p-3 dark:border-white/15"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const fromTarget = e.dataTransfer.getData("application/x-from-target");
          if (fromTarget) {
            const next = { ...assignments };
            delete next[fromTarget];
            setAssignments(next);
          }
          setDraggingId(null);
        }}
      >
        <p className="w-full text-xs font-medium text-foreground/80">Answer bank</p>
        {unplacedBank.map((b) => (
          <button
            key={b.id}
            type="button"
            draggable={!disabled}
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-bank-id", b.id);
              e.dataTransfer.setData("application/x-from-target", "");
              e.dataTransfer.effectAllowed = "move";
              setDraggingId(b.id);
            }}
            onDragEnd={() => setDraggingId(null)}
            disabled={disabled}
            className={cn(
              "rounded-lg border border-border bg-card px-3 py-2 text-left text-sm shadow-sm transition",
              !disabled && "cursor-grab active:cursor-grabbing",
              draggingId === b.id && "opacity-60",
            )}
          >
            {b.text}
          </button>
        ))}
        {unplacedBank.length === 0 ? (
          <span className="text-xs text-muted-foreground">All items placed (or empty).</span>
        ) : null}
      </div>

      <ul className="space-y-3">
        {targets.map((t) => {
          const bid = assignments[t.id];
          const item = bid ? bank.find((x) => x.id === bid) : null;
          return (
            <li
              key={t.id}
              className="rounded-xl border border-border bg-card/50 p-3 dark:border-white/10"
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("application/x-bank-id") || e.dataTransfer.getData("text/plain");
                if (id) onDropOnTarget(t.id, id);
                setDraggingId(null);
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{t.label}</span>
                {item && !disabled ? (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    onClick={() => {
                      const next = { ...assignments };
                      delete next[t.id];
                      setAssignments(next);
                    }}
                  >
                    Clear slot
                  </button>
                ) : null}
              </div>
              <div
                className={cn(
                  "mt-2 min-h-[44px] rounded-lg border-2 border-dashed px-2 py-2 text-sm",
                  item ? "border-primary/40 bg-primary/5" : "border-muted-foreground/25 text-muted-foreground",
                )}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("application/x-bank-id") || e.dataTransfer.getData("text/plain");
                  if (id) onDropOnTarget(t.id, id);
                  setDraggingId(null);
                }}
              >
                {item ? (
                  <span
                    draggable={!disabled}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-bank-id", item.id);
                      setDraggingId(item.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={cn(!disabled && "cursor-grab")}
                  >
                    {item.text}
                  </span>
                ) : (
                  "Drop answer here"
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <span className="sr-only" id={`dd-status-${questionId}`}>
        {Object.keys(assignments).length} of {targets.length} slots filled
      </span>
    </div>
  );
}
