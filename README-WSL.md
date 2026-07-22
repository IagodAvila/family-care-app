# FamilyCare no WSL

Esta pasta foi preparada para ser copiada para o filesystem Linux do WSL.

## Preparação

O projeto requer Node.js 22.13.0 ou superior e pnpm.

```bash
cd ~/projetos/FamilyCare
corepack enable
pnpm install
pnpm dev
```

Depois, abra o endereço local exibido no terminal.

## Abrir no VS Code

Com a extensão WSL instalada no VS Code, execute dentro da pasta:

```bash
code .
```

O canto inferior esquerdo do VS Code deve indicar que a janela está conectada ao WSL.

## Observações

- Não copie `node_modules` do Windows; as dependências devem ser instaladas novamente dentro do WSL.
- Mantenha o projeto em uma pasta Linux, como `~/projetos/FamilyCare`, para melhor desempenho.
- Se o projeto passar a usar arquivos `.env`, copie-os separadamente e não os publique no Git.
