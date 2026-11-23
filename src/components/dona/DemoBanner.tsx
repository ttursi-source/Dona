import { useState } from "react";
import { Info, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { signOut } from "@/lib/session";
import { clearDemoData, hasDemoData, useDona } from "@/lib/store";

interface DemoBannerProps {
  className?: string;
}

export function DemoBanner({ className = "" }: DemoBannerProps) {
  const state = useDona();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  if (!hasDemoData(state)) {
    return null;
  }

  const handleReset = () => {
    clearDemoData();
    signOut();
    setConfirming(false);
    toast.success("Datos de ejemplo borrados. Ya podés trabajar con datos reales.");
    navigate("/organizacion", { replace: true });
  };

  return (
    <div
      role="region"
      aria-label="Aviso de modo demostración"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#38bdf8]/45 bg-[#0f172a] px-4 py-3 text-xs text-[#f8fafc] shadow-lg ${className}`}
    >
      <div className="flex items-start gap-2.5 sm:items-center">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#38bdf8] sm:mt-0" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="font-bold text-[#7dd3fc]">Modo demo:</strong> estás viendo datos de ejemplo (código de acceso:{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono font-bold text-[#f8fafc]">
            DEMO01
          </code>
          ). Nunca se sincronizan con tu Google Sheet real.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[#38bdf8] px-3.5 py-1.5 text-xs font-extrabold text-[#090d16] transition hover:bg-[#7dd3fc] cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Empezar con datos reales</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex min-h-[36px] items-center rounded-full bg-rose-500 px-3.5 py-1.5 text-xs font-extrabold text-white transition hover:bg-rose-400 cursor-pointer"
            >
              Confirmar limpieza demo
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="inline-flex min-h-[36px] items-center rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-bold text-[#f8fafc] transition hover:bg-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
