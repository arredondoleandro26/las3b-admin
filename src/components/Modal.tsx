import { useEffect, useRef, type ReactNode } from "react";

/** Envoltorio de <dialog> nativo: se abre con showModal() cuando `open` es true. */
export function Modal({ open, onClose, className, children }: { open: boolean; onClose: () => void; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={className} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      {open && children}
    </dialog>
  );
}
