"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

// 原生 dialog 隔离背景，显式 Tab 循环覆盖浏览器将焦点交回主体/工具栏的边界。
const modalStack: HTMLDialogElement[] = [];
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    modalStack.push(dialog);
    const tab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || modalStack.at(-1) !== dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]"))
        .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
      event.preventDefault();
      if (!controls.length) { dialog.focus(); return; }
      const index = controls.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length;
      controls[next].focus();
    };
    document.addEventListener("keydown", tab, true);
    return () => {
      document.removeEventListener("keydown", tab, true);
      const index = modalStack.indexOf(dialog);
      if (index >= 0) modalStack.splice(index, 1);
      dialog.close();
      if (previous?.isConnected && previous !== document.body && !previous.matches(":disabled") && previous.getClientRects().length) previous.focus();
      else if (modalStack.at(-1)) modalStack.at(-1)!.focus();
      else document.querySelector<HTMLElement>("main")?.focus();
    };
  }, []);
  return (
    <dialog ref={ref} aria-modal="true" aria-labelledby={id} tabIndex={-1}
      onCancel={(event) => { event.preventDefault(); onClose?.(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[520px] overflow-y-auto rounded-2xl border border-line bg-card p-5 text-ink shadow-xl backdrop:bg-black/50">
      <span id={id} className="sr-only">{title}</span>
      {children}
    </dialog>
  );
}
