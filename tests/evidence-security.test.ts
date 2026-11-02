import test from "node:test";
import assert from "node:assert/strict";
import { inspectEvidenceContent } from "../lib/evidence-content";
import { reserveUploadSlot } from "../lib/upload-capacity";

test("extension and MIME alone cannot turn HTML into evidence", () => {
  for (const [filename, type] of [
    ["report.pdf", "application/pdf"],
    ["photo.png", "image/png"],
    [
      "stock.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  ]) {
    assert.throws(
      () =>
        inspectEvidenceContent(
          filename.endsWith("xlsx") ? "stock_records" : "other",
          filename,
          type,
          Buffer.from("<html><script>alert(1)</script></html>"),
        ),
      /content does not match/,
    );
  }
});
test("supported image/PDF signatures are recognized without claiming a malware scan", () => {
  assert.equal(
    inspectEvidenceContent(
      "police_abstract",
      "police.pdf",
      "application/pdf",
      Buffer.from("%PDF-1.7 synthetic specimen"),
    ),
    "application/pdf",
  );
  assert.equal(
    inspectEvidenceContent(
      "scene_photos",
      "scene.png",
      "image/png",
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2]),
    ),
    "image/png",
  );
  assert.throws(
    () =>
      inspectEvidenceContent(
        "driving_license",
        "movie.mp4",
        "video/mp4",
        Buffer.from("0000ftyp"),
      ),
    /not an accepted file/,
  );
});
test("stock CSV rejects binary and executable HTML and accepts UTF-8 records", () => {
  assert.equal(
    inspectEvidenceContent(
      "stock_records",
      "stock.csv",
      "text/csv",
      Buffer.from("Item,Quantity\nSynthetic chair,2\n"),
    ),
    "text/csv",
  );
  assert.throws(
    () =>
      inspectEvidenceContent(
        "stock_records",
        "stock.csv",
        "text/csv",
        Buffer.from([0xff, 0xfe, 0x00]),
      ),
    /UTF-8/,
  );
  assert.throws(
    () =>
      inspectEvidenceContent(
        "stock_records",
        "stock.csv",
        "text/csv",
        Buffer.from("<script>danger</script>"),
      ),
    /content does not match/,
  );
  assert.throws(
    () =>
      inspectEvidenceContent(
        "stock_records",
        "stock.csv",
        "text/csv",
        Buffer.alloc(5 * 1024 * 1024 + 1, 65),
      ),
    /5 MB/,
  );
});
test("upload capacity releases on failures and limits overlapping requests", () => {
  const release = reserveUploadSlot("test-upload-user", 1000);
  assert.throws(() => reserveUploadSlot("test-upload-user", 1000), /capacity/);
  release();
  release();
  for (let i = 1; i < 30; i++) reserveUploadSlot("test-upload-user", 1000)();
  assert.throws(() => reserveUploadSlot("test-upload-user", 1000), /capacity/);
  reserveUploadSlot("test-upload-user", 61_000)();
});

test("video evidence is accepted only in media categories and must have a recognizable container", () => {
  for (const [name, mime, bytes] of [
    ["scene.mp4", "video/mp4", Buffer.from("\0\0\0\x18ftypisom")],
    ["scene.mov", "video/quicktime", Buffer.from("\0\0\0\x18ftypqt  ")],
    ["scene.webm", "video/webm", Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0])],
  ] as const) {
    assert.equal(inspectEvidenceContent("scene_photos", name, mime, bytes), mime);
    assert.throws(() => inspectEvidenceContent("driving_license", name, mime, bytes), /accepted file/);
    assert.throws(() => inspectEvidenceContent("other", name, mime, Buffer.from("<html>fake video</html>")), /content does not match/);
  }
  assert.throws(() => inspectEvidenceContent("other", "../scene.mp4", "video/mp4", Buffer.from("0000ftypisom")), /filename/);
});
