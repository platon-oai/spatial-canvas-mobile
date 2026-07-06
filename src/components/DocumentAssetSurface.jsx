import { FileText } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { renderOfficeDocument } from "../import/renderOfficeDocument.js";
import { ArtifactTitleOverlay } from "./ArtifactTitleOverlay.jsx";
import { inspectIframeBottomTone } from "./artifactTone.js";

const renderedAssetCache = new Map();
const MAX_RENDERED_ASSETS = 8;

function cachedOfficeRender(item, loadAsset) {
  const key = `${item.assetId}:${item.documentFormat}`;
  if (renderedAssetCache.has(key)) return renderedAssetCache.get(key);
  const promise = loadAsset(item.assetId).then((asset) => renderOfficeDocument(asset, item.documentFormat));
  renderedAssetCache.set(key, promise);
  if (renderedAssetCache.size > MAX_RENDERED_ASSETS) {
    const oldestKey = renderedAssetCache.keys().next().value;
    if (oldestKey !== key) renderedAssetCache.delete(oldestKey);
  }
  promise.catch(() => renderedAssetCache.delete(key));
  return promise;
}

function DocumentLoadingState({ item, error }) {
  return (
    <div className={`document-asset-status ${error ? "is-error" : "is-loading"}`}>
      <FileText size={34} weight="thin" />
      <strong>{error ? "Preview unavailable" : `Opening ${item.subtitle || "document"}`}</strong>
      <span>{error || item.fileName || item.title}</span>
    </div>
  );
}

