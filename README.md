# FamilyCare

Aplicação web para organizar informações essenciais de saúde dos familiares em um só lugar. O FamilyCare facilita a consulta de dados importantes no dia a dia e em situações de emergência.

## Acesse a aplicação

Teste a versão publicada em: [family-care-app.iagoddc.workers.dev](https://family-care-app.iagoddc.workers.dev)

## Funcionalidades

- Cadastro de familiares com nome, parentesco e data de nascimento
- Registro de tipo sanguíneo, comorbidades e alergias
- Inclusão e remoção de medicamentos de uso contínuo
- Edição dos dados de familiares já cadastrados
- Exclusão de familiares com confirmação em duas etapas
- Busca rápida por nome ou parentesco
- Modo emergência para destacar informações vitais e trocar rapidamente o familiar
- Login com Google; dados sincronizados com segurança entre dispositivos
- Importação opcional dos dados de uma versão anterior salvos no navegador
- Modais com gerenciamento de foco, navegação por teclado e fechamento por Escape
- Interface responsiva para computadores e dispositivos móveis

## Tecnologias

- React 19
- Next.js 16
- TypeScript
- Vinext e Vite
- Tailwind CSS
- Vitest e Testing Library
- Cloudflare Workers, D1 e Drizzle ORM
- OAuth 2.0 com Google (implementação própria, só com `fetch`/Web Crypto)

## Requisitos

- Node.js 22.13.0 ou superior
- npm ou pnpm
- Conta na Cloudflare (Workers + D1) e um cliente OAuth do Google — veja
  [Autenticação e configuração](#autenticação-e-configuração)

## Instalação

Clone o repositório e acesse a pasta do projeto:

```bash
git clone git@github.com:IagodAvila/family-care-app.git
cd family-care-app
```

Instale as dependências:

```bash
npm install
```

Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

Abra no navegador o endereço exibido pelo terminal.

## Autenticação e configuração

O app usa D1 como fonte de dados e Google como provedor de login — o
servidor de desenvolvimento precisa de segredos para funcionar:

1. Copie `.dev.vars.example` para `.dev.vars` (já ignorado pelo Git).
2. Crie um cliente OAuth em
   [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
   (tipo "Web application"), com `http://localhost:3000/api/auth/callback`
   como URI de redirecionamento autorizado. Preencha `GOOGLE_CLIENT_ID` e
   `GOOGLE_CLIENT_SECRET` em `.dev.vars`.
3. Gere um `SESSION_SECRET` aleatório (`openssl rand -base64 32`) e
   preencha em `.dev.vars`.
4. Em produção, os mesmos três valores são configurados com
   `npx wrangler secret put <NOME>` (nunca commitados) e a URI de
   redirecionamento autorizada no Google deve apontar para
   `https://<seu-worker>.workers.dev/api/auth/callback`.

## Comandos disponíveis

```bash
npm run dev      # Inicia o servidor de desenvolvimento
npm run build    # Gera a versão de produção
npm run start    # Inicia a versão de produção
npm run lint     # Verifica a qualidade do código
npm test         # Gera o build e executa todos os testes automatizados
npm run test:unit       # Executa testes de regras e HTML renderizado
npm run test:components # Executa testes de interação dos componentes React
```

## Armazenamento e privacidade

Os dados ficam num banco D1 (Cloudflare), atrás de login com Google:

- cada pessoa só acessa os dados depois de autenticar com sua conta Google;
- a sessão é um cookie assinado (HMAC, `HttpOnly`, `Secure` em produção),
  sem tabela de sessões — ver `lib/auth/session.ts`;
- toda operação de leitura/escrita passa por checagem de papel no servidor
  (`db/authorization.ts`, `db/services/family-care.ts`), nunca confiando em
  IDs enviados pelo cliente;
- exclusões são lógicas (soft-delete) e cada escrita usa concorrência
  otimista (`version`) para evitar sobrescrita silenciosa;
- quem já usava a versão anterior (só `localStorage`) recebe, no primeiro
  login, a opção de importar esses dados para a conta — nada é apagado do
  navegador automaticamente.

Multi-usuário por família (convidar outras pessoas com papéis diferentes)
ainda não está implementado — hoje cada conta Google tem sua própria
família. Veja `docs/architecture.md` para o desenho completo dessa próxima
etapa.

## Testes

A suíte combina quatro níveis de verificação:

- testes unitários das regras de familiares, medicamentos, datas, diálogos e
  cookies de sessão assinados (`lib/auth`);
- testes da camada D1 (`db/services/family-care.ts`) contra um banco SQLite
  em memória que aplica as migrations reais (`tests/helpers/d1-database.mjs`);
- testes reais de componentes React em DOM simulado, cobrindo abertura e
  fechamento de modal, foco inicial, Escape, restauração de foco, cadastro,
  validação de data, múltiplos medicamentos, troca de familiar, modo
  emergência e a importação de dados de uma versão anterior — usando um
  `fetch` falso que simula as rotas `/api/**` em memória
  (`tests/helpers/fake-family-backend.ts`), já que os dados não vivem mais
  no `localStorage`;
- testes do HTML gerado pelo build e de contratos visuais responsivos que não
  são bem representados em um DOM sem layout.

Os testes unitários importam os módulos TypeScript diretamente com o suporte
nativo de remoção de tipos do Node.js. Os testes de componentes usam Vitest,
Testing Library e jsdom.

## Estrutura principal

```text
app/
├── api/                 # Rotas server-side: login/callback/logout com Google,
│                        # famílias, familiares, medicamentos, importação local
├── components/          # Componentes React, modais e formulários
├── globals.css          # Estilos globais da aplicação
├── layout.tsx           # Layout e metadados
└── page.tsx             # Composição da tela; authState controla login/carregando/pronto

hooks/
└── use-family-store.ts  # Estado do cliente + chamadas às rotas /api/**

lib/
├── auth/                # Sessão assinada, fluxo OAuth do Google, leitura de bindings/segredos
├── api/respond.ts       # Mapeia erros do domínio para respostas HTTP
├── dialog-behavior.ts   # Regras tipadas de acessibilidade dos diálogos
├── family-data.ts       # Regras tipadas, validação e adaptação para a API
└── family-format.ts     # Formatação para exibição

types/
└── family.ts            # Tipos centrais de familiar e medicamento

tests/
├── components.test.tsx      # Fluxos reais de componentes React (com fetch simulado)
├── auth-session.test.mjs    # Cookies de sessão assinados
├── d1-data-layer.test.mjs   # FamilyCareDataService contra D1 em memória
├── dialog-behavior.test.mjs # Regras de foco e diálogo
├── family-data.test.mjs     # Regras de dados e compatibilidade
└── rendered-html.test.mjs   # HTML de produção e contratos responsivos

db/
├── index.ts             # createDb/getDb — liga o binding D1 ao Drizzle
├── schema.ts             # Usuários, famílias, familiares, medicamentos, convites, auditoria
├── services/family-care.ts # Regras de negócio, autorização e concorrência otimista
└── authorization.ts, validation.ts, errors.ts, domain.ts

worker/index.ts           # Entry point do Cloudflare Worker

public/                   # Imagens e assets estáticos
```

## Aviso

O FamilyCare auxilia na organização de informações fornecidas pelo próprio usuário. Ele não substitui prontuários oficiais, orientação médica ou serviços de emergência.

## Licença

Este projeto ainda não possui uma licença definida.
