import { useEffect, useState } from "react";
import { ArrowRight, Building2, HeartHandshake, Presentation } from "lucide-react";
import { useNavigate } from "react-router-dom";
import GradientASCII from "@/components/ui/GradientASCII";
import MaskedHeading from "@/components/ui/MaskedHeading";

function supportsWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    return Boolean(gl);
  } catch {
    return false;
  }
}

export default function Landing() {
  const navigate = useNavigate();

  const [webglReady] = useState(() => supportsWebGL2());
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );
  const [lowPower, setLowPower] = useState(() => {
    if (typeof window === "undefined") return false;
    const narrow = window.innerWidth < 768;
    const lowCpu =
      typeof navigator !== "undefined" && (navigator.hardwareConcurrency || 4) <= 4;
    return narrow || lowCpu;
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateViewport = () => {
      const lowCpu = (navigator.hardwareConcurrency || 4) <= 4;
      setLowPower(window.innerWidth < 768 || lowCpu);
    };
    media.addEventListener("change", updateMotion);
    window.addEventListener("resize", updateViewport);
    return () => {
      media.removeEventListener("change", updateMotion);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  const handleDonate = () => {
    window.location.assign(import.meta.env.BASE_URL + "mapa.html");
  };

  const useLiveWebGL = webglReady && !reducedMotion;

  return (
    <main className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-hidden bg-[#090d16] px-6 py-12 text-[#f8fafc] focus:outline-none">
      {useLiveWebGL ? (
        <GradientASCII
          colors={["#1e3fd8", "#f6f8ff", "#a5d8ff", "#38bdf8"]}
          shape="horizon"
          characters=" =+xX0S8#@"
          cellSize={lowPower ? 24 : 18}
          density={lowPower ? 0.6 : 0.8}
          glow={lowPower ? 0 : 0.2}
          dpr={lowPower ? 1 : undefined}
          className="pointer-events-none !absolute inset-0 z-0"
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 85% 42% at 50% 62%, rgba(56, 189, 248, 0.34), rgba(30, 63, 216, 0.22) 45%, rgba(9, 13, 22, 0) 75%), radial-gradient(circle at 50% 48%, rgba(246, 248, 255, 0.16), transparent 55%)",
          }}
        />
      )}

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        <MaskedHeading
          text="doná"
          tag="h1"
          weight={900}
          tracking={-0.04}
          lineHeight={1.05}
          textScale={0.28}
          fillScale={1.25}
          parallax={useLiveWebGL ? 28 : 0}
          drift={useLiveWebGL ? 16 : 0}
          reveal={reducedMotion ? "none" : "scale"}
          trigger="mount"
          spotlight={useLiveWebGL}
          spotlightRadius={180}
          outline
          outlineColor="rgba(248, 250, 252, 0.85)"
          outlineWidth={1.5}
          media={
            useLiveWebGL ? (
              <GradientASCII
                colors={["#1e3fd8", "#f6f8ff", "#a5d8ff", "#38bdf8"]}
                shape="horizon"
                characters=" =+xX0S8#@"
                cellSize={lowPower ? 14 : 10}
                density={0.9}
                glow={lowPower ? 0 : 0.3}
                dpr={lowPower ? 1 : undefined}
                variation={3}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background:
                    "linear-gradient(155deg, #f6f8ff 12%, #a5d8ff 46%, #38bdf8 72%, #1e3fd8 100%)",
                }}
              />
            )
          }
        />

        <div className="mt-10 flex w-full max-w-md flex-col gap-4">
          <button
            type="button"
            onClick={handleDonate}
            className="font-baskerville group relative flex min-h-[56px] w-full items-center justify-center gap-3 rounded-full bg-[#38bdf8] px-7 py-4 text-base font-bold text-[#090d16] shadow-[0_10px_34px_rgba(56,189,248,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#56ccf9] hover:shadow-[0_16px_42px_rgba(56,189,248,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:ring-offset-4 focus-visible:ring-offset-[#090d16] motion-reduce:transition-none motion-reduce:hover:translate-y-0 cursor-pointer"
          >
            <HeartHandshake className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Quiero donar</span>
            <ArrowRight
              className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={() => navigate("/organizacion")}
            className="font-baskerville group relative flex min-h-[56px] w-full items-center justify-center gap-3 rounded-full border border-[#38bdf8]/55 bg-[#090d16]/80 px-7 py-4 text-base font-bold text-[#f8fafc] backdrop-blur-md shadow-[0_8px_28px_rgba(0,0,0,0.45)] transition duration-200 hover:-translate-y-0.5 hover:border-[#38bdf8] hover:bg-[#1e293b]/90 hover:shadow-[0_14px_36px_rgba(56,189,248,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:ring-offset-4 focus-visible:ring-offset-[#090d16] motion-reduce:transition-none motion-reduce:hover:translate-y-0 cursor-pointer"
          >
            <Building2 className="h-5 w-5 shrink-0 text-[#38bdf8]" aria-hidden="true" />
            <span>Soy una organización</span>
            <ArrowRight
              className="h-5 w-5 shrink-0 text-[#38bdf8] transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={() => navigate("/demo")}
            className="font-baskerville group relative flex min-h-[56px] w-full items-center justify-center gap-3 rounded-full border border-[#7dd3fc]/45 bg-[#111827]/75 px-7 py-4 text-base font-bold text-[#f8fafc] backdrop-blur-md shadow-[0_8px_26px_rgba(0,0,0,0.4)] transition duration-200 hover:-translate-y-0.5 hover:border-[#38bdf8] hover:bg-[#1e293b]/90 hover:shadow-[0_14px_34px_rgba(56,189,248,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:ring-offset-4 focus-visible:ring-offset-[#090d16] motion-reduce:transition-none motion-reduce:hover:translate-y-0 cursor-pointer"
          >
            <Presentation className="h-5 w-5 shrink-0 text-[#7dd3fc]" aria-hidden="true" />
            <span>DEMO</span>
            <ArrowRight
              className="h-5 w-5 shrink-0 text-[#7dd3fc] transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <footer className="pointer-events-none absolute bottom-5 z-10 rounded-full bg-[#090d16]/75 px-3 py-1 text-xs font-medium tracking-wide text-[#cbd5e1]">
        Hecho en Argentina
      </footer>
    </main>
  );
}
