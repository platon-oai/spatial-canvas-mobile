import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const canvasItemNode = readFileSync(new URL("../canvas/CanvasItemNode.jsx", import.meta.url), "utf8");
const sharedViewer = readFileSync(new URL("../components/SharedItemViewer.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

function lastRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...styles.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))];
  return matches.at(-1)?.[1] || "";
}

function rulesFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...styles.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))];
  return matches.map((match) => match[1]).join("\n");
}

describe("settled mobile detail surface", () => {
  it("exposes a ready phase without changing the retained viewer component", () => {
    expect(canvasItemNode).toContain('detailPresent && detailReady ? "is-detail-ready" : ""');
  });

  it("keeps the retained compositor layer stable when mobile detail settles", () => {
    const viewer = lastRule(".world-item.is-detail-viewer");
    expect(viewer).toContain("contain: layout paint style");
    expect(viewer).toContain("isolation: isolate");
    expect(lastRule(".world-item.is-detail-viewer .shared-item-viewer"))
      .toContain("overflow: hidden");
    expect(lastRule(".world-item.is-detail-open.is-detail-ready")).toBe("");
    expect(lastRule(".world-item.is-detail-open.is-detail-ready .shared-item-viewer")).toBe("");

    const settledEdge = lastRule(
      ".world-item.is-detail-open.is-detail-ready .selection-visual::after",
    );
    expect(settledEdge).toContain("box-shadow: none");
    expect(settledEdge).toContain("opacity: 0");
  });

  it("keeps card and transition shadows for board and reverse-flight states", () => {
    const transitionEdge = lastRule(".world-item.is-detail-viewer .selection-visual::after");
    expect(transitionEdge).toContain("box-shadow:");
    expect(transitionEdge).toContain("var(--detail-card-edge-opacity, 1)");
    expect(rulesFor(".spatial-item")).toContain("box-shadow:");
    expect(lastRule(".world-item.is-detail-viewer .shared-item-viewer"))
      .toContain("overflow: hidden");
  });

  it("lays out authored editors at retained reader bounds before compositor motion", () => {
    expect(app).toContain("const usesFullscreenEditor = isDetailViewer");
    expect(app).toContain("fullscreenReaderGeometry(absoluteTarget, camera, viewportSize)");
    expect(app).toContain('|| item.kind === "document"');
    expect(app).toContain("? fullscreenDetailTarget");
    expect(app).toContain("detailUsesDestinationBounds={usesFullscreenEditor}");
    expect(canvasItemNode).toContain("scaledGeometryBounds");
    expect(canvasItemNode).toContain("width.jump(detailTarget.width)");
    expect(canvasItemNode).toContain("height.jump(detailTarget.height)");
    expect(canvasItemNode).toContain("animate(clipRight");
    expect(canvasItemNode).toContain('detailUsesDestinationBounds ? "is-fullscreen-editor"');
    expect(styles).toContain(".world-item.is-fullscreen-editor .shared-document-stage");
  });

  it("caps fullscreen reading width while preserving retained transition geometry", () => {
    expect(canvasItemNode).toContain("authoredDocumentScale(value)");
    expect(canvasItemNode).not.toContain("availableReaderWidth");
    expect(canvasItemNode).not.toContain("[width, detailProgress]");
    expect(canvasItemNode).toContain("const documentX = useMotionValue(0)");
    expect(canvasItemNode).toContain("Math.min(1, currentWidth / Math.max(1, assetBaseWidth))");
    expect(canvasItemNode).toContain("(currentWidth - assetBaseWidth * currentScale) / 2");
  });

  it("keeps the settled editor layout mounted until the reverse flight ends", () => {
    expect(canvasItemNode).not.toContain("if (!detailOpen) setDetailReady(false)");
    expect(canvasItemNode).toContain("setDetailReady(false);\n            detailExitCompleteRef.current?.()");
    expect(sharedViewer).toContain("const authoredEditorReady = Boolean(detailReady)");
    expect(sharedViewer).toContain("interactive={authoredEditorReady}");
  });

  it("retains exactly one Notion editor component across board and detail", () => {
    expect(sharedViewer.match(/<NotionBlockEditor/g)).toHaveLength(1);
  });

  it("portals detail actions to the viewport instead of transformed item content", () => {
    expect(app).toContain("detailActionsHost={viewportRef.current}");
    expect(canvasItemNode).toContain("detailActionsHost={detailActionsHost}");
    expect(sharedViewer).toContain("createPortal(");
    expect(sharedViewer).toContain('className="detail-actions-anchor is-viewport-fixed"');

    const anchor = lastRule(".detail-actions-anchor.is-viewport-fixed");
    expect(anchor).toContain("position: absolute");
    expect(anchor).toContain("bottom: max(18px, env(safe-area-inset-bottom))");
    expect(anchor).toContain("width: 100%");
    expect(anchor).toContain("pointer-events: none");
  });

  it("routes fullscreen wheel input to the active artifact scroll owner", () => {
    expect(app).toContain('viewport.querySelector(');
    expect(app).toContain('[data-detail-scroll-region="true"] > :is(.item-document, .item-note, .item-web)');
    expect(app).toContain('detailScrollHost.scrollBy({ left: deltaX, top: deltaY, behavior: "auto" })');
  });
});
