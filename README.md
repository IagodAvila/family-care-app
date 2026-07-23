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
- Modo emergência para destacar informações vitais
- Armazenamento local dos dados no navegador
- Interface responsiva para computadores e dispositivos móveis

## Tecnologias

- React 19
- Next.js 16
- TypeScript
- Vinext e Vite
- Tailwind CSS
- Drizzle ORM, preparado para uma futura integração com banco de dados

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
npm test         # Gera o build e executa os testes automatizados
```

## Armazenamento e privacidade

Nesta versão, as informações cadastradas ficam somente no `localStorage` do navegador. Isso significa que:

- os dados não são enviados para um servidor;
- cada navegador e dispositivo possui seu próprio cadastro;
- limpar os dados do navegador pode apagar os registros;
- os dados não são sincronizados entre dispositivos.

Antes de utilizar o projeto em produção, recomenda-se implementar autenticação, controle de acesso, criptografia e armazenamento seguro em banco de dados.

## Estrutura principal

```text
app/
├── globals.css       # Estilos da aplicação
├── layout.tsx        # Layout e metadados
└── page.tsx          # Interface e regras do FamilyCare

db/
├── index.ts          # Configuração de acesso ao banco
└── schema.ts         # Esquema de dados
```

## Aviso

O FamilyCare auxilia na organização de informações fornecidas pelo próprio usuário. Ele não substitui prontuários oficiais, orientação médica ou serviços de emergência.

## Licença

Este projeto ainda não possui uma licença definida.
