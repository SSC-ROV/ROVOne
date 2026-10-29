"use client";
import { useI18n } from "@/lib/i18n";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type ConfirmOpts = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};
export type PromptOpts = {
  title: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  type?: "text" | "date";
};
type ToastKind = "ok" | "err" | "info";
type ToastItem = { id: number; msg: string; kind: ToastKind };

type DialogApi = {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
  toast: (msg: string, kind?: ToastKind) => void;
};

const DialogCtx = createContext<DialogApi | null>(null);

export function useDialogs(): DialogApi {
  const v = useContext(DialogCtx);
  if (!v) throw new Error("useDialogs 必須在 DialogProvider 內使用");
  return v;
}

export default function DialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [confirmState, setConfirmState] =
    useState<(ConfirmOpts & { resolve: (b: boolean) => void }) | null>(null);
  const [promptState, setPromptState] =
    useState<(PromptOpts & { resolve: (s: string | null) => void }) | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastSeq = useRef(0);

  const confirm = useCallback(
    (o: ConfirmOpts) =>
      new Promise<boolean>((resolve) => setConfirmState({ ...o, resolve })),
    []
  );
  const prompt = useCallback(
    (o: PromptOpts) =>
      new Promise<string | null>((resolve) => setPromptState({ ...o, resolve })),
    []
  );
  const toast = useCallback((msg: string, kind: ToastKind = "ok") => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const api: DialogApi = { confirm, prompt, toast };

  function closeConfirm(result: boolean) {
    confirmState?.resolve(result);
    setConfirmState(null);
  }
  function closePrompt(result: string | null) {
    promptState?.resolve(result);
    setPromptState(null);
  }

  return (
    <DialogCtx.Provider value={api}>
      {children}

      {confirmState && (
        <Modal onClose={() => closeConfirm(false)}>
          <h3 className="text-lg font-bold">{confirmState.title}</h3>
          {confirmState.message && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">
              {confirmState.message}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => closeConfirm(false)}>
              {confirmState.cancelText ?? t("取消")}
            </Button>
            <Button
              type="button"
              variant={confirmState.danger ? "destructive" : "default"}
              onClick={() => closeConfirm(true)}
              data-autofocus=""
            >
              {confirmState.confirmText ?? t("確定")}
            </Button>
          </div>
        </Modal>
      )}

      {promptState && (
        <PromptModal opts={promptState} onClose={closePrompt} />
      )}

      <div className="pointer-events-none fixed right-5 bottom-24 z-[70] flex w-80 flex-col gap-2 sm:bottom-5">
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-xl ${
              item.kind === "ok"
                ? "border-success/30 bg-success/10 text-success"
                : item.kind === "err"
                  ? "border-danger/30 bg-danger/10 text-danger"
                  : "border-hairline bg-surface-1 shadow-md text-ink"
            }`}
          >
            {item.msg}
          </div>
        ))}
      </div>
    </DialogCtx.Provider>
  );
}

function focusableIn(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute("disabled"));
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const items = panel ? focusableIn(panel) : [];
    const preferred = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? items[0];
    preferred?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel) return;
      const list = focusableIn(panel);
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous.current?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <Card
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

function PromptModal({
  opts,
  onClose,
}: {
  opts: PromptOpts & { resolve: (s: string | null) => void };
  onClose: (s: string | null) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(opts.initial ?? "");
  return (
    <Modal onClose={() => onClose(null)}>
      <h3 className="text-lg font-bold">{opts.title}</h3>
      {opts.label && <p className="mt-2 text-sm text-ink-subtle">{opts.label}</p>}
      <Input
        className="mt-3"
        type={opts.type ?? "text"}
        value={value}
        placeholder={opts.placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onClose(value);
        }}
        data-autofocus=""
      />
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onClose(null)}>
          {t("取消")}
        </Button>
        <Button type="button" onClick={() => onClose(value)}>
          {t("確定")}
        </Button>
      </div>
    </Modal>
  );
}