export function DocumentAssetSurface({
  item,
  detailPresent,
  detailOpen,
  detailReady,
  assetMotion,
  loadAsset,
}) {
  const isGoogle = item.documentSource === "google";
  const [rendered, setRendered] = useState(null);
  const [error, setError] = useState("");
  const [fullDocumentReady, setFullDocumentReady] = useState(false);
  const [readerSize, setReaderSize] = useState({ width: 0, height: 0 });
  const [frameRevision, setFrameRevision] = useState(0);
  const [overlayTone, setOverlayTone] = useState(item.artifactTone === "dark" ? "dark" : "light");
  const documentFrameRef = useRef(null);

  useEffect(() => {
    if (isGoogle || !item.assetId || typeof loadAsset !== "function") return undefined;
    let active = true;
    setError("");
    cachedOfficeRender(item, loadAsset)
      .then((value) => {
        if (active) setRendered(value);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "The file could not be rendered.");
      });
    return () => {
      active = false;
    };
  }, [isGoogle, item.assetId, item.documentFormat, loadAsset]);

  useEffect(() => {
    setReaderSize({ width: 0, height: 0 });
  }, [item.assetId, item.documentFormat]);

  useEffect(() => {
    if (detailReady) setFullDocumentReady(true);
  }, [detailReady]);

  useEffect(() => {
    // Keep the full document mounted for the entire reverse transition, then
    // restore the lightweight first-page preview once the retained card is
    // back on the board. The source never changes while it is in flight.
    if (!detailPresent) setFullDocumentReady(false);
  }, [detailPresent]);

  const showFullDocument = detailReady || fullDocumentReady;
  const srcDoc = showFullDocument ? rendered?.fullSrcDoc : rendered?.previewSrcDoc;
  const interactive = Boolean(detailReady && detailOpen);
  const expandedLocalReader = Boolean(showFullDocument && !isGoogle);
  const syncDocumentPageScale = useCallback((frame = documentFrameRef.current) => {
    if (isGoogle || !frame?.contentDocument) return;
    const baseWidth = Number(assetMotion?.baseWidth) || 1;
    const pageScale = detailReady
      ? Math.min(1, frame.clientWidth / Math.max(1, baseWidth))
      : 1;
    frame.contentDocument.documentElement.style.setProperty(
      "--document-page-scale",
      String(Math.max(0.1, pageScale)),
    );
  }, [assetMotion?.baseWidth, detailReady, isGoogle]);

  const syncReaderSize = useCallback((frame = documentFrameRef.current) => {
    if (!expandedLocalReader || !frame?.contentDocument) return;
    syncDocumentPageScale(frame);
    const documentElement = frame.contentDocument.documentElement;
    const body = frame.contentDocument.body;
    const scrollHost = frame.closest(".item-document");
    const width = Math.ceil(Math.max(
      scrollHost?.clientWidth || 0,
      documentElement?.scrollWidth || 0,
      body?.scrollWidth || 0,
    ));
    const height = Math.ceil(Math.max(
      scrollHost?.clientHeight || 0,
      documentElement?.scrollHeight || 0,
      body?.scrollHeight || 0,
    ));
    setReaderSize((current) => current.width === width && current.height === height
      ? current
      : { width, height });
  }, [expandedLocalReader, syncDocumentPageScale]);

  useEffect(() => {
    const frame = documentFrameRef.current;
    if (!frame || isGoogle) return undefined;
    syncReaderSize(frame);
    if (!detailReady || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => syncReaderSize(frame));
    observer.observe(frame.closest(".item-document") || frame);
    return () => observer.disconnect();
  }, [detailReady, isGoogle, srcDoc, syncReaderSize]);

  useEffect(() => {
    const frame = documentFrameRef.current;
    const frameDocument = frame?.contentDocument;
    const scrollHost = frame?.closest(".item-document");
    if (!interactive || isGoogle || !frameDocument || !scrollHost) return undefined;

    const wheel = (event) => {
      const unit = event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? scrollHost.clientHeight
          : 1;
      scrollHost.scrollBy({
        left: event.deltaX * unit,
        top: event.deltaY * unit,
        behavior: "auto",
      });
      event.preventDefault();
    };
    let lastTouch = null;
    const touchStart = (event) => {
      const touch = event.touches?.[0];
      lastTouch = touch ? { x: touch.clientX, y: touch.clientY } : null;
    };
    const touchMove = (event) => {
      const touch = event.touches?.[0];
      if (!touch || !lastTouch) return;
      const left = lastTouch.x - touch.clientX;
      const top = lastTouch.y - touch.clientY;
      lastTouch = { x: touch.clientX, y: touch.clientY };
      if (!left && !top) return;
      scrollHost.scrollBy({ left, top, behavior: "auto" });
      event.preventDefault();
    };
    const touchEnd = () => { lastTouch = null; };

    frameDocument.addEventListener("wheel", wheel, { passive: false });
    frameDocument.addEventListener("touchstart", touchStart, { passive: true });
    frameDocument.addEventListener("touchmove", touchMove, { passive: false });
    frameDocument.addEventListener("touchend", touchEnd, { passive: true });
    frameDocument.addEventListener("touchcancel", touchEnd, { passive: true });
    return () => {
      frameDocument.removeEventListener("wheel", wheel);
      frameDocument.removeEventListener("touchstart", touchStart);
      frameDocument.removeEventListener("touchmove", touchMove);
      frameDocument.removeEventListener("touchend", touchEnd);
      frameDocument.removeEventListener("touchcancel", touchEnd);
    };
  }, [frameRevision, interactive, isGoogle, srcDoc]);

  const expandedWidth = readerSize.width || "100%";
  const expandedHeight = readerSize.height || "100%";

  return (
    <motion.div
      className={`document-asset-stage format-${item.documentFormat || "drive"} ${detailReady ? "is-detail-ready" : ""}`}
      style={{
        width: expandedLocalReader ? expandedWidth : "100%",
        height: expandedLocalReader ? expandedHeight : assetMotion?.stageHeight,
      }}
    >
      <motion.div
        className={`document-asset-surface ${detailReady ? "is-reader" : ""}`}
        style={{
          width: detailReady ? expandedWidth : assetMotion?.baseWidth,
          height: expandedLocalReader ? expandedHeight : assetMotion?.baseHeight,
          x: detailReady ? 0 : assetMotion?.x,
          y: detailReady ? 0 : assetMotion?.y,
          scale: detailReady ? 1 : assetMotion?.scale,
          transformOrigin: "0 0",
        }}
      >
        {isGoogle ? (
          <iframe
            className="document-asset-frame google-document-frame"
            src={item.previewUrl}
            title={item.title || "Google document"}
            loading="eager"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-storage-access-by-user-activation"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ pointerEvents: interactive ? "auto" : "none" }}
            onLoad={(event) => setOverlayTone(inspectIframeBottomTone(event.currentTarget, {
              fallback: item.artifactTone === "dark" ? "dark" : "light",
            }))}
          />
        ) : srcDoc ? (
          <iframe
            ref={documentFrameRef}
            className="document-asset-frame"
            srcDoc={srcDoc}
            title={item.title || item.fileName || "Imported document"}
            scrolling="no"
            sandbox="allow-same-origin"
            style={{
              width: detailReady ? expandedWidth : "100%",
              height: expandedLocalReader ? expandedHeight : "100%",
              pointerEvents: interactive ? "auto" : "none",
            }}
            onLoad={(event) => {
              syncReaderSize(event.currentTarget);
              setFrameRevision((revision) => revision + 1);
              setOverlayTone(inspectIframeBottomTone(event.currentTarget, {
                fallback: item.artifactTone === "dark" ? "dark" : "light",
              }));
            }}
          />
        ) : (
          <DocumentLoadingState item={item} error={error} />
        )}
      </motion.div>
      {isGoogle && !detailReady && !item.published && (
        <div className="google-document-gate" aria-hidden="true">
          <FileText size={30} weight="thin" />
          <span>Open to preview</span>
        </div>
      )}
      {!detailReady && (
        <ArtifactTitleOverlay
          eyebrow={item.subtitle || item.fileName || "Document"}
          title={item.title || item.fileName || "Untitled document"}
          tone={overlayTone}
        />
      )}
    </motion.div>
  );
}
