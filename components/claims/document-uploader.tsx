"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldSet, FieldLegend } from "@/components/ui/field";
import { Upload, FileText, X, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  evidenceAccept,
  validateEvidenceSelection,
  validateEvidenceTotals,
} from "@/lib/claim-evidence";

export interface DocumentCategory {
  key: string;
  label: string;
  description: string;
  required?: boolean;
  accept?: string;
  multiple: boolean;
  lossItemId?: string;
}
export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  lossItemId?: string;
  status?: "selected" | "uploading" | "uploaded" | "failed";
  progress?: number;
  error?: string;
  attachmentId?: string;
}
export interface DocumentUploads {
  [categoryKey: string]: UploadedFile[];
}

interface DocumentUploaderProps {
  categories: DocumentCategory[];
  uploads: DocumentUploads;
  onUploadsChange: (uploads: DocumentUploads) => void;
  errors?: Record<string, string>;
  onRetry?: (fileId: string) => void;
  disabled?: boolean;
  lossItems?: Array<{ itemKey: string; description: string }>;
}

export function DocumentUploader({
  categories,
  uploads,
  onUploadsChange,
  errors,
  onRetry,
  disabled = false,
  lossItems = [],
}: DocumentUploaderProps) {
  const [selectionErrors, setSelectionErrors] = useState<
    Record<string, string>
  >({});
  function addFiles(category: DocumentCategory, files: FileList | null) {
    if (!files?.length) return;
    const existing = uploads[category.key] || [];
    const incoming = Array.from(files);
    let error =
      !category.multiple && existing.length + incoming.length > 1
        ? "This category accepts one file. Remove the existing file before replacing it."
        : null;
    error ||=
      incoming
        .map((file) => validateEvidenceSelection(category.key, file))
        .find(Boolean) ?? null;
    error ||= validateEvidenceTotals([
      ...Object.values(uploads).flat(),
      ...incoming,
    ]);
    setSelectionErrors((previous) => ({
      ...previous,
      [category.key]: error || "",
    }));
    if (error) return;
    const fresh = incoming.filter(
      (file) =>
        !existing.some(
          (selected) =>
            selected.name === file.name &&
            selected.size === file.size &&
            selected.file.lastModified === file.lastModified,
        ),
    );
    onUploadsChange({
      ...uploads,
      [category.key]: [
        ...existing,
        ...fresh.map((file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          file,
          status: "selected" as const,
          lossItemId: category.lossItemId,
        })),
      ],
    });
  }
  return (
    <FieldSet>
      <FieldLegend>Available supporting documents</FieldLegend>
      <p className="text-sm text-muted-foreground">
        Documents are optional for the first report. Select what you have now,
        or add evidence from the claim page later. Up to 50 MB per file, 150 MB
        total, and 20 files per batch.
      </p>
      <div className="space-y-5">
        {categories.map((category) => (
          <CategoryUpload
            key={category.key}
            category={category}
            files={uploads[category.key] || []}
            disabled={disabled}
            onAdd={(files) => addFiles(category, files)}
            onRemove={(id) =>
              onUploadsChange({
                ...uploads,
                [category.key]: (uploads[category.key] || []).filter(
                  (file) => file.id !== id,
                ),
              })
            }
            onAssociate={(id, lossItemId) =>
              onUploadsChange({
                ...uploads,
                [category.key]: (uploads[category.key] || []).map((file) =>
                  file.id === id
                    ? { ...file, lossItemId: lossItemId || undefined }
                    : file,
                ),
              })
            }
            error={selectionErrors[category.key] || errors?.[category.key]}
            onRetry={onRetry}
            lossItems={lossItems}
          />
        ))}
      </div>
    </FieldSet>
  );
}

function CategoryUpload({
  category,
  files,
  onAdd,
  onRemove,
  onAssociate,
  error,
  onRetry,
  disabled,
  lossItems,
}: {
  category: DocumentCategory;
  files: UploadedFile[];
  onAdd: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  onAssociate: (id: string, lossItemId: string) => void;
  error?: string;
  onRetry?: (fileId: string) => void;
  disabled: boolean;
  lossItems: Array<{ itemKey: string; description: string }>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [dragActive, setDragActive] = useState(false);
  return (
    <div className="space-y-2.5">
      <label htmlFor={`${id}-input`} className="text-sm font-medium">
        {category.label}
      </label>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {category.description}
      </p>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (!disabled) onAdd(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/15 px-4 py-6 text-center transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-input hover:border-primary/40 hover:bg-primary/5",
          error && "border-destructive/50",
        )}
      >
        <Upload className="size-10 rounded-xl bg-primary/10 p-2.5 text-primary" aria-hidden="true" />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          aria-describedby={`${id}-help`}
        >
          Choose {category.label.toLowerCase()}
        </Button>
        <span className="text-xs text-muted-foreground">
          or drag and drop •{" "}
          {evidenceAccept(category.key)
            .replaceAll(".", "")
            .replaceAll(",", ", ")}
        </span>
        <input
          id={`${id}-input`}
          ref={inputRef}
          type="file"
          accept={category.accept || evidenceAccept(category.key)}
          multiple={category.multiple}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
          aria-describedby={`${id}-help`}
          onChange={(event) => {
            onAdd(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="space-y-2.5">
          {files.map((file) => (
            <li
              key={file.id}
              className="space-y-3 rounded-xl border bg-muted/20 p-4"
            >
              <div className="flex items-center gap-2">
                {file.status === "uploaded" ? (
                  <Check
                    className="h-4 w-4 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                ) : (
                  <FileText
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1 break-all text-sm">
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                {file.status !== "uploaded" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled || file.status === "uploading"}
                    onClick={() => onRemove(file.id)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X aria-hidden="true" />
                  </Button>
                )}
              </div>
              {lossItems.length > 0 && file.status !== "uploaded" && (
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`${id}-${file.id}-item`}
                    className="text-xs text-muted-foreground"
                  >
                    Evidence for loss item
                  </label>
                  <select
                    id={`${id}-${file.id}-item`}
                    className="min-h-9 rounded-lg border bg-background px-2 text-sm"
                    value={file.lossItemId || ""}
                    disabled={disabled || !!file.attachmentId}
                    onChange={(event) =>
                      onAssociate(file.id, event.target.value)
                    }
                  >
                    <option value="">Whole claim / not a specific item</option>
                    {lossItems.map((item, index) => (
                      <option key={item.itemKey} value={item.itemKey}>
                        {item.description || `Item ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {file.status === "uploading" && (
                <div>
                  <progress
                    className="h-2 w-full accent-primary"
                    value={file.progress || 0}
                    max={100}
                    aria-label={`Uploading ${file.name}`}
                  />
                  <p className="text-xs text-muted-foreground" role="status">
                    {file.progress || 0}% • Uploading and verifying
                  </p>
                </div>
              )}
              {file.status === "uploaded" && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Saved to your claim
                </p>
              )}
              {!file.status || file.status === "selected" ? (
                <p className="text-xs text-muted-foreground">
                  Selected on this device; uploaded after the report is received
                </p>
              ) : null}
              {file.status === "failed" && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p role="alert" className="text-xs text-destructive">
                    {file.error || "Upload failed"}
                  </p>
                  {onRetry && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => onRetry(file.id)}
                    >
                      <RotateCcw aria-hidden="true" />
                      Retry file
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
