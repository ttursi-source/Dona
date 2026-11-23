import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import axe from "axe-core";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/components/ui/FoldText", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@/components/ui/AnimatedContent", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/ChromaGrid", () => ({
  DEFAULT_CHROMA_ITEMS: [{ image: "/placeholder.jpg", title: "Demo", subtitle: "CABA" }],
  default: ({ items }: { items: Array<{ title: string; subtitle?: string; onClick?: () => void }> }) => (
    <div>
      {items.map((item) => (
        <button key={item.title} type="button" onClick={item.onClick}>
          {item.title}
        </button>
      ))}
    </div>
  ),
}));

import { CaptureFlow } from "../src/components/dona/CaptureFlow";
import CreateOrg from "../src/pages/CreateOrg";
import JoinOrg from "../src/pages/JoinOrg";
import OrgChoice from "../src/pages/OrgChoice";
import { getState } from "../src/lib/store";

async function expectNoSeriousA11yViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      // jsdom does not lay out or paint CSS colors; real WCAG AA pairs are verified by check-contrast.mjs
      "color-contrast": { enabled: false },
    },
  });
  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );
  expect(blocking).toEqual([]);
}

describe("axe-core accessibility audits", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("OrgChoice has no critical or serious accessibility violations", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/organizacion"]}>
        <Routes>
          <Route path="/organizacion" element={<OrgChoice />} />
        </Routes>
      </MemoryRouter>
    );
    await expectNoSeriousA11yViolations(container);
  });

  it("JoinOrg has no critical or serious accessibility violations", async () => {
    const firstOrgId = getState().orgs[0]?.id ?? "caritas";
    const { container } = render(
      <MemoryRouter initialEntries={[`/organizacion/${firstOrgId}/unirse`]}>
        <Routes>
          <Route path="/organizacion/:orgId/unirse" element={<JoinOrg />} />
        </Routes>
      </MemoryRouter>
    );
    await expectNoSeriousA11yViolations(container);
  });

  it("CreateOrg has no critical or serious accessibility violations", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/organizacion/crear"]}>
        <Routes>
          <Route path="/organizacion/crear" element={<CreateOrg />} />
        </Routes>
      </MemoryRouter>
    );
    await expectNoSeriousA11yViolations(container);
  });

  it("CaptureFlow has no critical or serious accessibility violations", async () => {
    const state = getState();
    const org = state.orgs[0];
    const sede = state.sedes.find((s) => s.orgId === org.id && !s.isCentral) ?? state.sedes[0];
    const { container } = render(
      <MemoryRouter>
        <CaptureFlow
          orgId={org.id}
          sedeId={sede.id}
          donors={state.donors.filter((d) => d.orgId === org.id)}
        />
      </MemoryRouter>
    );
    await expectNoSeriousA11yViolations(container);
  });
});
