"use client";

import * as React from "react";
import { cn } from "../../ui/lib/utils";
import type { TablePayload } from "../types";

interface TableRendererProps {
  payload: TablePayload;
  className?: string;
}

export function TableRenderer({ payload, className }: TableRendererProps) {
  const { columns, rows, caption } = payload;

  return (
    <div
      className={cn(
        "csdk-genui-table w-full overflow-x-auto rounded-md border border-border",
        className,
      )}
    >
      <table className="w-full min-w-full text-sm">
        {caption && (
          <caption className="px-3 pt-2 pb-1 text-left text-xs text-muted-foreground">
            {caption}
          </caption>
        )}
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "whitespace-nowrap px-3 py-2 font-medium text-foreground",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  (!col.align || col.align === "left") && "text-left",
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-4 text-center text-sm text-muted-foreground"
              >
                No data
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  "border-b border-border last:border-0",
                  i % 2 === 1 && "bg-muted/20",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-3 py-2 text-foreground/90",
                      col.align === "right" && "text-right tabular-nums",
                      col.align === "center" && "text-center",
                      (!col.align || col.align === "left") && "text-left",
                    )}
                  >
                    {row[col.key] === null || row[col.key] === undefined
                      ? "—"
                      : String(row[col.key])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
