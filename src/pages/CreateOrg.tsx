import { useState } from "react";
import { ArrowLeft, Building2, Check, Copy, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SaveCodeDialog } from "@/components/dona/SaveCodeDialog";
import Stepper, { Step } from "@/components/ui/Stepper";
import { formatCode, generateCode, hashCode } from "@/lib/access";
import { getConfig } from "@/lib/config";
import { geocodeLocality } from "@/lib/geocode";
import { signIn } from "@/lib/session";
import { createOrg, useDona } from "@/lib/store";
import { registerOrgRemote } from "@/lib/sync";

function slugifyId(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}

export default function CreateOrg() {
  const navigate = useNavigate();
  const { orgs } = useDona();

  const [currentStep, setCurrentStep] = useState(1);
  const [orgName, setOrgName] = useState("");
  const [kind, setKind] = useState<"red" | "independiente">("red");
  const [contact, setContact] = useState("");
  const [sedeName, setSedeName] = useState("Sede Central");
  const [locality, setLocality] = useState("CABA");

  const [centralCode, setCentralCode] = useState(() => generateCode());
  const [copiedInline, setCopiedInline] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [createdInfo, setCreatedInfo] = useState<{
    orgId: string;
    orgName: string;
    code: string;
  } | null>(null);

  const handleCopyInline = async () => {
    const formatted = formatCode(centralCode);
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedInline(true);
      toast.success("Código de Sede Central copiado");
      setTimeout(() => setCopiedInline(false), 1800);
    } catch {
      toast.info(`Copiá manualmente: ${formatted}`);
    }
  };

  const handleComplete = async () => {
    if (submitting) return;
    if (!orgName.trim() || !sedeName.trim()) {
      toast.error("Completá el nombre de la organización y de la primera sede.");
      return;
    }

    setSubmitting(true);
    try {
      const baseSlug = slugifyId(orgName) || "org";
      const orgId = orgs.some((o) => o.id === baseSlug)
        ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
        : baseSlug;

      const [codeHash, coords] = await Promise.all([
        hashCode(orgId, centralCode),
        geocodeLocality(locality),
      ]);

      const { org, sede } = createOrg({
        id: orgId,
        orgName,
        kind,
        contact,
        codeHash,
        centralCodeHash: codeHash,
        sedeId: `${orgId}-central`,
        sedeName,
        locality,
        lat: coords?.lat,
        lng: coords?.lng,
      });

      const { sheetsEndpoint } = getConfig();
      if (sheetsEndpoint) {
        const res = await registerOrgRemote(org, sede);
        if (res.ok && res.token) {
          signIn({
            role: "central",
            orgId: org.id,
            sedeId: sede.id,
            token: res.token,
          });
          toast.success(`¡Organización "${org.name}" registrada en Google Sheets!`);
        } else {
          signIn({
            role: "central",
            orgId: org.id,
            sedeId: sede.id,
            token: "local",
          });
          toast.warning(
            res.error || "Organización guardada en este dispositivo; podés reintentar luego."
          );
        }
      } else {
        signIn({
          role: "central",
          orgId: org.id,
          sedeId: sede.id,
          token: "local",
        });
        toast.success(`¡Organización "${org.name}" creada!`);
      }

      setCreatedInfo({
        orgId: org.id,
        orgName: org.name,
        code: centralCode,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canAdvance =
    (currentStep === 1 && orgName.trim().length > 0) ||
    currentStep === 2 ||
    (currentStep === 3 && sedeName.trim().length > 0) ||
    currentStep === 4;

  return (
    <main
      className="flex min-h-svh w-full flex-col items-center justify-center bg-[#090d16] px-5 py-10 text-[#f8fafc]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 25%, rgba(56, 189, 248, 0.14), rgba(9, 13, 22, 0) 58%)",
      }}
    >
      <div className="w-full max-w-[560px]">
        <div className="mb-6 flex items-center justify-start">
          <Link
            to="/organizacion"
            className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/25 bg-[#111827]/75 px-4 py-2 text-xs font-semibold text-[#cbd5e1] transition hover:border-[#38bdf8]/60 hover:text-[#f8fafc]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver</span>
          </Link>
        </div>

        <header className="mb-6 flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38bdf8]/15 text-[#38bdf8]">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Crear organización</h1>
            <p className="text-xs text-[#cbd5e1]">
              Armá tu espacio central y habilitá sedes para voluntarios en 4 pasos.
            </p>
          </div>
        </header>

        <Stepper
          theme="dark"
          accentColor="#38bdf8"
          width={560}
          linear={true}
          step={currentStep}
          onStepChange={setCurrentStep}
          onFinalStepCompleted={() => void handleComplete()}
          backButtonText="Atrás"
          nextButtonText="Continuar"
          completeButtonText={submitting ? "Creando..." : "Crear organización"}
          backButtonProps={{ className: "font-baskerville" }}
          nextButtonProps={{
            disabled: !canAdvance || submitting,
            className: "font-baskerville",
          }}
        >
          <Step title="Organización">
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-[#f8fafc]">
                  ¿Cómo se llama tu organización?
                </h2>
                <p className="mt-1 text-xs text-[#cbd5e1]">
                  Elegí el nombre y si funciona como red de sedes o un solo espacio.
                </p>
              </div>

              <div>
                <label htmlFor="org-name" className="mb-1.5 block text-xs font-bold text-[#cbd5e1]">
                  Nombre de la organización *
                </label>
                <input
                  id="org-name"
                  type="text"
                  required
                  placeholder="Ej: Red Solidaria Sur"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && orgName.trim()) {
                      e.preventDefault();
                      setCurrentStep(2);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-[#090d16] px-3.5 py-2.5 text-sm text-[#f8fafc] placeholder:text-slate-400 focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-bold text-[#cbd5e1]">Estructura</span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setKind("red")}
                    aria-pressed={kind === "red"}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition cursor-pointer ${
                      kind === "red"
                        ? "border-[#38bdf8] bg-[#38bdf8]/15 text-[#38bdf8]"
                        : "border-slate-700 bg-[#090d16] text-[#cbd5e1]"
                    }`}
                  >
                    Red con varias sedes
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind("independiente")}
                    aria-pressed={kind === "independiente"}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition cursor-pointer ${
                      kind === "independiente"
                        ? "border-[#38bdf8] bg-[#38bdf8]/15 text-[#38bdf8]"
                        : "border-slate-700 bg-[#090d16] text-[#cbd5e1]"
                    }`}
                  >
                    Sede única / comedor
                  </button>
                </div>
              </div>
            </div>
          </Step>

          <Step title="Contacto">
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-[#f8fafc]">Datos de contacto</h2>
                <p className="mt-1 text-xs text-[#cbd5e1]">
                  Opcional, para identificar a la coordinación ante donantes y sedes.
                </p>
              </div>

              <div>
                <label
                  htmlFor="org-contact"
                  className="mb-1.5 block text-xs font-bold text-[#cbd5e1]"
                >
                  Email o WhatsApp (opcional)
                </label>
                <input
                  id="org-contact"
                  type="text"
                  placeholder="coordinacion@mi-ong.org"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setCurrentStep(3);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-[#090d16] px-3.5 py-2.5 text-sm text-[#f8fafc] placeholder:text-slate-400 focus:border-[#38bdf8] focus:outline-none"
                />
              </div>
            </div>
          </Step>

          <Step title="Primera sede">
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-[#f8fafc]">Sede inicial</h2>
                <p className="mt-1 text-xs text-[#cbd5e1]">
                  Se creará como Sede Central de tu organización.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="first-sede"
                    className="mb-1.5 block text-xs font-bold text-[#cbd5e1]"
                  >
                    Nombre de la primera sede *
                  </label>
                  <input
                    id="first-sede"
                    type="text"
                    required
                    value={sedeName}
                    onChange={(e) => setSedeName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-[#090d16] px-3.5 py-2.5 text-sm text-[#f8fafc] focus:border-[#38bdf8] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="first-locality"
                    className="mb-1.5 block text-xs font-bold text-[#cbd5e1]"
                  >
                    Localidad
                  </label>
                  <input
                    id="first-locality"
                    type="text"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && sedeName.trim()) {
                        e.preventDefault();
                        setCurrentStep(4);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-[#090d16] px-3.5 py-2.5 text-sm text-[#f8fafc] focus:border-[#38bdf8] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </Step>

          <Step title="Confirmar">
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-extrabold text-[#f8fafc]">
                  Revisá los datos y guardá el código central
                </h2>
                <p className="mt-1 text-xs text-[#cbd5e1]">
                  Con este código vas a poder ingresar a Sede Central desde cualquier computadora o celular.
                </p>
              </div>

              <dl className="grid gap-2 rounded-2xl border border-slate-700/70 bg-[#090d16]/75 p-4 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-[#94a3b8]">Organización</dt>
                  <dd className="mt-0.5 font-bold text-[#f8fafc]">{orgName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[#94a3b8]">Estructura</dt>
                  <dd className="mt-0.5 font-bold text-[#f8fafc]">
                    {kind === "red" ? "Red con varias sedes" : "Sede única / comedor"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#94a3b8]">Primera sede</dt>
                  <dd className="mt-0.5 font-bold text-[#f8fafc]">
                    {sedeName || "—"} ({locality || "Argentina"})
                  </dd>
                </div>
                <div>
                  <dt className="text-[#94a3b8]">Contacto</dt>
                  <dd className="mt-0.5 font-bold text-[#f8fafc]">
                    {contact.trim() || "Sin especificar"}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#38bdf8]/35 bg-[#090d16] px-4 py-3">
                <div>
                  <span className="block text-xs font-semibold text-[#94a3b8]">
                    Código de Sede Central
                  </span>
                  <span className="select-all font-mono text-xl font-black tracking-widest text-[#38bdf8]">
                    {formatCode(centralCode)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyInline()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-[#f8fafc] hover:border-[#38bdf8] cursor-pointer"
                  >
                    {copiedInline ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>{copiedInline ? "Copiado" : "Copiar"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCentralCode(generateCode())}
                    aria-label="Generar otro código"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-[#cbd5e1] hover:border-[#38bdf8] hover:text-[#f8fafc] cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Otro</span>
                  </button>
                </div>
              </div>
            </div>
          </Step>
        </Stepper>
      </div>

      {createdInfo && (
        <SaveCodeDialog
          open={Boolean(createdInfo)}
          title="¡Organización creada! Confirmá tu código central"
          subtitle="Sin este código no vas a poder volver a entrar al panel general desde otro equipo."
          code={createdInfo.code}
          targetName={`Sede Central · ${createdInfo.orgName}`}
          buttonLabel="Ir a Sede Central"
          onConfirm={() => {
            const targetOrgId = createdInfo.orgId;
            setCreatedInfo(null);
            navigate(`/central/${targetOrgId}`);
          }}
        />
      )}
    </main>
  );
}
