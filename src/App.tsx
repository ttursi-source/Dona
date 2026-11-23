import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { RequireRole } from "./components/dona/RequireRole";
import { captureEndpointFromUrl } from "./lib/config";
import { initSyncLifecycle } from "./lib/sync";
import Landing from "./pages/Landing";
import OrgChoice from "./pages/OrgChoice";

const CreateOrg = lazy(() => import("./pages/CreateOrg"));
const JoinOrg = lazy(() => import("./pages/JoinOrg"));
const SedeWorkspace = lazy(() => import("./pages/SedeWorkspace"));
const CentralWorkspace = lazy(() => import("./pages/CentralWorkspace"));
const DemoPresentation = lazy(() => import("./pages/DemoPresentation"));

function RouteFocus() {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const raf = requestAnimationFrame(() => {
      const target =
        document.querySelector<HTMLElement>("main") ||
        document.querySelector<HTMLElement>("h1");
      if (target) {
        if (!target.hasAttribute("tabindex")) {
          target.setAttribute("tabindex", "-1");
        }
        target.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}

function RouteFallback() {
  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-[#090d16] text-[#f8fafc]">
      <div className="flex items-center gap-3 text-sm text-[#cbd5e1]">
        <Loader2 className="h-5 w-5 animate-spin text-[#38bdf8]" aria-hidden="true" />
        <span>Cargando panel...</span>
      </div>
    </main>
  );
}

export default function App() {
  useState(() => captureEndpointFromUrl());

  useEffect(() => {
    return initSyncLifecycle();
  }, []);

  return (
    <HashRouter>
      <RouteFocus />
      <Toaster richColors position="top-center" />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/organizacion" element={<OrgChoice />} />
          <Route path="/organizacion/crear" element={<CreateOrg />} />
          <Route path="/organizacion/:orgId/unirse" element={<JoinOrg />} />
          <Route
            path="/sede/:sedeId"
            element={
              <RequireRole role="sede">
                <SedeWorkspace />
              </RequireRole>
            }
          />
          <Route
            path="/central/:orgId"
            element={
              <RequireRole role="central">
                <CentralWorkspace />
              </RequireRole>
            }
          />
          <Route path="/demo" element={<DemoPresentation />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
