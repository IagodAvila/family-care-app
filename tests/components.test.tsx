// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Home from "@/app/page";
import { Modal } from "@/app/components/modal";
import type { Relative } from "@/types/family";
import { createFakeFamilyBackend } from "./helpers/fake-family-backend";

// Real photo processing needs canvas/createImageBitmap, unavailable in jsdom
// — the UI's job here is just to call it and thread the result through, so
// a stub covers that without pulling in canvas support just for tests.
const FAKE_PHOTO_DATA_URL = "data:image/jpeg;base64,ZmFrZS1waG90bw==";
vi.mock("@/lib/photo", () => ({
  MAX_PHOTO_FILE_SIZE: 12 * 1024 * 1024,
  resizePhotoToDataUrl: vi.fn(async () => FAKE_PHOTO_DATA_URL),
}));

const LEGACY_STORAGE_KEY = "familycare-family";

function ModalHarness() {
  const [open, setOpen] = useState(false);

  return (
    <main className="app">
      <button type="button" onClick={() => setOpen(true)}>Abrir modal</button>
      {open && (
        <Modal
          titleId="test-modal-title"
          initialFocusSelector='input[name="first"]'
          onClose={() => setOpen(false)}
        >
          <h2 id="test-modal-title">Modal de teste</h2>
          <input name="first" aria-label="Primeiro campo" />
          <button type="button" onClick={() => setOpen(false)}>Fechar modal</button>
        </Modal>
      )}
    </main>
  );
}

async function openRelativeForm(user: ReturnType<typeof userEvent.setup>) {
  const buttons = await screen.findAllByRole("button", { name: "Adicionar familiar" });
  await user.click(buttons[0]);
  return screen.getByRole("dialog", { name: "Adicionar familiar" });
}

async function fillRequiredRelativeFields(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  values: { name: string; relation: string; birthDate: string; bloodType: string },
) {
  await user.type(within(dialog).getByLabelText("Nome completo"), values.name);
  await user.type(within(dialog).getByLabelText("Parentesco"), values.relation);
  await user.type(within(dialog).getByLabelText("Data de nascimento"), values.birthDate);
  await user.selectOptions(
    within(dialog).getByLabelText("Tipo sanguíneo"),
    values.bloodType,
  );
}

function storedRelative(overrides: Partial<Relative>): Relative {
  return {
    id: overrides.id ?? "relative-1",
    name: "Ana Souza",
    relation: "Mãe",
    birthDate: "1970-05-10",
    bloodType: "O+",
    conditions: [],
    allergies: [],
    medications: [],
    notes: "",
    color: "#277f7b",
    photoUrl: null,
    ...overrides,
  };
}

/**
 * Renders `<Home />` against an in-memory fake of the `/api/**` routes
 * (see helpers/fake-family-backend.ts) instead of `localStorage` — data now
 * lives on the server, so every test needs *something* answering `fetch`.
 * Waits for the authenticated shell to mount before handing control back,
 * since that first render is always the "Carregando…" state.
 */
async function renderApp(seedRelatives: readonly Relative[] = []) {
  const backend = createFakeFamilyBackend(seedRelatives);
  vi.stubGlobal("fetch", backend.fetch);
  render(<Home />);
  await screen.findByLabelText("Navegação principal");
  return backend;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Modal", () => {
  test("abre, aplica foco inicial, fecha com Escape e restaura o foco", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const opener = screen.getByRole("button", { name: "Abrir modal" });

    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Modal de teste" });
    expect(dialog).toBeTruthy();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("textbox", { name: "Primeiro campo" }),
      );
    });

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Modal de teste" })).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  test("fecha pelo controle visível do modal", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    await user.click(screen.getByRole("button", { name: "Abrir modal" }));
    await user.click(screen.getByRole("button", { name: "Fechar modal" }));

    expect(screen.queryByRole("dialog", { name: "Modal de teste" })).toBeNull();
  });
});

