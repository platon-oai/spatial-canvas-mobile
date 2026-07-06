// @ts-check

const PREVIEW_GEOMETRY = Object.freeze({
  docx: { width: 816, height: 1056 },
  pptx: { width: 960, height: 540 },
  xlsx: { width: 1100, height: 760 },
});

const sharedDocumentCss = `
  * { box-sizing: border-box; }
  html, body { min-height: 100%; margin: 0; color: #151718; background: transparent; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  body { overflow: hidden; scrollbar-width: none; }
  body::-webkit-scrollbar { display: none; width: 0; height: 0; }
  a { color: inherit; }
`;

/** @param {unknown} value */
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** @param {{title: string, head?: string, body: string, css?: string}} options */
function htmlDocument({ title, head = "", body, css = "" }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>${head}<style>${sharedDocumentCss}${css}</style></head><body>${body}</body></html>`;
}

/** @param {"docx" | "pptx" | "xlsx" | null | undefined} format */
export function officePreviewGeometry(format) {
  return PREVIEW_GEOMETRY[format] || { width: 960, height: 720 };
}

/** @param {import("../domain/types.js").AssetRecord} asset */
async function renderDocx(asset) {
  const { renderAsync } = await import("docx-preview");
  const body = document.createElement("div");
  const styles = document.createElement("div");
  await renderAsync(asset.blob, body, styles, {
    breakPages: true,
    ignoreLastRenderedPageBreak: false,
    renderAltChunks: false,
    renderComments: false,
    renderFootnotes: true,
    renderEndnotes: true,
    useBase64URL: true,
  });

  const pages = [...body.querySelectorAll("section.docx")];
  const wrapPages = (entries, mode) => `<main class="docx-pages is-${mode}">${entries.map((page) => page.outerHTML).join("")}</main>`;
  const previewBody = pages.length
    ? wrapPages(pages.slice(0, 1), "preview")
    : body.innerHTML;
  const fullBody = pages.length
    ? wrapPages(pages, "reader")
    : body.innerHTML;
  const css = `
    html, body { width: 100%; }
    .docx-pages { display: grid; justify-items: center; width: 100%; min-height: 100%; }
    .docx-pages.is-preview { gap: 0; padding: 0; background: #fff; }
    .docx-pages.is-reader { gap: 20px; padding: 0 0 104px; background: transparent; }
    .docx-pages > section.docx { margin: 0 !important; border-radius: 0 !important; }
    .docx-pages.is-preview > section.docx { box-shadow: none !important; }
    .docx-pages.is-reader > section.docx {
      zoom: var(--document-page-scale, 1);
      box-shadow: none !important;
    }
  `;
  return {
    previewSrcDoc: htmlDocument({ title: asset.name, head: styles.innerHTML, body: previewBody, css }),
    fullSrcDoc: htmlDocument({ title: asset.name, head: styles.innerHTML, body: fullBody, css }),
    ...officePreviewGeometry("docx"),
  };
}

/** @param {import("../domain/types.js").AssetRecord} asset */
async function renderPptx(asset) {
  const { pptxToHtml } = await import("@jvmr/pptx-to-html");
  const slides = await pptxToHtml(await asset.blob.arrayBuffer(), {
    width: 960,
    height: 540,
    scaleToFit: true,
    letterbox: true,
  });
  if (!slides.length) throw new Error("This presentation does not contain any slides.");
  const wrapSlides = (entries, mode) => `<main class="ppt-deck is-${mode}">${entries.map((slide, index) => `<section class="ppt-slide" aria-label="Slide ${index + 1}">${slide}</section>`).join("")}</main>`;
  const css = `
    body { background: transparent; }
    .ppt-deck { display: grid; justify-items: center; min-height: 100%; }
    .ppt-deck.is-preview { gap: 0; padding: 0; background: #fff; }
    .ppt-deck.is-reader { gap: 20px; padding: 0 0 104px; background: transparent; }
    .ppt-slide { position: relative; width: 960px; height: 540px; overflow: hidden; border-radius: 0; background: white; box-shadow: none; }
    .ppt-deck.is-reader .ppt-slide { zoom: var(--document-page-scale, 1); box-shadow: none; }
    .ppt-slide > * { margin: 0 !important; }
  `;
  return {
    previewSrcDoc: htmlDocument({ title: asset.name, body: wrapSlides(slides.slice(0, 1), "preview"), css }),
    fullSrcDoc: htmlDocument({ title: asset.name, body: wrapSlides(slides, "reader"), css }),
    ...officePreviewGeometry("pptx"),
  };
}

/** @param {import("../domain/types.js").AssetRecord} asset */
async function renderXlsx(asset) {
  const module = await import("xlsx");
  const XLSX = module.default || module;
  const workbook = XLSX.read(await asset.blob.arrayBuffer(), {
    type: "array",
    cellDates: true,
    cellStyles: true,
  });
  if (!workbook.SheetNames.length) throw new Error("This workbook does not contain any sheets.");
  const renderSheet = (name, index) => {
    const table = XLSX.utils.sheet_to_html(workbook.Sheets[name], {
      id: `sheet-${index}`,
      editable: false,
    });
    return `<section class="workbook-sheet"><h2>${escapeHtml(name)}</h2><div class="sheet-grid">${table}</div></section>`;
  };
  const wrapSheets = (names, mode) => `<main class="workbook is-${mode}">${names.map(renderSheet).join("")}</main>`;
  const css = `
    body { background: transparent; }
    .workbook { display: grid; min-width: max-content; background: #fff; }
    .workbook.is-preview { gap: 0; padding: 0; }
    .workbook.is-reader { gap: 20px; padding: 0 0 104px; background: transparent; }
    .workbook-sheet { min-width: 100%; border-radius: 0; background: #fff; }
    h2 { position: sticky; top: 0; z-index: 3; width: max-content; margin: 0; padding: 7px 11px; border: 0; border-right: 1px solid #e4e7e4; border-bottom: 1px solid #e4e7e4; border-radius: 0 0 8px 0; background: rgba(255,255,255,.92); box-shadow: none; font-size: 13px; font-weight: 600; backdrop-filter: blur(10px); }
    .sheet-grid { width: max-content; max-width: none; overflow: hidden; border: 0; border-radius: 0; background: white; box-shadow: none; }
    table { border-spacing: 0; border-collapse: collapse; font-size: 13px; }
    td, th { min-width: 88px; height: 30px; padding: 5px 8px; border-right: 1px solid #e4e7e4; border-bottom: 1px solid #e4e7e4; white-space: pre-wrap; vertical-align: middle; }
    tr:first-child td, tr:first-child th { background: #f6f7f5; font-weight: 600; }
  `;
  return {
    previewSrcDoc: htmlDocument({ title: asset.name, body: wrapSheets(workbook.SheetNames.slice(0, 1), "preview"), css }),
    fullSrcDoc: htmlDocument({ title: asset.name, body: wrapSheets(workbook.SheetNames, "reader"), css }),
    ...officePreviewGeometry("xlsx"),
  };
}

/**
 * Convert a device-local Office asset into isolated iframe documents. Renderer
 * code is split by format and only downloaded after a matching item appears.
 *
 * @param {import("../domain/types.js").AssetRecord} asset
 * @param {"docx" | "pptx" | "xlsx"} format
 */
export async function renderOfficeDocument(asset, format) {
  if (!asset?.blob) throw new Error("The imported file is no longer available on this device.");
  if (format === "docx") return renderDocx(asset);
  if (format === "pptx") return renderPptx(asset);
  if (format === "xlsx") return renderXlsx(asset);
  throw new TypeError(`Unsupported Office format: ${String(format)}`);
}
