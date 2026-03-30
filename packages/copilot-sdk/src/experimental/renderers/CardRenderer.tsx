"use client";

import * as React from "react";
import { cn } from "../../ui/lib/utils";
import type { CardPayload } from "../types";

interface CardRendererProps {
  payload: CardPayload;
  className?: string;
}

export function CardRenderer({ payload, className }: CardRendererProps) {
  const { title, subtitle, fields, body, cta } = payload;

  return (
    <div
      className={cn(
        "csdk-genui-card flex flex-col gap-3 rounded-lg border border-border bg-card p-4",
        className,
      )}
    >
      {/* Header */}
      <div>
        <p className="text-sm font-semibold leading-snug text-foreground">
          {title}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* Key-value fields */}
      {fields && fields.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
          {fields.map((field, i) => (
            <React.Fragment key={i}>
              <dt className="self-center whitespace-nowrap text-xs text-muted-foreground">
                {field.label}
              </dt>
              <dd className="text-xs text-foreground">
                {field.badge ? (
                  <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-foreground">
                    {String(field.value)}
                  </span>
                ) : (
                  String(field.value)
                )}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      )}

      {/* Body */}
      {body && (
        <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
      )}

      {/* CTA */}
      {cta && (
        <a
          href={cta.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          {cta.label} ↗
        </a>
      )}
    </div>
  );
}