describe("fluxos críticos do FamilyCare", () => {
  test("valida a data e cadastra familiar com múltiplos medicamentos", async () => {
    const user = userEvent.setup();
    const backend = await renderApp([]);
    const dialog = await openRelativeForm(user);

    await fillRequiredRelativeFields(user, dialog, {
      name: "Ana Souza",
      relation: "Mãe",
      birthDate: "31022020",
      bloodType: "O+",
    });
    await user.click(within(dialog).getByRole("button", { name: "Salvar familiar" }));

    expect(within(dialog).getByRole("alert").textContent).toMatch(
      /data de nascimento válida/i,
    );

    const birthDate = within(dialog).getByPlaceholderText("DD/MM/AAAA");
    await user.clear(birthDate);
    await user.type(birthDate, "10051970");

    const medicationName = within(dialog).getByLabelText("Nome", { exact: true });
    const dosage = within(dialog).getByLabelText("Dosagem ou apresentação");
    const orientation = within(dialog).getByLabelText("Orientação de uso");
    const addMedication = within(dialog).getByRole("button", {
      name: "Adicionar medicamento",
    });

    await user.type(medicationName, "Losartana");
    await user.type(dosage, "50 mg");
    await user.type(orientation, "Pela manhã");
    await user.click(addMedication);
    await user.type(medicationName, "Vitamina D");
    await user.type(dosage, "1 dose");
    await user.type(orientation, "Semanal");
    await user.click(addMedication);

    expect(within(dialog).getByRole("list", { name: "Medicamentos adicionados" })
      .querySelectorAll("li")).toHaveLength(2);

    await user.click(within(dialog).getByRole("button", { name: "Salvar familiar" }));

    expect(await screen.findByRole("heading", { name: "Ana Souza", level: 2 })).toBeTruthy();
    expect(screen.getByText("Losartana")).toBeTruthy();
    expect(screen.getByText("Vitamina D")).toBeTruthy();
    await waitFor(() => {
      expect(backend.getRelatives()).toHaveLength(1);
      expect(backend.getRelatives()[0].medications).toHaveLength(2);
    });
  });

  test("não duplica o familiar se salvar for clicado de novo enquanto o pedido anterior ainda está em curso", async () => {
    const user = userEvent.setup();
    const backend = await renderApp([]);
    const dialog = await openRelativeForm(user);

    await fillRequiredRelativeFields(user, dialog, {
      name: "Carlos Lima",
      relation: "Pai",
      birthDate: "10051970",
      bloodType: "O+",
    });

    // Simulate a slow request: the create call takes a moment to resolve,
    // long enough for an impatient second click to land while the button
    // should already be disabled (see `submitting` in RelativeForm).
    const realFetch = backend.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = input instanceof Request ? input.method : init?.method;
      const url = input instanceof Request ? input.url : String(input);
      if (method === "POST" && url.includes("/relatives")) {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      return realFetch(input, init);
    });

    const saveButton = within(dialog).getByRole("button", { name: "Salvar familiar" });
    fireEvent.click(saveButton);
    // The button disables and relabels itself synchronously, before the
    // request even resolves — so this second click lands on a disabled
    // button and should have no effect at all.
    fireEvent.click(saveButton);

    expect(within(dialog).getByRole("button", { name: "Salvando…" })).toBeTruthy();

    expect(await screen.findByRole("heading", { name: "Carlos Lima", level: 2 })).toBeTruthy();
    await waitFor(() => expect(backend.getRelatives()).toHaveLength(1));
  });

  test("preenchimento assistido aplica comorbidades, alergias e medicamentos sugeridos", async () => {
    const user = userEvent.setup();
    const backend = await renderApp([]);
    const dialog = await openRelativeForm(user);

    const realFetch = backend.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/api/assist/relative-fields")) {
        return new Response(
          JSON.stringify({
            conditions: ["Hipertensão"],
            allergies: ["Não possui"],
            medications: [{ name: "Losartana", dosage: "50mg", orientation: "à noite" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return realFetch(input, init);
    });

    const textarea = within(dialog).getByPlaceholderText(/pressão alta/);
    await user.type(textarea, "Ela tem pressão alta e toma losartana 50mg à noite, sem alergias.");
    await user.click(within(dialog).getByRole("button", { name: "Sugerir preenchimento com IA" }));

    expect(await within(dialog).findByText(/Sugestões aplicadas/)).toBeTruthy();
    expect(within(dialog).getByText("Losartana")).toBeTruthy();

    const conditionsInput = within(dialog).getByLabelText("Comorbidades, separadas por vírgula") as HTMLInputElement;
    expect(conditionsInput.value).toBe("Hipertensão");

    // Allergies came back as the "none" sentinel — that toggle switches to
    // "Não possui" mode, which has no visible text input to read a value
    // from; the "Não possui" button itself becomes the active one.
    const allergiesToggle = within(dialog).getByRole("group", { name: /Status: Alergias/ });
    expect(within(allergiesToggle).getByRole("button", { name: "Não possui" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("oferece importar dados salvos de uma versão anterior, troca familiar e ativa o modo emergência", async () => {
    const legacyFamily = [
      storedRelative({
        medications: [{
          name: "Vitamina D",
          dosage: "1 dose",
          schedule: "Semanal",
        }],
      }),
      storedRelative({
        id: "relative-2",
        name: "Bruno Souza",
        relation: "Pai",
        birthDate: "1968-02-20",
        bloodType: "A+",
        color: "#8a6fbc",
      }),
    ];
    window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyFamily));
    const user = userEvent.setup();
    // The server family starts empty — that's what makes the import offer show up.
    const backend = await renderApp([]);

    const importDialog = await screen.findByRole("dialog", {
      name: "Importar dados salvos neste navegador?",
    });
    await user.click(within(importDialog).getByRole("button", { name: "Importar" }));

    expect(await screen.findByRole("heading", { name: "Ana Souza", level: 2 })).toBeTruthy();
    expect(screen.getByText("Semanal")).toBeTruthy();
    await waitFor(() => expect(backend.getRelatives()).toHaveLength(2));
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();

    await user.click(screen.getByRole("button", { name: /Bruno Souza/ }));
    expect(screen.getByRole("heading", { name: "Bruno Souza", level: 2 })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Modo emergência" }));
    expect(document.querySelector("main")?.className).toContain("emergency-active");

    const emergencySwitcher = screen.getByRole("combobox", {
      name: "Selecionar familiar no modo emergência",
    });
    const anaOption = within(emergencySwitcher).getByText(/Ana Souza/);
    await user.selectOptions(emergencySwitcher, anaOption);

    expect(screen.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeTruthy();
    expect(screen.getByText("Medicamentos em uso")).toBeTruthy();
  });

  test("alterna entre tema claro e escuro ao clicar no botão sol/lua", async () => {
    const user = userEvent.setup();
    await renderApp([]);

    const toggle = await screen.findByRole("button", { name: "Alternar entre tema claro e escuro" });

    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("familycare-theme")).toBe("dark");

    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("familycare-theme")).toBe("light");
  });

  test("exclui familiar somente após confirmar no diálogo em duas etapas", async () => {
    const backend = await renderApp([storedRelative({})]);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Ana Souza", level: 2 });
    await user.click(screen.getByRole("button", { name: "Mais opções para este familiar" }));
    await user.click(screen.getByRole("button", { name: "Excluir familiar" }));

    const confirmDialog = screen.getByRole("dialog", { name: "Excluir Ana Souza?" });
    expect(within(confirmDialog).getByText(/incluindo medicamentos/i)).toBeTruthy();

    await user.click(within(confirmDialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Mais opções para este familiar" }));
    await user.click(screen.getByRole("button", { name: "Excluir familiar" }));
    await user.click(screen.getByRole("button", { name: "Excluir familiar" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Ana Souza", level: 2 })).toBeNull();
    });
    await waitFor(() => {
      expect(backend.getRelatives()).toHaveLength(0);
    });
  });

  test("remove medicamento somente após confirmar no diálogo", async () => {
    await renderApp([storedRelative({
      medications: [{ name: "Losartana", dosage: "50 mg", orientation: "Pela manhã" }],
    })]);
    const user = userEvent.setup();

    await screen.findByText("Losartana");
    await user.click(screen.getByRole("button", { name: "Remover Losartana" }));

    const confirmDialog = screen.getByRole("dialog", { name: "Remover Losartana?" });
    await user.click(within(confirmDialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Losartana")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Remover Losartana" }));
    await user.click(screen.getByRole("button", { name: "Remover medicamento" }));

    await waitFor(() => {
      expect(screen.queryByText("Losartana")).toBeNull();
    });
  });

  test("cadastra um horário para um medicamento e remove em seguida", async () => {
    await renderApp([storedRelative({
      medications: [{ name: "Losartana", dosage: "50 mg" }],
    })]);
    const user = userEvent.setup();

    await screen.findByText("Losartana");
    await user.click(await screen.findByRole("button", { name: "Mostrar horários" }));
    await user.click(await screen.findByRole("button", { name: "Adicionar horário" }));

    expect(await screen.findByText("08:00")).toBeTruthy();
    expect(screen.getByText("Todos os dias")).toBeTruthy();
    expect(screen.getByText("1x")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Remover horário das 08:00" }));
    expect(await screen.findByText("Nenhum horário cadastrado.")).toBeTruthy();
  });

  test("mostra os horários definidos mesmo com o painel de horários fechado", async () => {
    await renderApp([storedRelative({
      medications: [{ name: "Losartana", dosage: "50 mg" }],
    })]);
    const user = userEvent.setup();

    await screen.findByText("Losartana");
    await user.click(await screen.findByRole("button", { name: "Mostrar horários" }));
    await user.click(await screen.findByRole("button", { name: "Adicionar horário" }));
    expect(await screen.findByText("08:00")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Ocultar horários" })); // fecha o painel
    expect(screen.queryByText("Todos os dias")).toBeNull(); // detalhe do painel some
    expect(screen.getByText("08:00")).toBeTruthy(); // resumo continua visível
  });

  test("cadastra um tratamento com duração definida e mostra a data de término calculada", async () => {
    await renderApp([storedRelative({
      medications: [{ name: "Amoxicilina", dosage: "500 mg" }],
    })]);
    const user = userEvent.setup();

    await screen.findByText("Amoxicilina");
    await user.click(await screen.findByRole("button", { name: "Mostrar horários" }));
    await user.click(screen.getByRole("button", { name: "Definir duração do tratamento" }));

    fireEvent.change(
      screen.getByLabelText("Início do tratamento com Amoxicilina"),
      { target: { value: "2027-01-15" } },
    );
    const durationInput = screen.getByLabelText("Duração do tratamento, em dias");
    await user.clear(durationInput);
    await user.type(durationInput, "10");

    expect(await screen.findByText("Termina em 24/01/2027")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Adicionar horário" }));

    expect(await screen.findByText("15/01/2027 – 24/01/2027")).toBeTruthy();
  });

  test("marca uma dose de hoje como tomada", async () => {
    const relative = storedRelative({
      medications: [{ name: "Enalapril", dosage: "20 mg" }],
    });
    const backend = createFakeFamilyBackend([relative]);
    // Seeds a dose schedule directly on the fake's stored medication object
    // (mutating it in place, same object `getRelatives()` returns) — the
    // "Hoje" section only shows occurrences from an existing schedule,
    // and creating one through the UI first would be redundant with the
    // "cadastra um horário" test above.
    backend.getRelatives()[0].medications[0].doseSchedules.push({
      id: "schedule-seed-1",
      version: 1,
      timeOfDay: "08:00",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      quantity: 1,
      startDate: null,
      durationDays: null,
      endDate: null,
    });
    vi.stubGlobal("fetch", backend.fetch);
    render(<Home />);
    await screen.findByLabelText("Navegação principal");
    const user = userEvent.setup();

    expect(await screen.findByText("Hoje")).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: "Marcar como tomado" }));

    expect(await screen.findByText("Tomado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Marcar como tomado" })).toBeNull();
  });

  test("edita familiar e substitui a lista de medicamentos existente", async () => {
    const backend = await renderApp([storedRelative({
      medications: [{ name: "Losartana", dosage: "50 mg", orientation: "Pela manhã" }],
    })]);
    const user = userEvent.setup();

    await screen.findByText("Losartana");
    await user.click(screen.getByRole("button", { name: "Editar familiar" }));

    const dialog = screen.getByRole("dialog", { name: "Editar familiar" });
    expect(within(dialog).getByText("Losartana")).toBeTruthy();

    await user.click(within(dialog).getByRole("button", { name: "Remover Losartana" }));
    await user.type(within(dialog).getByLabelText("Nome", { exact: true }), "Vitamina D");
    await user.type(within(dialog).getByLabelText("Dosagem ou apresentação"), "1 dose");
    await user.click(within(dialog).getByRole("button", { name: "Adicionar medicamento" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("Vitamina D")).toBeTruthy();
    expect(screen.queryByText("Losartana")).toBeNull();
    await waitFor(() => {
      expect(backend.getRelatives()[0].medications).toHaveLength(1);
      expect(backend.getRelatives()[0].medications[0]).toMatchObject({
        name: "Vitamina D",
        dosage: "1 dose",
        orientation: "",
      });
    });
  });

  test("adiciona, pré-visualiza e remove a foto de um familiar", async () => {
    const user = userEvent.setup();
    const backend = await renderApp([]);
    const dialog = await openRelativeForm(user);

    await fillRequiredRelativeFields(user, dialog, {
      name: "Beatriz Lima",
      relation: "Irmã",
      birthDate: "15031988",
      bloodType: "B+",
    });

    const photoInput = within(dialog).getByLabelText("Adicionar foto");
    await user.upload(photoInput, new File(["conteúdo-fake"], "foto.jpg", { type: "image/jpeg" }));

    // Label switches once a photo is staged, and a way to undo it appears.
    expect(await within(dialog).findByLabelText("Trocar foto")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Remover foto" })).toBeTruthy();

    await user.click(within(dialog).getByRole("button", { name: "Salvar familiar" }));
    expect(await screen.findByRole("heading", { name: "Beatriz Lima", level: 2 })).toBeTruthy();
    await waitFor(() => {
      expect(backend.getRelatives()[0].photoUrl).toBe(FAKE_PHOTO_DATA_URL);
    });

    // Editing back in, removing the photo clears it on save.
    await user.click(screen.getByRole("button", { name: "Editar familiar" }));
    const editDialog = screen.getByRole("dialog", { name: "Editar familiar" });
    await user.click(within(editDialog).getByRole("button", { name: "Remover foto" }));
    await user.click(within(editDialog).getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(backend.getRelatives()[0].photoUrl).toBeNull();
    });
  });
});

describe("Membros e convites", () => {
  test("convida alguém pela família e mostra o link gerado", async () => {
    const user = userEvent.setup();
    const backend = await renderApp([]);

    await user.click(screen.getByRole("button", { name: "Membros" }));
    const panel = await screen.findByRole("dialog", { name: "Membros" });
    expect(within(panel).getByText("ana@example.com")).toBeTruthy();

    await user.click(within(panel).getByRole("button", { name: "Convidar" }));
    const inviteView = await screen.findByRole("dialog", { name: "Convidar para a família" });

    await user.type(within(inviteView).getByLabelText("E-mail da pessoa convidada"), "convidado@example.com");
    await user.selectOptions(
      within(inviteView).getByLabelText("Papel"),
      "Somente leitura — só pode consultar",
    );
    await user.click(within(inviteView).getByRole("button", { name: "Gerar convite" }));

    const link = await within(inviteView).findByLabelText("Link de convite");
    expect((link as HTMLInputElement).value).toMatch(/\/convite\//);

    await waitFor(() => {
      const invitations = backend.getInvitations();
      expect(invitations).toHaveLength(1);
      expect(invitations[0]).toMatchObject({ emailNormalized: "convidado@example.com", role: "viewer" });
    });
  });
});
