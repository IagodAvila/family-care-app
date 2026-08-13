import { requireSessionUser } from "@/lib/auth/require-user";
import { withApi } from "@/lib/api/respond";

const MAX_INPUT_LENGTH = 2000;
// `@cf/meta/llama-3.1-8b-instruct` (no suffix) is gone from the catalog;
// its direct fp8 replacement doesn't support JSON Mode (`AiError 5025`).
// This one does, and correctly leaves fields empty instead of inventing
// data on sparse input — verified directly against Workers AI before
// picking it (see PR description / chat history for the repro).
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** Minimal shape of the Workers AI binding — see worker/index.ts for the sibling ASSETS/DB/IMAGES bindings, defined the same locally-typed way instead of pulling in `@cloudflare/workers-types`. */
type WorkersAI = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

/**
 * Structured shape the model must return — enforced via JSON Mode's
 * `response_format` (see the `env.AI.run` call below), so this is also the
 * contract the client can trust without re-validating.
 */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    conditions: {
      type: "array",
      items: { type: "string" },
      description: "Comorbidades/condições de saúde mencionadas explicitamente. Vazio se nada foi dito sobre isso — não adivinhe.",
    },
    allergies: {
      type: "array",
      items: { type: "string" },
      description: "Alergias mencionadas explicitamente. Vazio se nada foi dito sobre isso — não adivinhe.",
    },
    medications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          dosage: { type: "string" },
          orientation: { type: "string" },
        },
        required: ["name", "dosage", "orientation"],
      },
      description: "Medicamentos em uso mencionados. dosage/orientation vazios (\"\") se não informados.",
    },
  },
  required: ["conditions", "allergies", "medications"],
} as const;

const SYSTEM_PROMPT = `Você extrai dados de saúde de uma descrição em texto livre, em português, para preencher um cadastro de familiar num app de saúde doméstica.

Regras:
- Extraia só o que está dito explicitamente. Nunca invente ou infira condições, alergias ou medicamentos que não foram mencionados.
- Se o texto disser explicitamente que a pessoa NÃO tem alguma coisa (ex.: "não tem alergia nenhuma", "sem comorbidades"), retorne exatamente ["Não possui"] nesse campo.
- Se o texto simplesmente não mencionar alergias ou comorbidades (nem para afirmar, nem para negar), retorne uma lista vazia — não presuma que a ausência de menção significa "não possui".
- Cada item de "conditions" e "allergies" deve ser um nome curto (ex.: "Hipertensão", "Dipirona"), sem frases completas.
- Para medicamentos, preencha "dosage" e "orientation" só com o que foi dito; deixe como string vazia o que não foi informado.
- Responda APENAS com o objeto JSON pedido, nada mais.`;

type AssistResult = {
  conditions: string[];
  allergies: string[];
  medications: { name: string; dosage: string; orientation: string }[];
};

function isAssistResult(value: unknown): value is AssistResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.conditions)
    && Array.isArray(candidate.allergies)
    && Array.isArray(candidate.medications)
  );
}

export async function POST(request: Request) {
  return withApi(async () => {
    await requireSessionUser(request);

    // Not part of AppEnv/getAppEnv's required-bindings check: this feature
    // is optional, so a workspace without the AI binding degrades this one
    // route instead of failing every request the app makes (see
    // lib/auth/env.ts). Missing locally until `ai: { binding: "AI" }` is
    // picked up by `wrangler dev`/the Cloudflare Vite plugin.
    const { env } = await import("cloudflare:workers");
    const ai = (env as { AI?: WorkersAI }).AI;
    if (!ai) {
      return Response.json(
        { error: "Preenchimento assistido não está configurado neste ambiente." },
        { status: 501 },
      );
    }

    const body = (await request.json()) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) {
      return Response.json({ error: "Descreva a situação de saúde antes de continuar." }, { status: 400 });
    }
    if (text.length > MAX_INPUT_LENGTH) {
      return Response.json(
        { error: `Descrição muito longa (máximo ${MAX_INPUT_LENGTH} caracteres).` },
        { status: 400 },
      );
    }

    let response: unknown;
    try {
      response = await ai.run(MODEL, {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
      });
    } catch (caught) {
      console.error(caught);
      return Response.json(
        { error: "Não foi possível processar esse texto agora. Tente de novo ou preencha manualmente." },
        { status: 502 },
      );
    }

    // Workers AI's JSON Mode returns the parsed object directly under
    // `.response` for schema-following models — no text block to parse.
    const parsed = (response as { response?: unknown } | null)?.response;
    if (!isAssistResult(parsed)) {
      return Response.json({ error: "Resposta inesperada do assistente." }, { status: 502 });
    }

    return Response.json(parsed);
  });
}
