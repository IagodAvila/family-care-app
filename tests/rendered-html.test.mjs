import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the FamilyCare dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="pt-BR">/i);
  assert.match(html, /<title>FamilyCare \| Saúde da família ao seu alcance<\/title>/i);
  assert.match(html, /<main class="app">/i);
  assert.match(html, /Modo emergência/i);
  assert.match(html, /Dados de saúde da família, organizados neste dispositivo\./i);
  assert.doesNotMatch(html, /Quem você ama, sempre bem cuidado|Informação certa, na hora que importa/i);
  assert.match(html, /Nenhum familiar cadastrado/i);
  assert.match(html, /Comece sua rede de cuidados/i);
  assert.match(html, /Adicionar familiar/i);
  assert.doesNotMatch(html, /Antônio Almeida|Lúcia Almeida|Marina Almeida/i);
  assert.match(html, /aria-label="Navegação principal"/i);
});

test("prioriza o modo emergência e mantém ações destrutivas em menu secundário", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
  ]);

  assert.match(page, /className=\{emergencyMode \? "emergency-top-button active" : "emergency-top-button"\}/);
  assert.match(page, /aria-pressed=\{emergencyMode\}/);
  assert.match(page, /disabled=\{!selected\}/);
  assert.match(page, /Sair do modo emergência/);
  assert.match(page, /className="add-relative-compact"/);
  assert.match(page, /aria-haspopup="menu"/);
  assert.match(page, /aria-expanded=\{showMoreOptions\}/);
  assert.match(page, /Excluir familiar/);
  assert.doesNotMatch(page, /className="delete-button"/);
  assert.match(page, /event\.key === "Escape"/);
  assert.doesNotMatch(css, /\.emergency-active \.medications-section[^}]*display:\s*none/);
  assert.match(page, /Medicamentos em uso/);
  assert.match(page, /Nenhum medicamento informado\./);
  assert.match(page, /!emergencyMode && <div className="record-actions">/);
  assert.match(page, /todos os dados de .*incluindo medicamentos/i);
  assert.match(css, /\.app-intro \{[^}]*padding: 16px 0 0/);
  assert.doesNotMatch(css, /\.hero \{ min-height: 246px/);
});

test("ships production metadata without starter artifacts", async () => {
  const response = await render();
  const html = await response.text();
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/layout.tsx", projectRoot), "utf8"),
    readFile(new URL("package.json", projectRoot), "utf8"),
  ]);

  assert.match(html, /<meta name="description" content="Dados de saúde da família organizados/i);
  assert.match(html, /<meta property="og:title" content="FamilyCare/i);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview/i);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/i);
  await assert.rejects(access(new URL("app/_sites-preview", projectRoot)));
});
