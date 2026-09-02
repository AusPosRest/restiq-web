"use client";

// Non-pointer accessibility fallback for the canvas (EXPERIENCE.md
// Accessibility Floor: "Floor-plan canvas provides a list-view alternative
// for non-pointer interaction"). Same floors/tables data as the canvas, as a
// plain table with editable label/shape/x/y/capacity fields - no drag math
// needed here, just values a keyboard or screen-reader user can type/pick
// directly. Also the table-level rename/delete surface (issue #109): a table
// has no "detail view" of its own, so its row here is the one place to edit
// its label or shape and to delete it.
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { groupTablesByFloor, TABLE_SHAPES, type DiningTableView, type FloorView } from "./floor-plan-state";

export type EditableTableField = "x" | "y" | "seatCapacity" | "label" | "shape" | "width" | "height";

export interface FloorPlanListViewProps {
  floors: readonly FloorView[];
  tables: readonly DiningTableView[];
  onFieldCommitted: (tableId: string, field: EditableTableField, value: number | string) => void;
  onDeleteRequested: (tableId: string) => void;
}

export function FloorPlanListView({ floors, tables, onFieldCommitted, onDeleteRequested }: Readonly<FloorPlanListViewProps>) {
  const groups = groupTablesByFloor(floors, tables);

  if (tables.length === 0) {
    return (
      <p data-testid="floor-plan-list-empty" className="rounded-lg border border-dashed border-border/60 bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
        No tables laid out on this floor plan yet.
      </p>
    );
  }

  return (
    <div data-testid="floor-plan-list-view" className="overflow-x-auto rounded-lg border border-border/40 bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 font-semibold">Floor</th>
            <th className="px-4 py-3 font-semibold">Label</th>
            <th className="px-4 py-3 font-semibold">Shape</th>
            <th className="px-4 py-3 font-semibold">X</th>
            <th className="px-4 py-3 font-semibold">Y</th>
            <th className="px-4 py-3 font-semibold">Capacity</th>
            <th className="px-4 py-3 font-semibold">Width</th>
            <th className="px-4 py-3 font-semibold">Height</th>
            <th className="px-4 py-3 font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.flatMap(({ floor, tables: floorTables }) =>
            floorTables.map((table) => (
              <tr key={table.id} data-testid={`floor-plan-list-row-${table.id}`} className="border-b border-border/20 last:border-0">
                <td className="px-4 py-2 text-muted-foreground">{floor.name}</td>
                <td className="px-4 py-2 font-medium">
                  <TextField
                    key={table.label}
                    testId={`floor-plan-list-label-${table.id}`}
                    label={`${table.label} label`}
                    value={table.label}
                    onCommit={(value) => onFieldCommitted(table.id, "label", value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    aria-label={`${table.label} shape`}
                    data-testid={`floor-plan-list-shape-${table.id}`}
                    value={table.shape}
                    onChange={(event) => onFieldCommitted(table.id, "shape", event.target.value)}
                    className="rounded-md border border-border bg-input px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {TABLE_SHAPES.map((shape) => (
                      <option key={shape} value={shape}>
                        {shape}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <NumberField
                    key={table.x}
                    testId={`floor-plan-list-x-${table.id}`}
                    label={`${table.label} X position`}
                    value={table.x}
                    min={0}
                    onCommit={(value) => onFieldCommitted(table.id, "x", value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <NumberField
                    key={table.y}
                    testId={`floor-plan-list-y-${table.id}`}
                    label={`${table.label} Y position`}
                    value={table.y}
                    min={0}
                    onCommit={(value) => onFieldCommitted(table.id, "y", value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <NumberField
                    key={table.seatCapacity}
                    testId={`floor-plan-list-capacity-${table.id}`}
                    label={`${table.label} seat capacity`}
                    value={table.seatCapacity}
                    min={1}
                    onCommit={(value) => onFieldCommitted(table.id, "seatCapacity", value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <NumberField
                    key={table.width}
                    testId={`floor-plan-list-width-${table.id}`}
                    label={`${table.label} width`}
                    value={table.width}
                    min={24}
                    onCommit={(value) => onFieldCommitted(table.id, "width", value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <NumberField
                    key={table.height}
                    testId={`floor-plan-list-height-${table.id}`}
                    label={`${table.label} height`}
                    value={table.height}
                    min={24}
                    onCommit={(value) => onFieldCommitted(table.id, "height", value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    aria-label={`Delete ${table.label}`}
                    data-testid={`floor-plan-list-delete-${table.id}`}
                    onClick={() => onDeleteRequested(table.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-status-error/10 hover:text-status-error focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function NumberField({
  testId,
  label,
  value,
  min,
  onCommit,
}: Readonly<{ testId: string; label: string; value: number; min: number; onCommit: (value: number) => void }>) {
  // No prop-sync effect: the parent keys this field on `value` (see the
  // three call sites above), so an external change - a successful save or a
  // rollback after a rejected overlap - remounts it with a fresh draft
  // instead of racing a setState-in-effect against the user's own typing.
  const [draft, setDraft] = useState(String(value));

  function commit() {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isFinite(parsed) && parsed >= min) {
      if (parsed !== value) onCommit(parsed);
    } else {
      setDraft(String(value));
    }
  }

  return (
    <input
      type="number"
      aria-label={label}
      data-testid={testId}
      value={draft}
      min={min}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="w-20 rounded-md border border-border bg-input px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function TextField({
  testId,
  label,
  value,
  onCommit,
}: Readonly<{ testId: string; label: string; value: string; onCommit: (value: string) => void }>) {
  // Same remount-on-external-change contract as NumberField above.
  const [draft, setDraft] = useState(value);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    else setDraft(value);
  }

  return (
    <input
      type="text"
      aria-label={label}
      data-testid={testId}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="w-28 rounded-md border border-border bg-input px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}
