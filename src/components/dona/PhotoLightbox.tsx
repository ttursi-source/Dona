import { useEffect, useId, useRef, useState } from "react";
import { Building2, Calendar, ExternalLink, Loader2, Package, Tag, User, X } from "lucide-react";
import type { InventoryItem } from "@/lib/types";

interface PhotoLightboxProps {
  item: InventoryItem | null;
  sedeName?: string;
  donorName?: string;
  onClose: () => void;
}

function toHighResUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (/sz=w\d+/i.test(url)) {
    return url.replace(/sz=w\d+/gi, "sz=w1400");
  }
  return url;
}

export function PhotoLightbox({ item, sedeName, donorName, onClose }: PhotoLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const highResUrl = toHighResUrl(item?.photoUrl);
  const initialSrc = highResUrl ?? item?.photoThumb;
  const [imgSrc, setImgSrc] = useState<string | undefined>(initialSrc);
  const [loadingHd, setLoadingHd] = useState(Boolean(highResUrl));

  useEffect(() => {
    setImgSrc(highResUrl ?? item?.photoThumb);
    setLoadingHd(Boolean(highResUrl));
  }, [item?.id, highResUrl, item?.photoThumb]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (item && !dialog.open) {
      dialog.showModal();
    } else if (!item && dialog.open) {
      dialog.close();
    }
  }, [item]);

  if (!item) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto max-h-[calc(100dvh-28px)] w-[min(calc(100%-24px),760px)] max-w-none overflow-y-auto rounded-3xl border border-slate-700/80 bg-[#0f172a] p-0 text-[#f8fafc] shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop:bg-black/75 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-xl font-extrabold tracking-tight text-[#f8fafc]">
              {item.name}
            </h2>
            <p className="mt-1 text-xs text-[#cbd5e1]">
              {item.category} · {item.quantity} {item.unit} · {item.condition}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar vista de foto"
            onClick={() => dialogRef.current?.close()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 text-[#f8fafc] transition hover:border-[#38bdf8] hover:bg-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {imgSrc ? (
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#090d16]">
            {loadingHd && (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-[#cbd5e1]">
                <Loader2 className="h-4 w-4 animate-spin text-[#38bdf8]" aria-hidden="true" />
                <span>Cargando imagen en alta resolución...</span>
              </div>
            )}
            <img
              src={imgSrc}
              alt={item.name}
              onLoad={() => setLoadingHd(false)}
              onError={() => {
                setLoadingHd(false);
                if (imgSrc === highResUrl && item.photoUrl && item.photoUrl !== highResUrl) {
                  setImgSrc(item.photoUrl);
                } else if (item.photoThumb && imgSrc !== item.photoThumb) {
                  setImgSrc(item.photoThumb);
                }
              }}
              className="max-h-[44dvh] w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-[#090d16] text-xs text-[#cbd5e1]">
            Sin imagen disponible
          </div>
        )}

        <div className="grid gap-2 text-xs text-[#cbd5e1] sm:grid-cols-2">
          {sedeName && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#090d16]/70 px-3 py-2">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-[#38bdf8]" aria-hidden="true" />
              <span>
                Sede: <strong className="text-[#f8fafc]">{sedeName}</strong>
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#090d16]/70 px-3 py-2">
            <User className="h-3.5 w-3.5 shrink-0 text-[#38bdf8]" aria-hidden="true" />
            <span>
              Donante: <strong className="text-[#f8fafc]">{donorName || "Particular"}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#090d16]/70 px-3 py-2">
            <Package className="h-3.5 w-3.5 shrink-0 text-[#38bdf8]" aria-hidden="true" />
            <span>
              Estado:{" "}
              <strong className="text-[#f8fafc]">
                {item.status === "disponible" ? "Disponible" : "Entregado"}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#090d16]/70 px-3 py-2">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#38bdf8]" aria-hidden="true" />
            <span>
              Fecha:{" "}
              <strong className="text-[#f8fafc]">
                {new Date(item.createdAt).toLocaleDateString("es-AR")}
              </strong>
            </span>
          </div>
        </div>

        {item.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-[#cbd5e1]" aria-hidden="true" />
            {item.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-slate-700 bg-slate-800/70 px-2.5 py-0.5 text-xs font-semibold text-[#cbd5e1]"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {item.notes && (
          <p className="rounded-xl border border-slate-800 bg-[#090d16]/60 px-3 py-2 text-xs text-[#cbd5e1]">
            {item.notes}
          </p>
        )}

        <footer className="flex flex-wrap items-center justify-end gap-2">
          {item.photoUrl && (
            <a
              href={item.photoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#38bdf8] px-4 py-2 text-xs font-extrabold text-[#090d16] transition hover:bg-[#56ccf9]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Abrir en Google Drive</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-[#f8fafc] transition hover:border-[#38bdf8] cursor-pointer"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </dialog>
  );
}
