import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { KeyRound, Loader2, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { formatCode, normalizeCode } from "@/lib/access";
import { getConfig } from "@/lib/config";
import { loginLocal, signIn } from "@/lib/session";
import { loginRemote, syncNow } from "@/lib/sync";

interface AccessCodeDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  role: "sede" | "central";
  orgId: string;
  sedeId?: string;
  isDemo?: boolean;
  onSuccess: () => void;
}

export function AccessCodeDialog({
  open,
  onClose,
  title,
  subtitle,
  role,
  orgId,
  sedeId,
  isDemo = false,
  onSuccess,
}: AccessCodeDialogProps) {
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setError(null);
    setSubmitting(false);
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = normalizeCode(code);
    if (clean.length < 4) {
      setError("Ingresá el código completo de 6 caracteres.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { sheetsEndpoint } = getConfig();
      if (sheetsEndpoint && !isDemo) {
        const res = await loginRemote({
          role,
          orgId,
          sedeId,
          code: clean,
        });

        if (!res.ok || !res.token) {
          if (res.locked) {
            setError(res.error || "Demasiados intentos fallidos. Esperá 10 minutos.");
          } else if (typeof res.remainingAttempts === "number") {
            setError(
              `${res.error || "Código incorrecto."} Te quedan ${res.remainingAttempts} intento(s).`
            );
          } else {
            setError(res.error || "No se pudo verificar el código.");
          }
          return;
        }

        signIn({
          role,
          orgId,
          sedeId: res.sedeId ?? sedeId,
          token: res.token,
        });
        toast.success("Acceso habilitado");
        void syncNow();
        onSuccess();
        return;
      }

      const localRes = await loginLocal(role, orgId, sedeId, clean);
      if (!localRes.ok || !localRes.session) {
        setError(localRes.error || "Código incorrecto.");
        return;
      }
      signIn(localRes.session);
      toast.success("Acceso habilitado");
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-3xl border border-[#38bdf8]/35 bg-[#111827] p-6 text-[#f8fafc] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#38bdf8]/15 text-[#38bdf8]">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id={titleId} className="text-lg font-extrabold tracking-tight">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-xs text-[#cbd5e1]">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 text-[#cbd5e1] transition hover:border-[#38bdf8] hover:text-[#f8fafc] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor={inputId} className="mb-1.5 block text-xs font-bold text-[#cbd5e1]">
              Código de acceso (6 caracteres)
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              autoComplete="one-time-code"
              inputMode="text"
              maxLength={7}
              placeholder="ABC-123"
              value={code}
              onChange={(e) => setCode(formatCode(e.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-[#090d16] px-4 py-3 text-center font-mono text-xl font-extrabold tracking-widest text-[#f8fafc] uppercase placeholder:text-slate-500 focus:border-[#38bdf8] focus:outline-none"
            />
          </div>

          {isDemo && (
            <p className="rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/10 px-3 py-2 text-xs text-[#bae6fd]">
              En modo demo el código de acceso es <strong className="font-mono">DEMO01</strong>.
            </p>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-950/60 px-3 py-2.5 text-xs text-rose-200"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700 bg-slate-800/70 px-4 py-2.5 text-xs font-bold text-[#cbd5e1] transition hover:bg-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#38bdf8] px-5 py-2.5 text-xs font-extrabold text-[#090d16] transition hover:bg-[#7dd3fc] disabled:opacity-60 cursor-pointer"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>{submitting ? "Verificando..." : "Ingresar"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
