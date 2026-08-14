import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const uiSourceFiles = [
  "app/page.tsx",
  "app/components/app-footer.tsx",
  "app/components/app-header.tsx",
  "app/components/app-modals.tsx",
  "app/components/confirm-dialog.tsx",
  "app/components/empty-family-record.tsx",
  "app/components/family-panel.tsx",
  "app/components/medical-record.tsx",
  "app/components/relative-form.tsx",
  "app/components/theme-toggle.tsx",
  "hooks/use-family-store.ts",
];

async function readUiSource() {
  const sources = await Promise.all(
    uiSourceFiles.map((path) => readFile(new URL(path, projectRoot), "utf8")),
  );
  return sources.join("\n");
}

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

test("server-renders the FamilyCare loading shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="pt-BR">/i);
  assert.match(html, /<title>FamilyCare \| Saúde da família ao seu alcance<\/title>/i);
  // Family data now lives in D1 and loads client-side after checking the
  // session (see hooks/use-family-store.ts), so a request with no cookies
  // and no JS execution — this raw SSR pass — can only ever render the
  // loading shell; the dashboard chrome mounts after hydration.
  assert.match(html, /<main class="app app-loading">/i);
  assert.match(html, /Carregando/i);
  assert.doesNotMatch(html, /Quem você ama, sempre bem cuidado|Informação certa, na hora que importa/i);
  assert.doesNotMatch(html, /Antônio Almeida|Lúcia Almeida|Marina Almeida/i);
});

