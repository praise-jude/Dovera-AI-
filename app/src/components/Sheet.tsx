import type { ReactNode } from "react";

export function Sheet({
  open,
  onDismiss,
  title,
  children,
}: {
  open: boolean;
  onDismiss: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="scrim" onClick={onDismiss}>
      <div
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-title">{title}</div>
        {children}
      </div>
    </div>
  );
}
