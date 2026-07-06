import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const documentSurface = readFileSync(new URL("./DocumentAssetSurface.jsx", import.meta.url), "utf8");
const itemCard = readFileSync(new URL("./ItemCard.jsx", import.meta.url), "utf8");
const sharedViewer = readFileSync(new URL("./SharedItemViewer.jsx", import.meta.url), "utf8");
const overlay = readFileSync(new URL("./ArtifactTitleOverlay.jsx", import.meta.url), "utf8");

function rulesFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))];
  return matches.map((match) => match[1]).join("\n");
}

describe("full-bleed artifact surfaces", () => {
  it("keeps the document metadata on the board but removes it from fullscreen", () => {
    expect(documentSurface).toContain("<ArtifactTitleOverlay");
    expect(documentSurface).toContain("!detailReady && (");
    expect(sharedViewer).toContain("<ArtifactTitleOverlay");
    expect(itemCard).not.toContain("<ArtifactTitleOverlay");
    expect(overlay).toContain('aria-hidden="true"');
    expect(overlay).toContain("tone-${tone");

    const declarations = rulesFor(".artifact-title-overlay");
    expect(declarations).toContain("position: absolute");
    expect(declarations).toContain("bottom: 0");
    expect(declarations).toContain("linear-gradient");
    expect(declarations).toContain("pointer-events: none");
  });

  it("keeps the web screenshot full bleed and moves its action to viewport chrome", () => {
    expect(rulesFor(".shared-web-surface .web-preview")).toContain("display: block");
    const shot = rulesFor(".shared-web-surface .web-preview-shot");
    expect(shot).toContain("position: absolute");
    expect(shot).toContain("inset: 0");
    expect(itemCard).not.toContain('className="web-copy"');
    expect(sharedViewer).toContain("!detailReady && <ArtifactTitleOverlay title={domain}");
    expect(sharedViewer).not.toContain('className="web-open-source"');
    expect(sharedViewer).toContain('aria-label="Open original"');
    expect(sharedViewer).toContain("createPortal(");
    expect(sharedViewer).not.toContain("eyebrow={domain}");

    const webTitle = rulesFor(".shared-web-stage .artifact-title-overlay strong");
    expect(webTitle).toContain("max-width: none");
    expect(webTitle).toContain("overflow-wrap: anywhere");
    expect(webTitle).toContain("white-space: normal");
  });

  it("preserves the retained cached web capture path", () => {
    for (const contract of [
      "screenshotAssetId",
      "loadAsset",
      "URL.createObjectURL",
      "screenshotCandidatesForItem",
      "tryNextCandidate",
      "onScreenshotResolved",
      "loadedScreenshot",
      "candidates.indexOf(loadedScreenshot)",
    ]) {
      expect(itemCard).toContain(contract);
    }
    expect(itemCard).not.toContain("if (assetPending) return []");
    expect(itemCard).toContain("readyAssetIndex");
    expect(itemCard).toContain("!item.screenshotAssetId");
    expect(app).toContain("needsWebClipScreenshotCache(sourceItem, screenshotUrl)");
    expect(app).toContain("needsWebClipScreenshotCache(currentItem, resolvedUrl)");
  });

  it("keeps Google consent interactive only in detail with a board fallback", () => {
    expect(documentSurface).toContain("allow-storage-access-by-user-activation");
    expect(documentSurface).toContain("isGoogle && !detailReady && !item.published");
    expect(documentSurface).toContain('className="google-document-gate"');
    expect(documentSurface).not.toContain("document-open-source");
    expect(sharedViewer).toContain("item.sourceUrl");
  });

  it("does not swap the document source during the reverse transition", () => {
    expect(documentSurface).toContain("if (!detailPresent) setFullDocumentReady(false)");
    expect(documentSurface).toContain("if (detailReady) setFullDocumentReady(true)");
    expect(documentSurface).toContain("const showFullDocument = detailReady || fullDocumentReady");
    expect(documentSurface).toContain("const interactive = Boolean(detailReady && detailOpen)");
  });

  it("turns a settled imported document into a flat scrolling reader", () => {
    expect(documentSurface).toContain('className={`document-asset-surface ${detailReady ? "is-reader" : ""}`}');
    expect(documentSurface).toContain('"--document-page-scale"');
    expect(documentSurface).toContain("Math.min(1, frame.clientWidth");
    expect(documentSurface).toContain("new ResizeObserver");
    expect(documentSurface).toContain('frame.closest(".item-document")');
    expect(documentSurface).toContain('scrolling="no"');
    expect(documentSurface).toContain('frameDocument.addEventListener("wheel", wheel, { passive: false })');
    expect(documentSurface).toContain('frameDocument.addEventListener("touchmove", touchMove, { passive: false })');

    const stage = rulesFor(".document-asset-stage.is-detail-ready");
    expect(stage).toContain("height: max(100%, var(--reader-height, 100%))");
    expect(stage).toContain("overflow: visible !important");
    expect(stage).toContain("background: transparent !important");

    const reader = rulesFor(".document-asset-stage.is-detail-ready .document-asset-surface.is-reader");
    expect(reader).toContain("inset: 0");
    expect(reader).toContain("border-radius: 0 !important");
    expect(reader).toContain("overflow: visible !important");
    expect(reader).toContain("background: transparent !important");

    const scrollHost = rulesFor(
      ".world-item.is-detail-open.is-detail-ready .item-document:has(.document-asset-stage)",
    );
    expect(scrollHost).toContain("overflow: auto !important");
    expect(scrollHost).toContain("scrollbar-width: none");
  });

  it("selects title contrast from rendered artifact content", () => {
    expect(itemCard).toContain("sampleImageBottomTone");
    expect(documentSurface).toContain("inspectIframeBottomTone");
    expect(sharedViewer).toContain("onToneChange={setOverlayTone}");
    expect(rulesFor(".artifact-title-overlay.tone-dark")).toContain("rgba(10, 12, 13, 0.66)");
  });
});
