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
- Armazenamento local dos dados no navegador
- Modais com gerenciamento de foco, navegação por teclado e fechamento por Escape
- Interface responsiva para computadores e dispositivos móveis

## Tecnologias

- React 19
- Next.js 16
- TypeScript
- Vinext e Vite
- Tailwind CSS
- Vitest e Testing Library
- Drizzle ORM, presente apenas como preparação para uma futura integração

## Requisitos

- Node.js 22.13.0 ou superior
- npm ou pnpm

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

O MVP atual usa exclusivamente o `localStorage` do navegador. D1, R2 e
autenticação não estão ativos nem participam do fluxo da aplicação. Isso
significa que:

- os dados não são enviados para um servidor;
- cada navegador e dispositivo possui seu próprio cadastro;
- limpar os dados do navegador pode apagar os registros;
- os dados não são sincronizados entre dispositivos.

Antes de utilizar o projeto em produção, recomenda-se implementar autenticação, controle de acesso, criptografia e armazenamento seguro em banco de dados.

## Testes

A suíte combina três níveis de verificação:

- testes unitários das regras de familiares, medicamentos, datas e diálogos;
- testes reais de componentes React em DOM simulado, cobrindo abertura e
  fechamento de modal, foco inicial, Escape, restauração de foco, cadastro,
  validação de data, múltiplos medicamentos, troca de familiar, modo emergência
  e `localStorage`;
- testes do HTML gerado pelo build e de contratos visuais responsivos que não
  são bem representados em um DOM sem layout.

Os testes unitários importam os módulos TypeScript diretamente com o suporte
nativo de remoção de tipos do Node.js. Os testes de componentes usam Vitest,
Testing Library e jsdom.

## Estrutura principal

```text
app/
├── components/         # Componentes React, modais e formulários
├── globals.css         # Estilos globais da aplicação
├── layout.tsx          # Layout e metadados
└── page.tsx            # Composição da tela e estado estritamente visual

hooks/
└── use-family-store.ts # Estado, localStorage e operações da família

lib/
├── dialog-behavior.ts  # Regras tipadas de acessibilidade dos diálogos
├── family-data.ts      # Regras tipadas, validação e compatibilidade legada
└── family-format.ts    # Formatação para exibição

types/
└── family.ts           # Tipos centrais de familiar e medicamento

tests/
├── components.test.tsx     # Fluxos reais de componentes React
├── dialog-behavior.test.mjs # Regras de foco e diálogo
├── family-data.test.mjs     # Regras de dados e compatibilidade
└── rendered-html.test.mjs   # HTML de produção e contratos responsivos

db/
├── index.ts            # Preparação não utilizada para acesso ao D1
└── schema.ts           # Esquema ainda não utilizado pelo MVP

public/                 # Imagens e assets estáticos
```

## Aviso

O FamilyCare auxilia na organização de informações fornecidas pelo próprio usuário. Ele não substitui prontuários oficiais, orientação médica ou serviços de emergência.

## Licença

Este projeto ainda não possui uma licença definida.
