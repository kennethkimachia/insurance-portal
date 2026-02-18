"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FieldSet, FieldLegend, FieldError } from "@/components/ui/field";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

export interface DocumentCategory {
  key: string;
  label: string;
  description: string;
  required: boolean;
  accept: string; // e.g. "image/*,.pdf"
  multiple: boolean;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
}

export interface DocumentUploads {
  [categoryKey: string]: UploadedFile[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function fileId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function isImage(type: string): boolean {
  return type.startsWith("image/");
}

// ── Component ────────────────────────────────────────────────────────────

interface DocumentUploaderProps {
  categories: DocumentCategory[];
  uploads: DocumentUploads;
  onUploadsChange: (uploads: DocumentUploads) => void;
  errors?: Record<string, string>;
}

export function DocumentUploader({
  categories,
  uploads,
  onUploadsChange,
  errors,
}: DocumentUploaderProps) {
  function addFiles(categoryKey: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    const existing = uploads[categoryKey] || [];
    const newFiles: UploadedFile[] = Array.from(files).map((f) => ({
      id: fileId(),
      name: f.name,
      size: f.size,
      type: f.type,
      file: f,
    }));
    onUploadsChange({
      ...uploads,
      [categoryKey]: [...existing, ...newFiles],
    });
  }

  function removeFile(categoryKey: string, fileId: string) {
    const existing = uploads[categoryKey] || [];
    onUploadsChange({
      ...uploads,
      [categoryKey]: existing.filter((f) => f.id !== fileId),
    });
  }

  return (
    <FieldSet>
      <FieldLegend>Supporting Documents</FieldLegend>
      <div className="space-y-5">
        {categories.map((cat) => (
          <CategoryUpload
            key={cat.key}
            category={cat}
            files={uploads[cat.key] || []}
            onAdd={(files) => addFiles(cat.key, files)}
            onRemove={(id) => removeFile(cat.key, id)}
            error={errors?.[cat.key]}
          />
        ))}
      </div>
    </FieldSet>
  );
}

// ── Per-category upload zone ─────────────────────────────────────────────

interface CategoryUploadProps {
  category: DocumentCategory;
  files: UploadedFile[];
  onAdd: (files: FileList | null) => void;
  onRemove: (fileId: string) => void;
  error?: string;
}

function CategoryUpload({
  category,
  files,
  onAdd,
  onRemove,
  error,
}: CategoryUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      onAdd(e.dataTransfer.files);
    },
    [onAdd],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            {category.label}
            {category.required && (
              <span className="ml-1 text-destructive">*</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {category.description}
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          error && "border-destructive/50",
        )}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-primary">Click to upload</span> or
          drag and drop
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={category.accept}
          multiple={category.multiple}
          className="hidden"
          onChange={(e) => {
            onAdd(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2"
            >
              {isImage(f.type) ? (
                <ImageIcon className="h-4 w-4 shrink-0 text-blue-500" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-orange-500" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {f.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatFileSize(f.size)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(f.id);
                }}
                className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
