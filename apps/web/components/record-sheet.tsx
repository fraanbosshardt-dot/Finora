"use client";
import { useEffect, useRef } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Percent,
  Landmark,
  X,
} from "lucide-react";
export type RecordChoice =
  | "expense"
  | "income"
  | "transfer"
  | "installment"
  | "debt";
export function RecordSheet({
  onChoose,
  onClose,
}: {
  onChoose: (choice: RecordChoice) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  const choices = [
    ["expense", "Gasto", ArrowUpRight],
    ["income", "Ingreso", ArrowDownLeft],
    ["transfer", "Transferencia", ArrowLeftRight],
    ["installment", "Compra en cuotas", Percent],
    ["debt", "Deuda o crédito", Landmark],
  ] as const;
  return (
    <dialog
      ref={ref}
      className="record-sheet"
      aria-labelledby="record-heading"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-handle" />
      <div className="panel-heading">
        <h2 id="record-heading">¿Qué querés registrar?</h2>
        <button
          className="text-button"
          aria-label="Cerrar menú"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {choices.map(([choice, label, Icon]) => (
        <button
          key={choice}
          className="record-choice"
          onClick={() => onChoose(choice)}
        >
          <span>
            <Icon size={21} />
          </span>
          {label}
        </button>
      ))}
    </dialog>
  );
}
