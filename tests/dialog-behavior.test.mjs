import assert from "node:assert/strict";
import test from "node:test";

import { getFocusableElements, isDirectBackdropClick, lockDocumentScroll, trapDialogFocus } from "../app/dialog-behavior.mjs";
import { familyFixture } from "./fixtures/family.mjs";

function focusable(name) {
  return {
    name,
    focused: false,
    focus() { this.focused = true; },
    getAttribute() { return null; },
    hasAttribute() { return false; },
  };
}

function keyboardEvent({ shiftKey = false } = {}) {
  return {
    key: "Tab",
    shiftKey,
    prevented: false,
    preventDefault() { this.prevented = true; },
  };
}

test("contém Tab e Shift+Tab entre o primeiro e o último controle do diálogo", () => {
  const first = focusable("primeiro");
  const middle = focusable("meio");
  const last = focusable("último");
  const container = {
    ownerDocument: { activeElement: last },
    querySelectorAll() { return [first, middle, last]; },
    focus() {},
  };

  const tab = keyboardEvent();
  assert.equal(trapDialogFocus(tab, container), true);
  assert.equal(tab.prevented, true);
  assert.equal(first.focused, true);

  container.ownerDocument.activeElement = first;
  const shiftTab = keyboardEvent({ shiftKey: true });
  assert.equal(trapDialogFocus(shiftTab, container), true);
  assert.equal(shiftTab.prevented, true);
  assert.equal(last.focused, true);
});

test("ignora elementos ocultos na ordem de foco", () => {
  const visible = focusable("visível");
  const hidden = { ...focusable("oculto"), getAttribute(name) { return name === "aria-hidden" ? "true" : null; } };
  const container = { querySelectorAll() { return [visible, hidden]; } };
  assert.deepEqual(getFocusableElements(container), [visible]);
});

test("bloqueia e restaura a rolagem sem perder o valor anterior", () => {
  const documentObject = { body: { style: { overflow: "clip" } } };
  const restore = lockDocumentScroll(documentObject);
  assert.equal(documentObject.body.style.overflow, "hidden");
  restore();
  assert.equal(documentObject.body.style.overflow, "clip");
});

test("diferencia clique no backdrop de clique dentro do diálogo", () => {
  const backdrop = {};
  assert.equal(isDirectBackdropClick({ target: backdrop, currentTarget: backdrop }), true);
  assert.equal(isDirectBackdropClick({ target: {}, currentTarget: backdrop }), false);
});

test("fixture isolada cobre oito familiares, nomes longos e seis medicamentos", () => {
  assert.equal(familyFixture.length, 8);
  assert.ok(familyFixture.some((person) => person.name.length > 30));
  assert.ok(familyFixture.some((person) => person.conditions.length > 1));
  assert.ok(familyFixture.some((person) => person.allergies.length > 1));
  assert.ok(familyFixture.some((person) => person.medications.length === 0));
  assert.ok(familyFixture.some((person) => person.medications.length === 1));
  assert.ok(familyFixture.some((person) => person.medications.length >= 6));
  assert.ok(familyFixture.flatMap((person) => person.medications).some((medication) => medication.orientation.length > 80));
});
