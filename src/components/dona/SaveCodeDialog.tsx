import { useEffect, useId, useState } from "react";
import { Check, Copy, KeyRound, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCode } from "@/lib/access";

interface SaveCodeDialogProps {
  open: boolean;
  title: string;
  subtitle?: string;
  code: string;
  targetName: string;
  buttonLabel?: string;
  onConfirm: () => void;
}

export function SaveCodeDialog({
  open,
  title,
  subtitle,
  code,
  targetName,
  buttonLabel = "Continuar al panel",
  onConfirm,
}: SaveCodeDialogProps) {
  const titleId = useId();
  const checkId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setAcknowledged(false);
      setCopied(false);
    }
  }, [open, code]);

  if (!open) return null;

  const formatted = formatCode(code);
  const whatsappText = encodeURIComponent(
    `Código de acceso de doná para ${targetName}: ${formatted}\nGuardalo en un lugar seguro para entrar desde cualquier dispositivo.`
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      toast.success("Código copiado al portapapeles");
    } catch {
      toast.info(`Copiá manualmente este código: ${formatted}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-3xl border border-[#38bdf8]/40 bg-[#111827] p-6 text-[#f8fafc] shadow-2xl"
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#38bdf8]/15 text-[#38bdf8]">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id={titleId} className="text-lg font-extrabold tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-[#cbd5e1]">{subtitle}</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-[#38bdf8]/35 bg-[#090d16] p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
            Código de {targetName}
          </p>
          <p className="mt-2 select-all font-mono text-3xl font-black tracking-[0.22em] text-[#38bdf8]">
            {formatted}
          </p>
          <p className="mt-2 text-xs text-[#cbd5e1]">
            Por seguridad solo guardamos un hash cifrado. Si lo perdés, Sede Central puede generar uno nuevo.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex flex-1 min-h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-[#f8fafc] transition hover:border-[#38bdf8] cursor-pointer"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            <span>{copied ? "Copiado" : "Copiar código"}</span>
          </button>

          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 min-h-[42px] items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/50 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-900/60"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            <span>Enviar por WhatsApp</span>
          </a>
        </div>

        <label
          htmlFor={checkId}
          className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-700/80 bg-[#090d16]/70 p-3 text-xs text-[#cbd5e1]"
        >
          <input
            id={checkId}
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#38bdf8]"
          />
          <span>Ya guardé este código en un lugar seguro</span>
        </label>

        <button
          type="button"
          disabled={!acknowledged}
          onClick={onConfirm}
          className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center rounded-full bg-[#38bdf8] px-5 py-3 text-sm font-extrabold text-[#090d16] transition hover:bg-[#7dd3fc] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
