"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

export interface FieldRenderProps {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": "true" | undefined;
  "aria-required": "true" | undefined;
}

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Supply one to keep it stable across renders; otherwise `useId` provides it. */
  id?: string;
  className?: string;
  children: (props: FieldRenderProps) => React.ReactNode;
}

/**
 * Label + hint + error wrapper for a single form control.
 *
 * The child is a render prop rather than a plain node so `Field` can wire the
 * id and the aria-* attributes onto whatever control it wraps — `Input`,
 * `Select`, a `<textarea>` or a bare `<input>`:
 *
 * ```tsx
 * <Field label="Playlist name" hint="Shown on SoundCloud" error={nameError} required>
 *   {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} />}
 * </Field>
 * ```
 *
 * `aria-describedby` points at the hint, the error, or both in that order.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  id,
  className,
  children,
}: FieldProps) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={fieldId} className="text-sm font-semibold text-foreground">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      {children({
        id: fieldId,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? "true" : undefined,
        "aria-required": required ? "true" : undefined,
      })}

      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive-text">
          {error}
        </p>
      )}
    </div>
  );
}
