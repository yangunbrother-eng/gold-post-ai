"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import UiIcon from "./UiIcon";
export default function UiDialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const label = useId();
  useEffect(() => {
    if (!open) { ref.current?.close(); return; }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.showModal();
    return () => { ref.current?.close(); document.body.style.overflow = previous; };
  }, [open]);
  return <dialog ref={ref} className="ws-menu-dialog ws-dialog" aria-labelledby={label} onCancel={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="ws-menu-content"><div className="ws-section-head"><h2 id={label}>{title}</h2><button type="button" className="ws-icon-button" onClick={onClose} aria-label="닫기"><UiIcon name="close" /></button></div><div className="ws-stack ws-form-group">{children}</div></div>
  </dialog>;
}
