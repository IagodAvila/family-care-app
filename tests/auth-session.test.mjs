import assert from "node:assert/strict";
import test from "node:test";

import { signValue, verifyValue } from "../lib/auth/signed-cookie.ts";
import {
  buildSessionSetCookie,
  createSessionCookieValue,
  readSessionFromRequest,
  SESSION_COOKIE_NAME,
} from "../lib/auth/session.ts";

const SECRET = "test-secret-do-not-use-in-production";

function requestWithCookie(name, value) {
  return new Request("https://example.com/", {
    headers: { Cookie: `${name}=${encodeURIComponent(value)}` },
  });
}

test("signValue/verifyValue: aceita um token válido e recupera o payload original", async () => {
  const token = await signValue({ userId: "user-1" }, SECRET, 60_000);
  const payload = await verifyValue(token, SECRET);
  assert.deepEqual(payload, { userId: "user-1" });
});

test("signValue/verifyValue: rejeita token expirado", async () => {
  const token = await signValue({ userId: "user-1" }, SECRET, -1);
  assert.equal(await verifyValue(token, SECRET), null);
});

test("signValue/verifyValue: rejeita token assinado com outro segredo (adulteração)", async () => {
  const token = await signValue({ userId: "user-1" }, SECRET, 60_000);
  assert.equal(await verifyValue(token, "outro-segredo"), null);
});

test("signValue/verifyValue: rejeita token malformado", async () => {
  assert.equal(await verifyValue("não-é-um-token-assinado", SECRET), null);
  assert.equal(await verifyValue("", SECRET), null);
});

test("readSessionFromRequest: recupera o userId de um cookie de sessão válido", async () => {
  const cookieValue = await createSessionCookieValue("user-42", SECRET);
  const request = requestWithCookie(SESSION_COOKIE_NAME, cookieValue);
  assert.deepEqual(await readSessionFromRequest(request, SECRET), { userId: "user-42" });
});

test("readSessionFromRequest: retorna null sem cookie ou com segredo errado", async () => {
  const withoutCookie = new Request("https://example.com/");
  assert.equal(await readSessionFromRequest(withoutCookie, SECRET), null);

  const cookieValue = await createSessionCookieValue("user-42", SECRET);
  const wrongSecretRequest = requestWithCookie(SESSION_COOKIE_NAME, cookieValue);
  assert.equal(await readSessionFromRequest(wrongSecretRequest, "outro-segredo"), null);
});

test("buildSessionSetCookie: inclui HttpOnly sempre, e Secure só quando pedido", async () => {
  const cookieValue = await createSessionCookieValue("user-1", SECRET);
  assert.match(buildSessionSetCookie(cookieValue, true), /HttpOnly/);
  assert.match(buildSessionSetCookie(cookieValue, true), /Secure/);
  assert.doesNotMatch(buildSessionSetCookie(cookieValue, false), /Secure/);
});
