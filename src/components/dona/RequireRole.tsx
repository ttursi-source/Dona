import { useEffect, useRef, type ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { hasAccessToCentral, hasAccessToSede, useSession } from "@/lib/session";
import { useDona } from "@/lib/store";

interface RequireRoleProps {
  role: "sede" | "central";
  children: ReactNode;
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const { sedeId, orgId } = useParams<{ sedeId?: string; orgId?: string }>();
  const session = useSession();
  const { orgs, sedes } = useDona();
  const notifiedRef = useRef<string | null>(null);

  const sede = role === "sede" ? sedes.find((s) => s.id === sedeId) : undefined;
  const resolvedOrgId = role === "central" ? orgId ?? "" : sede?.orgId ?? "";

  let authorized = false;
  let redirectTo = "/organizacion";
  let message = "Ingresá el código de acceso para continuar.";

  if (role === "sede") {
    if (sede && sede.active === false) {
      authorized = false;
      redirectTo = `/organizacion/${sede.orgId}/unirse`;
      message = "Esta sede fue dada de baja por Sede Central.";
    } else if (sede && hasAccessToSede(session, sede.orgId, sede.id)) {
      authorized = true;
    } else {
      redirectTo = sede ? `/organizacion/${sede.orgId}/unirse` : "/organizacion";
      message = "Ingresá el código de acceso para entrar a esta sede.";
    }
  } else {
    const orgExists = orgs.some((o) => o.id === resolvedOrgId);
    if (resolvedOrgId && hasAccessToCentral(session, resolvedOrgId)) {
      authorized = true;
    } else {
      redirectTo = orgExists ? `/organizacion/${resolvedOrgId}/unirse` : "/organizacion";
      message = "Ingresá el código de Sede Central para entrar a este panel.";
    }
  }

  useEffect(() => {
    if (!authorized) {
      const sig = `${role}:${orgId ?? ""}:${sedeId ?? ""}`;
      if (notifiedRef.current !== sig) {
        notifiedRef.current = sig;
        toast.info(message);
      }
    } else {
      notifiedRef.current = null;
    }
  }, [authorized, role, orgId, sedeId, message]);

  if (!authorized) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
