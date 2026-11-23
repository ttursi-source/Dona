import { useRef, useState, type FormEvent } from "react";
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, Panel } from "@/components/ui/glassy-dashboard";
import { suggestTags, inferCategory } from "@/lib/classify";
import { getConfig } from "@/lib/config";
import { tagImage } from "@/lib/gemini";
import { fileToJpeg, type ProcessedJpeg } from "@/lib/image";
import { putPendingPhoto } from "@/lib/photoQueue";
import { addDonor, addItem } from "@/lib/store";
import { scheduleSync } from "@/lib/sync";
import {
  CATEGORIES,
  DONOR_KINDS,
  ITEM_CONDITIONS,
  type Category,
  type Donor,
  type DonorKind,
  type ItemCondition,
} from "@/lib/types";

interface CaptureFlowProps {
  orgId: string;
  sedeId: string;
  donors: Donor[];
  onSaved?: () => void;
}

export function CaptureFlow({ orgId, sedeId, donors, onSaved }: CaptureFlowProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"idle" | "tagging" | "form">("idle");
  const [aiSource, setAiSource] = useState<"gemini" | "manual">("manual");
  const [thumb, setThumb] = useState<ProcessedJpeg | null>(null);
  const [fullImg, setFullImg] = useState<ProcessedJpeg | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("unidades");
  const [condition, setCondition] = useState<ItemCondition>("buen estado");
  const [perishable, setPerishable] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  const [donorMode, setDonorMode] = useState<"particular" | "organizacion">("particular");
  const [selectedDonorId, setSelectedDonorId] = useState<string>(donors[0]?.id ?? "");
  const [keepDonor, setKeepDonor] = useState(false);

  const [newDonorOpen, setNewDonorOpen] = useState(false);
  const [newDonorName, setNewDonorName] = useState("");
  const [newDonorKind, setNewDonorKind] = useState<DonorKind>("empresa");

  const [saving, setSaving] = useState(false);

  const resetItemForm = () => {
    setStep("idle");
    setThumb(null);
    setFullImg(null);
    setName("");
    setCategory("");
    setCategoryTouched(false);
    setTags([]);
    setTagInput("");
    setQuantity(1);
    setUnit("unidades");
    setCondition("buen estado");
    setPerishable(false);
    setExpiresAt("");
    setNotes("");
    if (!keepDonor) {
      setDonorMode("particular");
    }
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setStep("tagging");
      const { geminiKey, sheetsEndpoint } = getConfig();
      const [small, large] = await Promise.all([
        sheetsEndpoint ? fileToJpeg(file, 240, 0.65) : fileToJpeg(file, 480, 0.72),
        fileToJpeg(file, 1024, 0.82),
      ]);
      setThumb(small);
      setFullImg(large);

      if (!sheetsEndpoint && !geminiKey) {
        setAiSource("manual");
        setStep("form");
        return;
      }

      try {
        const result = await tagImage(large.base64);
        setName(result.nombre);
        setCategory(result.categoria);
        setCategoryTouched(true);
        setTags(result.etiquetas);
        setQuantity(result.cantidad_estimada);
        setUnit(result.unidad);
        setCondition(result.estado);
        setPerishable(result.perecedero);
        setExpiresAt(result.vencimiento ?? "");
        setAiSource("gemini");
        toast.success("Gemini etiquetó la donación");
      } catch {
        setAiSource("manual");
        toast.warning("No pudimos conectar con Gemini; pasaste a modo manual.");
      }
      setStep("form");
    } catch {
      toast.error("No pudimos leer esa imagen. Probá con otra foto.");
      setStep("idle");
    }
  };

  const addTag = (raw: string) => {
    const clean = raw.trim().toLowerCase();
    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setTagInput("");
  };

  const handleCreateInlineDonor = () => {
    if (!newDonorName.trim()) {
      toast.error("Escribí el nombre de la organización o empresa.");
      return;
    }
    const created = addDonor({
      orgId,
      name: newDonorName,
      kind: newDonorKind,
    });
    setSelectedDonorId(created.id);
    setDonorMode("organizacion");
    setNewDonorOpen(false);
    setNewDonorName("");
    toast.success(`Donante "${created.name}" agregado`);
    scheduleSync();
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Ingresá un nombre para el producto o donación.");
      return;
    }
    if (!category) {
      toast.error("Elegí una categoría para esta donación.");
      return;
    }
    const effectiveDonorId =
      donorMode === "organizacion" ? selectedDonorId || donors[0]?.id || null : null;
    if (donorMode === "organizacion" && !effectiveDonorId) {
      toast.error("Seleccioná o creá la organización donante.");
      return;
    }

    setSaving(true);
    try {
      const effectiveTags = tags.length > 0 ? tags : suggestTags(name, category);
      const created = addItem({
        orgId,
        sedeId,
        name,
        category,
        tags: effectiveTags,
        quantity,
        unit,
        condition,
        perishable,
        expiresAt: perishable ? expiresAt || undefined : undefined,
        donorId: effectiveDonorId,
        photoThumb: thumb?.dataUrl,
        notes,
        aiSource,
      });

      const { sheetsEndpoint } = getConfig();
      if (sheetsEndpoint && fullImg?.base64) {
        await putPendingPhoto(created.id, fullImg.base64);
      }

      if (sheetsEndpoint) {
        toast.success("Guardado ✓ · sincronizando con Google Sheets y Drive...");
        scheduleSync(300);
      } else {
        toast.success("Guardado ✓");
      }

      resetItemForm();
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const { geminiKey, sheetsEndpoint } = getConfig();
  const hasGeminiKey = Boolean(sheetsEndpoint || geminiKey);

  return (
    <div className="gd-analytics">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="gd-sr"
        aria-label="Sacar foto con cámara"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="gd-sr"
        aria-label="Subir imagen desde galería"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {step === "idle" && (
        <Panel
          title="Nueva donación en 10 segundos"
          subtitle={
            hasGeminiKey
              ? "Sacá una foto y Gemini sugiere categoría, cantidad y etiquetas."
              : "Sacá una foto para guardarla y completá los datos en modo manual (o cargá tu API key de Gemini en Planilla)."
          }
        >
          <div className="dn-capture-drop">
            <Camera style={{ width: 42, height: 42, opacity: 0.85 }} aria-hidden="true" />
            <div style={{ maxWidth: 420 }}>
              <strong style={{ display: "block", fontSize: 16 }}>
                Sacá una foto al producto o lote
              </strong>
              <p style={{ fontSize: 12, color: "var(--gd-muted)", marginTop: 4 }}>
                Ideal para voluntarios: no hace falta escribir códigos ni armar planillas a mano.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 6 }}>
              <button
                type="button"
                className="gd-primary"
                style={{ minBlockSize: 52, paddingInline: 24, fontSize: 14 }}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera aria-hidden="true" />
                <span>Sacar foto</span>
              </button>
              <button
                type="button"
                className="gd-secondary"
                style={{ minBlockSize: 52, paddingInline: 20, fontSize: 13 }}
                onClick={() => galleryInputRef.current?.click()}
              >
                <Upload aria-hidden="true" />
                <span>Subir de la galería</span>
              </button>
              <button
                type="button"
                className="gd-secondary"
                style={{ minBlockSize: 52, paddingInline: 18, fontSize: 12.5 }}
                onClick={() => {
                  setAiSource("manual");
                  setStep("form");
                }}
              >
                <span>Cargar sin foto</span>
              </button>
            </div>
          </div>
        </Panel>
      )}

      {step === "tagging" && (
        <Panel title="Procesando foto" subtitle="Preparando vista previa y etiquetas...">
          <div className="dn-capture-drop" style={{ paddingBlock: 42 }}>
            <Loader2
              className="animate-spin"
              style={{ width: 34, height: 34 }}
              aria-hidden="true"
            />
            <strong>Gemini está etiquetando…</strong>
            <span style={{ fontSize: 11.5, color: "var(--gd-muted)" }}>
              Detectando producto, categoría y cantidad aproximada.
            </span>
          </div>
        </Panel>
      )}

      {step === "form" && (
        <Panel
          title="Revisá y guardá la donación"
          subtitle="Podés corregir cualquier campo antes de enviarlo al inventario."
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge status={aiSource === "gemini" ? "Gemini IA" : "Modo manual"} />
              <button type="button" className="gd-secondary" onClick={resetItemForm}>
                Cancelar
              </button>
            </div>
          }
        >
          <form onSubmit={(e) => void handleSave(e)} style={{ display: "grid", gap: 16 }}>
            <div className="dn-grid-2" style={{ alignItems: "start" }}>
              <div style={{ display: "grid", gap: 12 }}>
                {thumb ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 10,
                      borderRadius: 16,
                      border: "1px solid var(--gd-line)",
                      background: "var(--gd-inner)",
                    }}
                  >
                    <img
                      src={thumb.dataUrl}
                      alt="Vista previa de la donación"
                      style={{
                        width: 96,
                        height: 96,
                        objectFit: "cover",
                        borderRadius: 12,
                      }}
                    />
                    <div style={{ display: "grid", gap: 6 }}>
                      <strong style={{ fontSize: 12.5 }}>Foto lista para guardar</strong>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <button
                          type="button"
                          className="gd-secondary"
                          onClick={() => cameraInputRef.current?.click()}
                        >
                          <Camera aria-hidden="true" />
                          <span>Otra foto</span>
                        </button>
                        <button
                          type="button"
                          className="gd-secondary"
                          onClick={() => galleryInputRef.current?.click()}
                        >
                          <ImagePlus aria-hidden="true" />
                          <span>Galería</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: 12,
                      borderRadius: 14,
                      border: "1px dashed var(--gd-line)",
                      background: "var(--gd-inner)",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--gd-muted)" }}>
                      Carga manual sin foto
                    </span>
                    <button
                      type="button"
                      className="gd-secondary"
                      onClick={() => galleryInputRef.current?.click()}
                    >
                      <ImagePlus aria-hidden="true" />
                      <span>Adjuntar foto</span>
                    </button>
                  </div>
                )}

                <div className="dn-field">
                  <label htmlFor="item-name">Producto o descripción *</label>
                  <input
                    id="item-name"
                    type="text"
                    required
                    placeholder="Ej: Pack de fideos x 12, Campera talle M"
                    value={name}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setName(nextName);
                      if (!categoryTouched) {
                        setCategory(inferCategory(nextName) ?? "");
                      }
                    }}
                    className="dn-input"
                  />
                </div>

                <div className="dn-grid-2">
                  <div className="dn-field">
                    <label htmlFor="item-category">Categoría *</label>
                    <select
                      id="item-category"
                      required
                      value={category}
                      onChange={(e) => {
                        setCategoryTouched(true);
                        setCategory((e.target.value as Category | "") || "");
                      }}
                      className="dn-select"
                    >
                      <option value="" disabled>
                        Elegí una categoría...
                      </option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="dn-field">
                    <label htmlFor="item-condition">Estado</label>
                    <select
                      id="item-condition"
                      value={condition}
                      onChange={(e) => setCondition(e.target.value as ItemCondition)}
                      className="dn-select"
                    >
                      {ITEM_CONDITIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="dn-field">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label htmlFor="item-tag-input">Etiquetas (tags para búsqueda central)</label>
                    {name.trim() && (
                      <button
                        type="button"
                        onClick={() => setTags(suggestTags(name, category))}
                        style={{
                          border: 0,
                          background: "transparent",
                          fontSize: 12,
                          fontWeight: 760,
                          color: "var(--gd-teal)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Sparkles style={{ width: 12, height: 12 }} aria-hidden="true" />
                        <span>Sugerir tags</span>
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      id="item-tag-input"
                      type="text"
                      placeholder="Escribí una etiqueta y sumala"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(tagInput);
                        }
                      }}
                      className="dn-input"
                    />
                    <button
                      type="button"
                      className="gd-secondary"
                      onClick={() => addTag(tagInput)}
                    >
                      <Tag aria-hidden="true" />
                      <span>Agregar</span>
                    </button>
                  </div>
                  {tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {tags.map((t) => (
                        <span key={t} className="dn-chip">
                          #{t}
                          <button
                            type="button"
                            aria-label={`Quitar etiqueta ${t}`}
                            onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                            style={{ border: 0, background: "transparent", padding: 0, display: "inline-flex" }}
                          >
                            <X style={{ width: 12, height: 12 }} aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <div className="dn-grid-2">
                  <div className="dn-field">
                    <label htmlFor="item-qty">Cantidad</label>
                    <div className="dn-stepper">
                      <button
                        type="button"
                        aria-label="Restar 1"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      >
                        <Minus style={{ width: 14, height: 14 }} aria-hidden="true" />
                      </button>
                      <input
                        id="item-qty"
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                      />
                      <button
                        type="button"
                        aria-label="Sumar 1"
                        onClick={() => setQuantity((q) => q + 1)}
                      >
                        <Plus style={{ width: 14, height: 14 }} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="dn-field">
                    <label htmlFor="item-unit">Unidad</label>
                    <input
                      id="item-unit"
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="unidades / paquetes / kg"
                      className="dn-input"
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid var(--gd-line)",
                    background: "var(--gd-inner)",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 740, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={perishable}
                      onChange={(e) => setPerishable(e.target.checked)}
                    />
                    <span>Es perecedero / tiene fecha de vencimiento</span>
                  </label>
                  {perishable && (
                    <div className="dn-field">
                      <label htmlFor="item-expires">Vencimiento</label>
                      <input
                        id="item-expires"
                        type="date"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className="dn-input"
                      />
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid var(--gd-line)",
                    background: "var(--gd-inner)",
                  }}
                >
                  <span className="dn-label">¿Quién lo donó?</span>
                  <div className="dn-seg" role="group" aria-label="Tipo de donante">
                    <button
                      type="button"
                      aria-pressed={donorMode === "particular"}
                      onClick={() => setDonorMode("particular")}
                    >
                      Particular
                    </button>
                    <button
                      type="button"
                      aria-pressed={donorMode === "organizacion"}
                      onClick={() => setDonorMode("organizacion")}
                    >
                      Organización / empresa
                    </button>
                  </div>

                  {donorMode === "organizacion" && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <select
                          aria-label="Seleccionar organización donante"
                          value={selectedDonorId}
                          onChange={(e) => setSelectedDonorId(e.target.value)}
                          className="dn-select"
                        >
                          {donors.length === 0 && (
                            <option value="">Sin organizaciones cargadas</option>
                          )}
                          {donors.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.kind})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="gd-secondary"
                          onClick={() => setNewDonorOpen((v) => !v)}
                        >
                          <Plus aria-hidden="true" />
                          <span>Nueva</span>
                        </button>
                      </div>

                      {newDonorOpen && (
                        <div
                          style={{
                            display: "grid",
                            gap: 8,
                            padding: 10,
                            borderRadius: 12,
                            border: "1px solid var(--gd-rim)",
                            background: "var(--gd-card)",
                          }}
                        >
                          <input
                            type="text"
                            placeholder="Nombre empresa u ONG *"
                            value={newDonorName}
                            onChange={(e) => setNewDonorName(e.target.value)}
                            className="dn-input"
                          />
                          <div style={{ display: "flex", gap: 6 }}>
                            <select
                              aria-label="Tipo de organización donante"
                              value={newDonorKind}
                              onChange={(e) => setNewDonorKind(e.target.value as DonorKind)}
                              className="dn-select"
                            >
                              {DONOR_KINDS.map((k) => (
                                <option key={k} value={k}>
                                  {k}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="gd-primary"
                              onClick={handleCreateInlineDonor}
                            >
                              <Check aria-hidden="true" />
                              <span>Crear</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--gd-muted)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={keepDonor}
                      onChange={(e) => setKeepDonor(e.target.checked)}
                    />
                    <span>Seguir cargando del mismo donante</span>
                  </label>
                </div>

                <div className="dn-field">
                  <label htmlFor="item-notes">Observaciones (opcional)</label>
                  <textarea
                    id="item-notes"
                    placeholder="Ej: Caja abierta, talle surtido, prioridad comedor..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="dn-textarea"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="submit"
                disabled={saving}
                className="gd-primary"
                style={{ minBlockSize: 48, paddingInline: 24, fontSize: 13 }}
              >
                <Check aria-hidden="true" />
                <span>{saving ? "Guardando..." : "Guardar donación"}</span>
              </button>
            </div>
          </form>
        </Panel>
      )}
    </div>
  );
}
