import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Building2, Loader2, Plus, ShieldCheck } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { gsap } from "gsap";
import { AccessCodeDialog } from "@/components/dona/AccessCodeDialog";
import { DemoBanner } from "@/components/dona/DemoBanner";
import { SaveCodeDialog } from "@/components/dona/SaveCodeDialog";
import ChromaGrid, { DEFAULT_CHROMA_ITEMS, type ChromaItem } from "@/components/ui/ChromaGrid";
import { generateCode, hashCode } from "@/lib/access";
import { getConfig } from "@/lib/config";
import { geocodeLocality } from "@/lib/geocode";
import { hasAccessToCentral, hasAccessToSede, signIn, useSession } from "@/lib/session";
import { joinSede, setCurrentSede, useDona } from "@/lib/store";
import { fetchPublicSedes, registerSedeRemote } from "@/lib/sync";

const SEDE_ACCENTS = ["#38bdf8", "#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa"];

function slugifyId(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}

export default function JoinOrg() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { orgs, sedes, items } = useDona();
  const session = useSession();

  const org = orgs.find((o) => o.id === orgId);
  const [loadingRemote, setLoadingRemote] = useState(
    () => !org && Boolean(getConfig().sheetsEndpoint)
  );

  useEffect(() => {
    if (!getConfig().sheetsEndpoint) {
      setLoadingRemote(false);
      return;
    }
    let cancelled = false;
    void fetchPublicSedes().finally(() => {
      if (!cancelled) setLoadingRemote(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const activeSedes = useMemo(
    () => sedes.filter((s) => s.orgId === orgId && !s.isCentral && s.active !== false),
    [sedes, orgId]
  );

  const [name, setName] = useState("");
  const [locality, setLocality] = useState("");
  const [manager, setManager] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [authDialog, setAuthDialog] = useState<{
    role: "sede" | "central";
    sedeId?: string;
    title: string;
    subtitle: string;
    isDemo: boolean;
  } | null>(null);

  const [createdCodeInfo, setCreatedCodeInfo] = useState<{
    sedeId: string;
    sedeName: string;
    code: string;
  } | null>(null);

  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = countRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      el.textContent = String(activeSedes.length);
      return;
    }
    const obj = { val: 0 };
    const tween = gsap.to(obj, {
      val: activeSedes.length,
      duration: 0.7,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = String(Math.round(obj.val));
      },
    });
    return () => {
      tween.kill();
    };
  }, [activeSedes.length]);

  const sedeCards: ChromaItem[] = useMemo(() => {
    if (!org) return [];
    return activeSedes.map((sede, index) => {
      const sedePhotos = items.filter(
        (i) => i.sedeId === sede.id && Boolean(i.photoThumb || i.photoUrl)
      );
      const latestPhoto = sedePhotos[0]?.photoThumb || sedePhotos[0]?.photoUrl;
      const fallbackImg = DEFAULT_CHROMA_ITEMS[index % DEFAULT_CHROMA_ITEMS.length].image;
      const detailParts = [sede.locality];
      if (sede.manager) detailParts.push(`Ref: ${sede.manager}`);
      if (sedePhotos.length > 0) detailParts.push(`${sedePhotos.length} foto(s)`);

      return {
        image: latestPhoto || fallbackImg,
        title: sede.name,
        subtitle: detailParts.join(" · "),
        accent: SEDE_ACCENTS[index % SEDE_ACCENTS.length],
        onClick: () => {
          if (hasAccessToSede(session, org.id, sede.id)) {
            setCurrentSede(sede.id);
            navigate(`/sede/${sede.id}`);
            return;
          }
          setAuthDialog({
            role: "sede",
            sedeId: sede.id,
            title: sede.name,
            subtitle: `Ingresá el código de acceso de ${sede.locality}`,
            isDemo: Boolean(sede.demo),
          });
        },
      };
    });
  }, [activeSedes, items, navigate, org, session]);

  if (!org) {
    if (loadingRemote) {
      return (
        <main className="flex min-h-svh w-full items-center justify-center bg-[#090d16] text-[#f8fafc]">
          <div className="flex items-center gap-3 text-sm text-[#cbd5e1]">
            <Loader2 className="h-5 w-5 animate-spin text-[#38bdf8]" aria-hidden="true" />
            <span>Cargando sedes desde Google Sheets...</span>
          </div>
        </main>
      );
    }
    return <Navigate to="/organizacion" replace />;
  }

  const handleOpenCentral = () => {
    if (hasAccessToCentral(session, org.id)) {
      navigate(`/central/${org.id}`);
      return;
    }
    setAuthDialog({
      role: "central",
      title: `Sede Central · ${org.name}`,
      subtitle: "Ingresá el código maestro de coordinación general",
      isDemo: Boolean(org.demo),
    });
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !locality.trim()) {
      toast.error("Completá el nombre de la sede y la localidad.");
      return;
    }

    setSubmitting(true);
    try {
      const slug = slugifyId(name) || "sede";
      const suffix = Math.random().toString(36).slice(2, 6);
      const newSedeId = `${org.id}-${slug}-${suffix}`.slice(0, 60);
      const code = generateCode();
      const [codeHash, coords] = await Promise.all([
        hashCode(newSedeId, code),
        geocodeLocality(locality),
      ]);

      const created = joinSede({
        id: newSedeId,
        orgId: org.id,
        name,
        locality,
        manager,
        codeHash,
        lat: coords?.lat,
        lng: coords?.lng,
      });

      const { sheetsEndpoint } = getConfig();
      if (sheetsEndpoint) {
        const res = await registerSedeRemote(created);
        if (res.ok && res.token) {
          signIn({
            role: "sede",
            orgId: org.id,
            sedeId: created.id,
            token: res.token,
          });
          toast.success(`¡Bienvenido! Sumaste ${created.name} a ${org.name}.`);
        } else {
          signIn({
            role: "sede",
            orgId: org.id,
            sedeId: created.id,
            token: "local",
          });
          toast.warning(
            res.error || "Sede creada en este dispositivo; reintentaremos sincronizar."
          );
        }
      } else {
        signIn({
          role: "sede",
          orgId: org.id,
          sedeId: created.id,
          token: "local",
        });
        toast.success(`¡Bienvenido! Sumaste ${created.name} a ${org.name}.`);
      }

      setName("");
      setLocality("");
      setManager("");
      setCreatedCodeInfo({
        sedeId: created.id,
        sedeName: created.name,
        code,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="min-h-svh w-full bg-[#090d16] px-5 py-10 text-[#f8fafc]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 15%, rgba(56, 189, 248, 0.14), rgba(9, 13, 22, 0) 55%)",
      }}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-start gap-4">
          <Link
            to="/organizacion"
            className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/25 bg-[#111827]/75 px-4 py-2 text-xs font-semibold text-[#cbd5e1] transition hover:border-[#38bdf8]/60 hover:text-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Cambiar opción</span>
          </Link>
        </div>

        <DemoBanner className="mb-6" />

        <section className="mb-8 flex flex-col items-start justify-between gap-6 rounded-3xl border border-[#38bdf8]/30 bg-[#111827]/85 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.45)] sm:flex-row sm:items-center sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#38bdf8]">
              Red solidaria
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {org.name}
            </h1>
            <div className="mt-3 flex items-baseline gap-3">
              <span
                ref={countRef}
                className="text-5xl font-black tracking-tight text-[#38bdf8] tabular-nums sm:text-6xl"
              >
                {activeSedes.length}
              </span>
              <span className="text-base font-semibold text-[#cbd5e1] sm:text-lg">
                {activeSedes.length === 1 ? "sede unida en la red" : "sedes unidas en la red"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenCentral}
            className="font-baskerville inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-full bg-[#38bdf8] px-6 py-3 text-sm font-bold text-[#090d16] shadow-[0_8px_28px_rgba(56,189,248,0.3)] transition hover:-translate-y-0.5 hover:bg-[#56ccf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] cursor-pointer"
          >
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <span>Entrar a Sede Central</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr] lg:items-start">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div>
                <h2 className="text-lg font-extrabold">Sedes conectadas</h2>
                <p className="text-xs text-[#cbd5e1]">
                  Elegí una tarjeta e ingresá su código para abrir su inventario.
                </p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-[#38bdf8]">
                {activeSedes.length} activas
              </span>
            </div>

            {sedeCards.length > 0 ? (
              <ChromaGrid
                items={sedeCards}
                columns={2}
                minCardWidth={210}
                radius={260}
                theme="dark"
                frame
                grayscale={0.35}
                dim={0.08}
              />
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-[#111827]/75 p-8 text-center text-sm text-[#cbd5e1]">
                Todavía no hay sedes operativas unidas a {org.name}. Creá la primera desde el formulario de al lado.
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[#38bdf8]/25 bg-[#111827]/85 p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#38bdf8]/15 text-[#38bdf8]">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold">Sumá tu sede</h2>
                <p className="text-xs text-[#cbd5e1]">
                  Alta con código propio para voluntarios y referentes.
                </p>
              </div>
            </div>

            <form onSubmit={(e) => void handleJoin(e)} className="space-y-4">
              <div>
                <label htmlFor="sede-name" className="mb-1.5 block text-xs font-bold text-[#cbd5e1]">
                  Nombre de la sede *
                </label>
                <input
                  id="sede-name"
                  type="text"
                  required
                  placeholder="Ej: Cáritas Palermo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#090d16] px-3.5 py-2.5 text-sm text-[#f8fafc] placeholder:text-slate-400 focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sede-locality"
                  className="mb-1.5 block text-xs font-bold text-[#cbd5e1]"
                >
                  Localidad / barrio *
                </label>
                <input
                  id="sede-locality"
                  type="text"
                  required
                  placeholder="Ej: Palermo, CABA"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#090d16] px-3.5 py-2.5 text-sm text-[#f8fafc] placeholder:text-slate-400 focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sede-manager"
                  className="mb-1.5 block text-xs font-bold text-[#cbd5e1]"
                >
                  Referente o encargado (opcional)
                </label>
                <input
                  id="sede-manager"
                  type="text"
                  placeholder="Ej: Sofía Méndez"
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#090d16] px-3.5 py-2.5 text-sm text-[#f8fafc] placeholder:text-slate-400 focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="font-baskerville inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#38bdf8] px-5 py-3 text-sm font-bold text-[#090d16] transition hover:bg-[#56ccf9] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{submitting ? "Registrando sede..." : "Sumar sede y generar código"}</span>
              </button>
            </form>
          </section>
        </div>
      </div>

      {authDialog && (
        <AccessCodeDialog
          open={Boolean(authDialog)}
          onClose={() => setAuthDialog(null)}
          title={authDialog.title}
          subtitle={authDialog.subtitle}
          role={authDialog.role}
          orgId={org.id}
          sedeId={authDialog.sedeId}
          isDemo={authDialog.isDemo}
          onSuccess={() => {
            const target = authDialog;
            setAuthDialog(null);
            if (target.role === "central") {
              navigate(`/central/${org.id}`);
            } else if (target.sedeId) {
              setCurrentSede(target.sedeId);
              navigate(`/sede/${target.sedeId}`);
            }
          }}
        />
      )}

      {createdCodeInfo && (
        <SaveCodeDialog
          open={Boolean(createdCodeInfo)}
          title="¡Sede creada! Guardá su código de acceso"
          subtitle="Compartilo únicamente con los voluntarios de esta sede."
          code={createdCodeInfo.code}
          targetName={createdCodeInfo.sedeName}
          buttonLabel="Entrar a la sede"
          onConfirm={() => {
            const id = createdCodeInfo.sedeId;
            setCreatedCodeInfo(null);
            navigate(`/sede/${id}`);
          }}
        />
      )}
    </main>
  );
}