test("prioriza o modo emergência e mantém ações destrutivas em menu secundário", async () => {
  const [page, css, modal] = await Promise.all([
    readUiSource(),
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
    readFile(new URL("app/components/modal.tsx", projectRoot), "utf8"),
  ]);

  // The emergency toggle lives on the selected relative's own record panel
  // now (dominant button there, fixed bottom bar on mobile — see
  // globals.css), not competing with the theme toggle/avatar in the top
  // bar. It only renders once a relative is selected, so there is no
  // disabled/placeholder state to test for.
  assert.match(page, /className=\{emergencyMode \? "emergency-button active" : "emergency-button"\}/);
  assert.match(page, /aria-pressed=\{emergencyMode\}/);
  assert.match(page, /Sair do modo emergência/);
  assert.match(css, /\.emergency-bar \{[^}]*position: fixed;[^}]*bottom: 0;/);
  assert.match(page, /className="add-relative-compact"/);
  assert.match(page, /aria-label="Adicionar familiar"/);
  assert.doesNotMatch(page, /<span aria-hidden="true">!<\/span> \{emergencyMode/);
  assert.match(page, /aria-haspopup="true"/);
  assert.match(page, /aria-controls="more-options-popover"/);
  assert.match(page, /aria-expanded=\{showMoreOptions\}/);
  assert.match(page, /deleteActionRef\.current\?\.focus\(\)/);
  assert.match(page, /moreOptionsButtonRef\.current\?\.focus\(\)/);
  assert.match(page, /Excluir familiar/);
  assert.doesNotMatch(page, /role="menu(?:item)?"/);
  assert.doesNotMatch(page, /className="delete-button"/);
  assert.match(page, /event\.key === "Escape"/);
  assert.doesNotMatch(css, /\.emergency-active \.medications-section[^}]*display:\s*none/);
  assert.match(page, /Medicamentos em uso/);
  assert.match(page, /Nenhum medicamento informado\./);
  assert.match(page, /!emergencyMode && \([\s\S]*<div className="record-actions">/);
  assert.match(page, /id="quick-family-select"/);
  assert.match(page, /Selecionar familiar no modo emergência/);
  assert.match(page, /onChange=\{\(event\) => onSelectRelative\(event\.target\.value\)\}/);
  assert.match(page, /todos os dados de .*incluindo medicamentos/i);
  // A single real <h1> landmark, kept off-screen — the header's app name
  // already carries that job visually, no need to spend space repeating it.
  assert.match(page, /<h1 className="sr-only" id="inicio">/);
  assert.doesNotMatch(css, /\.hero \{ min-height: 246px/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /aria-labelledby=\{titleId\}/);
});

test("modal reutilizável gerencia foco, Escape, backdrop, isolamento e rolagem", async () => {
  const [page, modal] = await Promise.all([
    readUiSource(),
    readFile(new URL("app/components/modal.tsx", projectRoot), "utf8"),
  ]);

  // 3 direct <Modal> usages in app-modals.tsx (relative form, medication form,
  // privacy) plus the one inside the reusable ConfirmDialog component, used
  // for the delete-relative and remove-medication confirmations.
  assert.equal((page.match(/<Modal\s/g) ?? []).length, 4);
  assert.match(page, /initialFocusSelector='input\[name="name"\]'/);
  assert.match(page, /initialFocusSelector="\[data-modal-primary\]"/);
  assert.doesNotMatch(page, /autoFocus/);
  assert.match(modal, /getFocusableElements\(dialog\)/);
  assert.match(modal, /trapDialogFocus\(event, dialogRef\.current\)/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /isDirectBackdropClick\(event\)/);
  assert.match(modal, /lockDocumentScroll\(document\)/);
  assert.match(modal, /app\.inert = true/);
  assert.match(modal, /openerRef\.current\?\.focus\(\)/);
  assert.match(modal, /window\.cancelAnimationFrame\(animationFrame\)/);
});

test("mantém muitos familiares em lista vertical responsiva e nomes longos contidos", async () => {
  const [page, css] = await Promise.all([
    readUiSource(),
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
  ]);

  assert.match(page, /role="region" aria-label="Lista de familiares"/);
  // One scroll for the whole page — the family list grows to its natural
  // height instead of scrolling inside its own nested region.
  assert.doesNotMatch(css, /\.family-list \{[^}]*overflow-y: auto/);
  assert.doesNotMatch(css, /\.family-list \{[^}]*max-height/);
  assert.match(css, /\.person-card \{[^}]*min-width: 0;[^}]*overflow: hidden;/);
  assert.match(css, /\.person-summary strong, \.person-summary small \{[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/);
  assert.doesNotMatch(css, /\.family-list \{[^}]*grid-template-columns: repeat\(3/);
  assert.doesNotMatch(css, /\.family-list \{[^}]*overflow-x: auto/);
  assert.match(css, /@media \(max-width: 650px\)[\s\S]*\.person-card \{ min-height: 68px; \}/);
});

test("oferece troca rápida apenas no modo emergência e oculta ações de edição", async () => {
  const [page, css] = await Promise.all([
    readUiSource(),
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
  ]);

  assert.match(page, /\{emergencyMode && \([\s\S]*className="quick-family-switcher"/);
  assert.match(page, /value=\{selected\.id\}/);
  assert.match(page, /family\.map\(\(person\) => \([\s\S]*<option/);
  assert.match(page, /Familiar em emergência/);
  assert.doesNotMatch(page, /Trocar familiar/);
  assert.match(css, /\.emergency-active \.quick-family-switcher \{[^}]*position: sticky;/);
  assert.match(page, /!emergencyMode && \([\s\S]*<div className="record-actions">/);
  assert.match(page, /!emergencyMode && \([\s\S]*className="remove-medication"/);
});

test("mantém armazenamento como informação global e preserva o estado vazio", async () => {
  const page = await readUiSource();

  assert.doesNotMatch(page, /Dados salvos neste dispositivo/);
  assert.match(page, /Seus dados ficam protegidos na sua conta, atrás de login\./);
  assert.match(page, /Nenhum familiar cadastrado/);
  assert.match(page, /<button className="submit-button" type="button" onClick=\{onAddRelative\}>[\s\S]*Adicionar familiar[\s\S]*<\/button>/);
});

test("mantém o botão de emergência acessível e como barra fixa no mobile", async () => {
  const [page, css] = await Promise.all([
    readUiSource(),
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
  ]);

  assert.match(page, /aria-pressed=\{emergencyMode\}/);
  assert.match(page, /\{emergencyMode \? "Sair do modo emergência" : "Modo emergência"\}/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.emergency-bar \{[^}]*position: fixed;/);
  assert.match(css, /:focus-visible \{ outline: 3px solid #0b6f69;/);
});

test("permite alternar entre tema claro e escuro com um botão, sem depender só do sistema", async () => {
  const [page, css, layout] = await Promise.all([
    readUiSource(),
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
    readFile(new URL("app/layout.tsx", projectRoot), "utf8"),
  ]);

  assert.match(page, /aria-label="Alternar entre tema claro e escuro"/);
  assert.match(page, /className="theme-icon theme-icon-sun"/);
  assert.match(page, /className="theme-icon theme-icon-moon"/);
  assert.match(page, /root\.dataset\.theme = next/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.doesNotMatch(css, /@media \(prefers-color-scheme: dark\)\s*\{/);
  assert.match(layout, /dangerouslySetInnerHTML/);
  assert.match(layout, /resolveInitialThemeScript/);
});

test("ships production metadata without starter artifacts", async () => {
  const response = await render();
  const html = await response.text();
  const [page, layout, packageJson] = await Promise.all([
    readUiSource(),
    readFile(new URL("app/layout.tsx", projectRoot), "utf8"),
    readFile(new URL("package.json", projectRoot), "utf8"),
  ]);

  assert.match(html, /<meta name="description" content="Dados de saúde da família sincronizados/i);
  assert.match(html, /<meta property="og:title" content="FamilyCare/i);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview/i);

  // PWA: sem estas tags no HTML servido, o navegador não considera o app
  // instalável, por mais completo que o manifest esteja. As URLs saem
  // absolutas porque o layout define `metadataBase`.
  assert.match(html, /<link rel="manifest" href="[^"]*\/manifest\.webmanifest"/i);
  assert.match(html, /<link rel="apple-touch-icon" href="[^"]*\/icons\/apple-touch-icon\.png"/i);
  assert.match(html, /<meta name="mobile-web-app-capable" content="yes"/i);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/i);
  assert.match(html, /<meta name="theme-color" content="#1f7773"/i);
  // "black-translucent" faria a barra de status do iOS cobrir o conteúdo, e
  // o shim de viewport do vinext não emite `viewport-fit=cover` pra
  // compensar com safe-area — ver o comentário em app/layout.tsx.
  assert.doesNotMatch(html, /apple-mobile-web-app-status-bar-style" content="black-translucent"/i);
  assert.doesNotMatch(page, /fixture-[1-8]|Medicamento fictício/i);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/i);
  await assert.rejects(access(new URL("app/_sites-preview", projectRoot)));
});
