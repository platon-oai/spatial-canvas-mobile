import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officePreviewGeometry, renderOfficeDocument } from "./renderOfficeDocument.js";

const source = readFileSync(new URL("./renderOfficeDocument.js", import.meta.url), "utf8");

describe("Office document rendering contract", () => {
  it("uses stable retained geometry for each document family", () => {
    expect(officePreviewGeometry("docx")).toEqual({ width: 816, height: 1056 });
    expect(officePreviewGeometry("pptx")).toEqual({ width: 960, height: 540 });
    expect(officePreviewGeometry("xlsx")).toEqual({ width: 1100, height: 760 });
  });

  it("fails clearly when an asset is missing", async () => {
    await expect(renderOfficeDocument(null, "docx")).rejects.toThrow(/no longer available/);
  });

  it("rejects unsupported formats before loading a renderer", async () => {
    await expect(renderOfficeDocument({ blob: new Blob([]) }, "pdf")).rejects.toThrow(/Unsupported Office format/);
  });

  it("keeps every Office page in one fullscreen scroll stream", () => {
    expect(source).toContain('body.querySelectorAll("section.docx")');
    expect(source).toContain('wrapPages(pages, "reader")');
    expect(source).toContain('wrapSlides(slides, "reader")');
    expect(source).toContain('wrapSheets(workbook.SheetNames, "reader")');
    expect(source).toContain("--document-page-scale");
  });

  it("lays the reader directly on the fullscreen backdrop", () => {
    expect(source).toContain("background: transparent");
    expect(source).toContain("scrollbar-width: none");
    expect(source).toContain("body { overflow: hidden");
    expect(source).toContain("body::-webkit-scrollbar { display: none");
    expect(source).toContain(".docx-pages.is-reader { gap: 20px; padding: 0 0 104px; background: transparent; }");
    expect(source).toContain("box-shadow: none !important");
    expect(source).not.toContain("background: #eef0ef");
  });
});
