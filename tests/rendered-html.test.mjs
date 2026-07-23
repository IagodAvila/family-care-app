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
  assert.match(html, /Quem você ama, sempre bem cuidado\./i);
  assert.match(html, /Modo emergência/i);
  assert.match(html, /Antônio Almeida/i);
  assert.match(html, /Hipertensão/i);
  assert.match(html, /Losartana/i);
  assert.match(html, /aria-label="Navegação principal"/i);
});

test("ships production metadata without starter artifacts", async () => {
  const response = await render();
  const html = await response.text();
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/layout.tsx", projectRoot), "utf8"),
    readFile(new URL("package.json", projectRoot), "utf8"),
  ]);

  assert.match(html, /<meta name="description" content="Organize dados médicos essenciais/i);
  assert.match(html, /<meta property="og:title" content="FamilyCare/i);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview/i);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/i);
  await assert.rejects(access(new URL("app/_sites-preview", projectRoot)));
});
