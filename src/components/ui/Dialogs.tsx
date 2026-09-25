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
import { BTN, BTN_GHOST, INPUT_CLS } from "@/lib/ui";

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
            <button className={BTN_GHOST} onClick={() => closeConfirm(false)}>
              {confirmState.cancelText ?? t("取消")}
            </button>
            <button
              className={
                confirmState.danger
                  ? "rounded-lg bg-[#eb5757] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#d94a4a]"
                  : BTN
              }
              onClick={() => closeConfirm(true)}
              autoFocus
            >
              {confirmState.confirmText ?? t("確定")}
            </button>
          </div>
        </Modal>
      )}

      {promptState && (
        <PromptModal opts={promptState} onClose={closePrompt} />
      )}

      <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-xl ${
              t.kind === "ok"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                : t.kind === "err"
                  ? "border-rose-500/30 bg-rose-500/15 text-rose-200"
                  : "border-hairline bg-white shadow-md text-ink"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </DialogCtx.Provider>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-hairline bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
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
      <input
        className={`${INPUT_CLS} mt-3`}
        type={opts.type ?? "text"}
        value={value}
        placeholder={opts.placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onClose(value);
        }}
        autoFocus
      />
      <div className="mt-5 flex justify-end gap-2">
        <button className={BTN_GHOST} onClick={() => onClose(null)}>
          {t("取消")}
        </button>
        <button className={BTN} onClick={() => onClose(value)}>
          {t("確定")}
        </button>
      </div>
    </Modal>
  );
}
