import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/components/ui/GradientASCII", () => ({
  default: () => <div data-testid="gradient-ascii-mock" />,
}));

vi.mock("@/components/ui/MaskedHeading", () => ({
  default: ({ text }: { text: string }) => <h1>{text}</h1>,
}));

vi.mock("@/components/ui/FoldText", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@/components/ui/AnimatedContent", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { RequireRole } from "../src/components/dona/RequireRole";
import { signOut } from "../src/lib/session";
import DemoPresentation from "../src/pages/DemoPresentation";
import Landing from "../src/pages/Landing";
import OrgChoice from "../src/pages/OrgChoice";

function mockReducedMotion(enabled: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? enabled : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

async function expectNoSeriousA11yViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      "color-contrast": { enabled: false },
    },
  });
  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );
  expect(blocking).toEqual([]);
}

describe("DEMO competition presentation", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    signOut();
    mockReducedMotion(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows DEMO button beneath Soy una organización on Landing and opens /demo", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/demo" element={<DemoPresentation />} />
        </Routes>
      </MemoryRouter>
    );

    const buttons = screen.getAllByRole("button");
    const orgIndex = buttons.findIndex((b) => b.textContent?.includes("Soy una organización"));
    const demoIndex = buttons.findIndex((b) => b.textContent?.includes("DEMO"));
    expect(orgIndex).toBeGreaterThanOrEqual(0);
    expect(demoIndex).toBe(orgIndex + 1);
    expect(buttons[demoIndex].textContent).not.toMatch(/4\s*min/i);

    fireEvent.click(buttons[demoIndex]);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Cuántas veces tiraste ropa en perfectas condiciones porque ya no la querías\?/i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/doná\s*·\s*Presentación/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Iniciar timer/i })).not.toBeInTheDocument();
  });

  it("advances to Slide 2 without diagnosis badge or bar and reveals 550.000 and 900.000 after 5 seconds", () => {
    vi.useFakeTimers();
    let nowMs = 0;
    const perfSpy = vi.spyOn(performance, "now").mockImplementation(() => nowMs);
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      return window.setTimeout(() => {
        nowMs += 400;
        cb(nowMs);
      }, 16);
    });

    render(
      <MemoryRouter initialEntries={["/demo"]}>
        <DemoPresentation />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Siguiente diapositiva" }));

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Solo un 24% de los argentinos donó alguna vez/i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/El diagnóstico/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/24% donó alguna vez/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Repetir animación/i })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText("550.000")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3600);
    });

    expect(screen.getByText("550.000")).toBeInTheDocument();
    expect(screen.getByText("900.000")).toBeInTheDocument();
    expect(
      screen.getByText(/toneladas de residuos textiles por año en la Argentina/i)
    ).toBeInTheDocument();

    rafSpy.mockRestore();
    perfSpy.mockRestore();
    vi.useRealTimers();
  });

  it("navigates all 11 slides via left dot rail, large bottom arrows, and keyboard", () => {
    mockReducedMotion(true);
    render(
      <MemoryRouter initialEntries={["/demo"]}>
        <DemoPresentation />
      </MemoryRouter>
    );

    const nextBtn = screen.getByRole("button", { name: "Siguiente diapositiva" });
    const prevBtn = screen.getByRole("button", { name: "Diapositiva anterior" });

    // Jump to Slide 3 (Mission — Bebés removed)
    fireEvent.click(screen.getByRole("button", { name: "Ir a diapositiva 3: Nuestra misión" }));
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Nosotros queremos fomentar las donaciones en general/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Ropa y calzado")).toBeInTheDocument();
    expect(screen.queryByText("Bebés")).not.toBeInTheDocument();

    // Jump to Slide 4 (Triangle: ONGs, Marcas, Clientes, Cupones)
    fireEvent.click(screen.getByRole("button", { name: "Ir a diapositiva 4: ¿Cómo lo haríamos?" }));
    expect(screen.getByRole("button", { name: /^ONGs\b/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Marcas\b/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Clientes\b/i })).toBeInTheDocument();
    expect(screen.getByText(/^Cupones$/i)).toBeInTheDocument();
    expect(screen.queryByText(/Cupones y clientes/i)).not.toBeInTheDocument();

    // Keyboard forward -> Slide 5 (Live map iframe)
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const mapFrame = screen.getByTitle(
      /Mapa interactivo de las 331 organizaciones receptoras de donaciones en CABA/i
    );
    expect(mapFrame.getAttribute("src")).toMatch(/mapa\.html$/);

    // Jump to Slide 6 (ONG problem)
    fireEvent.click(screen.getByRole("button", { name: "Ir a diapositiva 6: El problema" }));
    expect(
      screen.getByRole("heading", { level: 1, name: /Pero tuvimos un problema/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Las ONGs tenían otra necesidad si queríamos aumentar el flujo de donaciones/i)
    ).toBeInTheDocument();

    // Advance via large bottom arrow -> Slide 7 (Tool for orgs)
    fireEvent.click(nextBtn);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /La herramienta que creamos si sos una organización/i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Solución B2O/i)).not.toBeInTheDocument();

    // Advance -> Slide 8 (Live org panel + Modo Demo)
    fireEvent.click(nextBtn);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Probalo en vivo: Panel para Organizaciones/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ir al Panel de Organizaciones/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Modo Demo · Sede Central/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Modo Demo · Sedes Afiliadas/i })
    ).toBeInTheDocument();

    // Advance -> Slide 9 (Modelo de negocio)
    fireEvent.click(nextBtn);
    expect(
      screen.getByRole("heading", { level: 1, name: /^Modelo de negocio$/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Más exposición para las marcas/i)).toBeInTheDocument();
    expect(screen.getByText(/3 dólares por cada cliente/i)).toBeInTheDocument();
    expect(screen.getAllByText(/US\$\s*3/).length).toBeGreaterThanOrEqual(1);

    // Advance -> Slide 10 (Penultimate: Roadmap with 10k / 30k / 50k scenarios)
    fireEvent.click(nextBtn);
    expect(screen.getByRole("heading", { level: 1, name: /^Roadmap$/i })).toBeInTheDocument();
    expect(screen.queryByText(/Próximos 12 meses/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Si donan 10\.000 personas/i)).toBeInTheDocument();
    expect(screen.getByText(/Si donan 30\.000 personas/i)).toBeInTheDocument();
    expect(screen.getByText(/Si donan 50\.000 personas/i)).toBeInTheDocument();
    expect(screen.getByText(/US\$\s*30\.000/i)).toBeInTheDocument();
    expect(screen.getByText(/US\$\s*90\.000/i)).toBeInTheDocument();
    expect(screen.getByText(/US\$\s*150\.000/i)).toBeInTheDocument();

    // Advance -> Slide 11 (Final: Muchas gracias)
    fireEvent.click(nextBtn);
    expect(screen.getByRole("heading", { level: 1, name: /^Muchas gracias$/i })).toBeInTheDocument();
    expect(screen.queryByText(/doná\s*·\s*Argentina/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Tomás Tursi/i)).toBeInTheDocument();
    expect(screen.getByText(/tursitomas@gmail\.com/i)).toBeInTheDocument();

    // Previous arrow -> back to Roadmap (Slide 10)
    fireEvent.click(prevBtn);
    expect(screen.getByRole("heading", { level: 1, name: /^Roadmap$/i })).toBeInTheDocument();

    // Keyboard backward -> Slide 9 (Modelo de negocio)
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(
      screen.getByRole("heading", { level: 1, name: /^Modelo de negocio$/i })
    ).toBeInTheDocument();
  });

  it("lets OrgChoice open Modo Demo as Sede Central or Sede Afiliada past RequireRole", async () => {
    render(
      <MemoryRouter initialEntries={["/organizacion?from=demo"]}>
        <Routes>
          <Route path="/organizacion" element={<OrgChoice />} />
          <Route path="/demo" element={<DemoPresentation />} />
          <Route
            path="/central/:orgId"
            element={
              <RequireRole role="central">
                <div data-testid="central-unlocked">Central BI</div>
              </RequireRole>
            }
          />
          <Route
            path="/sede/:sedeId"
            element={
              <RequireRole role="sede">
                <div data-testid="sede-unlocked">Sede Workspace</div>
              </RequireRole>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", { name: /Volver a la presentación/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ver como Sede Central/i }));
    await waitFor(() => {
      expect(screen.getByTestId("central-unlocked")).toBeInTheDocument();
    });

    cleanup();
    signOut();

    render(
      <MemoryRouter initialEntries={["/organizacion"]}>
        <Routes>
          <Route path="/organizacion" element={<OrgChoice />} />
          <Route
            path="/sede/:sedeId"
            element={
              <RequireRole role="sede">
                <div data-testid="sede-unlocked">Sede Workspace</div>
              </RequireRole>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Entrar como Sede Afiliada/i }));
    await waitFor(() => {
      expect(screen.getByTestId("sede-unlocked")).toBeInTheDocument();
    });
  });

  it("has zero critical or serious axe-core accessibility violations across key slides", async () => {
    mockReducedMotion(true);
    const { container } = render(
      <MemoryRouter initialEntries={["/demo"]}>
        <DemoPresentation />
      </MemoryRouter>
    );

    // Slide 1
    await expectNoSeriousA11yViolations(container);

    // Slide 4 (Triangle)
    fireEvent.click(screen.getByRole("button", { name: "Ir a diapositiva 4: ¿Cómo lo haríamos?" }));
    await expectNoSeriousA11yViolations(container);

    // Slide 8 (Live Panel)
    fireEvent.click(screen.getByRole("button", { name: "Ir a diapositiva 8: Panel en vivo" }));
    await expectNoSeriousA11yViolations(container);

    // Slide 9 (Modelo de negocio)
    fireEvent.click(screen.getByRole("button", { name: "Ir a diapositiva 9: Modelo de negocio" }));
    await expectNoSeriousA11yViolations(container);

    // Slide 10 (Roadmap)
    fireEvent.click(screen.getByRole("button", { name: "Ir a diapositiva 10: Roadmap" }));
    await expectNoSeriousA11yViolations(container);
  }, 15000);
});
