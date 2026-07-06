export function ArtifactTitleOverlay({ eyebrow, title, tone = "light" }) {
  return (
    <div className={`artifact-title-overlay tone-${tone === "dark" ? "dark" : "light"}`} aria-hidden="true">
      {eyebrow && <span>{eyebrow}</span>}
      <strong>{title || "Untitled"}</strong>
    </div>
  );
}
