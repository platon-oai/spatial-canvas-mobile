import { describe, expect, it } from "vitest";
import {
  authoredDocumentScale,
  MARQUEE_SELECTION_SCALE,
  selectionPresentationScale,
} from "./CanvasItemNode.jsx";
import {
  SELECTION_ORIGIN,
  shouldScaleSelection,
} from "./selectionPresentation.js";

describe("canvas item selection presentation", () => {
  it("keeps ordinary selected items at their canonical scale", () => {
    expect(selectionPresentationScale()).toBe(1);
    expect(selectionPresentationScale({ selectionEmphasized: false })).toBe(1);
  });

  it("applies retained scale only when marquee selection requests emphasis", () => {
    expect(MARQUEE_SELECTION_SCALE).toBe(1.075);
    expect(selectionPresentationScale({ selectionEmphasized: true }))
      .toBe(MARQUEE_SELECTION_SCALE);
  });

  it.each([
    ["fullscreen detail", { detailPresent: true }],
    ["open folder", { folderOpen: true }],
    ["transitioning folder", { folderTransitioning: true }],
  ])("removes marquee scale for %s", (_label, state) => {
    expect(selectionPresentationScale({
      selectionEmphasized: true,
      ...state,
    })).toBe(1);
  });

  it("emphasizes only a multi-item drag-marquee selection", () => {
    expect(shouldScaleSelection({
      selected: true,
      selectedCount: 2,
      origin: SELECTION_ORIGIN.MARQUEE,
    })).toBe(true);
    expect(shouldScaleSelection({
      selected: true,
      selectedCount: 2,
      origin: SELECTION_ORIGIN.ORDINARY,
    })).toBe(false);
    expect(shouldScaleSelection({
      selected: true,
      selectedCount: 1,
      origin: SELECTION_ORIGIN.MARQUEE,
    })).toBe(false);
    expect(shouldScaleSelection({
      selected: false,
      selectedCount: 4,
      origin: SELECTION_ORIGIN.MARQUEE,
    })).toBe(false);
  });
});

describe("authored document reader presentation", () => {
  it("uses one canonical scale for both transition endpoints", () => {
    expect(authoredDocumentScale(1375, 0)).toBeCloseTo(1375 / 680, 5);
    expect(authoredDocumentScale(1375, 1)).toBeCloseTo(1375 / 680, 5);
  });

  it("fits narrow retained reader bounds without a second layout state", () => {
    expect(authoredDocumentScale(342, 1)).toBeCloseTo(342 / 680, 5);
  });
});
