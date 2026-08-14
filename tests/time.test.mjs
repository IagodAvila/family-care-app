import assert from "node:assert/strict";
import test from "node:test";

import { currentOccurrenceDate, currentWeekday, scheduledInstant } from "../db/time.ts";

// 2027-01-15 05:00:00 in America/Sao_Paulo (a Friday), computed independently
// via `Intl.DateTimeFormat` — not derived from the functions under test.
const FIXED_NOW = 1_800_000_000_000;

test("currentOccurrenceDate resolve a data local no fuso fixo do app", () => {
  assert.equal(currentOccurrenceDate(FIXED_NOW), "2027-01-15");
});

test("currentWeekday resolve o dia ISO da semana (1=segunda..7=domingo) no fuso fixo do app", () => {
  assert.equal(currentWeekday(FIXED_NOW), 5); // sexta-feira
});

test("scheduledInstant reconstrói o instante a partir de data + horário locais", () => {
  assert.equal(scheduledInstant("2027-01-15", "05:00"), FIXED_NOW);
});

test("scheduledInstant é a inversa de currentOccurrenceDate/formatação de horário para o mesmo instante", () => {
  const roundTrip = scheduledInstant(currentOccurrenceDate(FIXED_NOW), "05:00");
  assert.equal(roundTrip, FIXED_NOW);
});
