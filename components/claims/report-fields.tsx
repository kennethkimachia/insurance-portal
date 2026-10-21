"use client";

import type { ComponentProps } from "react";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ReportField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  multiline,
  maxLength = 500,
  ...props
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  multiline?: boolean;
} & Omit<ComponentProps<typeof Input>, "id" | "value" | "onChange">) {
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          rows={4}
          aria-invalid={!!error}
          aria-describedby={describedBy}
        />
      ) : (
        <Input
          {...props}
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={describedBy}
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  );
}

export function ReportSelect({
  id,
  label,
  value,
  onChange,
  options,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  error?: string;
  hint?: string;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
        aria-describedby={
          [hint && `${id}-hint`, error && `${id}-error`]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/20 h-10 w-full rounded-lg border px-3 text-base shadow-xs md:text-sm outline-none focus-visible:ring-3 aria-invalid:border-destructive"
      >
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  );
}

export const ANSWER_OPTIONS: Array<[string, string]> = [
  ["unknown", "Not known yet"],
  ["yes", "Yes"],
  ["no", "No"],
];
