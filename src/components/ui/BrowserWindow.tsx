import { useState } from "react";
import { ExternalLink, Lock, RotateCw } from "lucide-react";

export interface BrowserWindowProps {
  url?: string;
  tabTitle?: string;
  badge?: string;
  externalHref?: string;
  iframeSrc: string;
  iframeTitle: string;
}

export default function BrowserWindow({
  url = "https://dona.app",
  tabTitle = "doná",
  badge,
  externalHref,
  iframeSrc,
  iframeTitle,
}: BrowserWindowProps) {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="flex h-full min-h-[340px] flex-1 flex-col overflow-hidden rounded-2xl border border-[#38bdf8]/40 bg-[#0b1120] shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
      {/* Browser chrome header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 bg-[#111827]/95 px-3 py-2 sm:px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-rose-400/90" />
            <span className="h-3 w-3 rounded-full bg-amber-300/90" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
          </div>
          <span className="hidden rounded-lg border border-slate-700/80 bg-[#090d16] px-2.5 py-1 text-xs font-semibold text-[#cbd5e1] md:inline-block">
            {tabTitle}
          </span>
        </div>

        {/* Address bar with verified domain */}
        <div className="flex min-w-[180px] max-w-md flex-1 items-center justify-between gap-2 rounded-full border border-slate-700/80 bg-[#090d16] px-3.5 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 text-[#34d399]" aria-hidden="true" />
            <span className="truncate font-mono text-xs font-semibold text-[#f8fafc]">{url}</span>
          </div>
          {badge && (
            <span className="hidden shrink-0 rounded-full border border-[#38bdf8]/40 bg-[#111827] px-2.5 py-0.5 text-[11px] font-bold text-[#38bdf8] sm:inline-block">
              {badge}
            </span>
          )}
        </div>

        {/* Browser actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            aria-label="Recargar mapa"
            className="demo-focus-ring inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-slate-700/80 bg-[#090d16] text-[#cbd5e1] transition hover:border-[#38bdf8] hover:text-[#38bdf8] cursor-pointer"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          {externalHref && (
            <a
              href={externalHref}
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir mapa en pestaña nueva"
              className="demo-focus-ring inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-slate-700/80 bg-[#090d16] px-3 py-1 text-xs font-semibold text-[#f8fafc] transition hover:border-[#38bdf8] hover:text-[#38bdf8]"
            >
              <span className="hidden sm:inline">Abrir</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      {/* Embedded page frame */}
      <iframe
        key={reloadKey}
        src={iframeSrc}
        title={iframeTitle}
        className="h-full min-h-[340px] w-full flex-1 border-0 bg-[#090d16]"
      />
    </div>
  );
}
