import { validateEvidenceSelection } from "./claim-evidence";

/** Inspect structure, then hold every upload for manual review. This is not a malware scan. */
export function inspectEvidenceContent(
  category: string,
  name: string,
  declaredType: string,
  bytes: Uint8Array,
): string {
  const error = validateEvidenceSelection(category, {
    name,
    size: bytes.byteLength,
    type: declaredType,
  });
  if (error) throw new Error(error);
  if (/[\u0000-\u001f\u007f\\/]/.test(name))
    throw new Error(
      "Use a filename without control characters or directory paths",
    );
  const head = Buffer.from(bytes.subarray(0, 64));
  const ext = name.toLowerCase().split(".").pop();
  const prefix = head.toString("latin1");
  switch (ext) {
    case "pdf":
      if (!prefix.startsWith("%PDF-")) break;
      return "application/pdf";
    case "jpg":
    case "jpeg":
      if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) break;
      return "image/jpeg";
    case "png":
      if (
        !head
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        break;
      return "image/png";
    case "webp":
      if (prefix.slice(0, 4) !== "RIFF" || prefix.slice(8, 12) !== "WEBP")
        break;
      return "image/webp";
    case "mp4":
    case "mov":
      if (prefix.slice(4, 8) !== "ftyp") break;
      return ext === "mov" ? "video/quicktime" : "video/mp4";
    case "webm":
      if (!head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])))
        break;
      return "video/webm";
    case "xlsx":
      if (prefix.slice(0, 4) !== "PK\x03\x04") break;
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "csv": {
      if (bytes.byteLength > 5 * 1024 * 1024)
        throw new Error("CSV records must be no larger than 5 MB");
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new Error("CSV records must contain UTF-8 text");
      }
      if (text.includes("\0") || /<\s*(?:html|script|iframe)/i.test(text))
        break;
      return "text/csv";
    }
  }
  throw new Error(
    "File content does not match its filename. Choose the original document.",
  );
}
