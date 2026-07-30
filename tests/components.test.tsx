// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import Home from "@/app/page";
import { Modal } from "@/app/components/modal";
import type { Relative } from "@/types/family";

const STORAGE_KEY = "familycare-family";

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
  const buttons = screen.getAllByRole("button", { name: "Adicionar familiar" });
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
    id: "relative-1",
    name: "Ana Souza",
    relation: "Mãe",
    birthDate: "1970-05-10",
    bloodType: "O+",
    conditions: [],
    allergies: [],
    medications: [],
    notes: "",
    color: "#277f7b",
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
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
    render(<Home />);
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

    expect(screen.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeTruthy();
    expect(screen.getByText("Losartana")).toBeTruthy();
    expect(screen.getByText("Vitamina D")).toBeTruthy();
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0].medications).toHaveLength(2);
    });
  });

  test("restaura localStorage antigo, troca familiar e ativa o modo emergência", async () => {
    const storedFamily = [
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedFamily));
    const user = userEvent.setup();

    render(<Home />);

    expect(await screen.findByRole("heading", { name: "Ana Souza", level: 2 }))
      .toBeTruthy();
    expect(screen.getByText("Semanal")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Bruno Souza/ }));
    expect(screen.getByRole("heading", { name: "Bruno Souza", level: 2 })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Ativar modo emergência" }));
    expect(document.querySelector("main")?.className).toContain("emergency-active");

    const emergencySwitcher = screen.getByRole("combobox", {
      name: "Selecionar familiar no modo emergência",
    });
    await user.selectOptions(emergencySwitcher, "relative-1");

    expect(screen.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeTruthy();
    expect(screen.getByText("Medicamentos em uso")).toBeTruthy();
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      expect(stored[0].medications[0].orientation).toBe("Semanal");
      expect(stored[0].medications[0].schedule).toBe("Semanal");
    });
  });
});
