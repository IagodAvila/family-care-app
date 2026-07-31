# Arquitetura proposta para o FamilyCare autenticado

## Status do documento

Este documento é um plano técnico. Ele não implementa autenticação, banco de
dados, migrations ou mudanças de interface, e não constitui parecer jurídico,
regulatório ou médico.

Estado observado em 30 de julho de 2026:

- o MVP usa `localStorage` como fonte única dos dados;
- `types/family.ts` define `Relative` e `Medication`;
- `use-family-store.ts` concentra hidratação e persistência local;
- `db/schema.ts` está vazio e `db/index.ts` ainda não é chamado;
- `.openai/hosting.json` referencia um projeto Sites existente, com `d1` e `r2`
  nulos;
- o Site está com acesso restrito ao proprietário e possui suporte de identidade
  do Sites, mas isso não define os papéis internos do FamilyCare;
- `app/chatgpt-auth.ts` é um helper disponível, não uma decisão arquitetural
  final.

As instruções do Sites indicam D1 para dados relacionais duráveis e distinguem
as configurações de audiência do Site da autenticação construída dentro da
aplicação. Elas também exigem que autorização continue no servidor.
[Documentação do Sites](https://learn.chatgpt.com/docs/sites)

Há uma restrição anterior a qualquer implementação: Sites não deve processar
Protected Health Information (PHI) e, no lançamento, não oferece residência de
dados para Site, D1, R2, artefatos ou logs. Como o FamilyCare registra
medicamentos, alergias, comorbidades e observações, o proprietário precisa
classificar o uso e os dados pretendidos antes de escolher o ambiente de
produção. Se o produto puder receber PHI ou estiver sujeito a exigências
incompatíveis com Sites, a versão persistente deve usar outra hospedagem
adequada. [Limites do ChatGPT Sites](https://help.openai.com/en/articles/20001339-creating-and-managing-chatgpt-sites)

## 1. Objetivos e limites

### MVP local versus versão autenticada

| Aspecto | MVP local | Versão autenticada |
| --- | --- | --- |
| Identidade | Não existe | Usuário autenticado e identidade vinculada no servidor |
| Fonte de verdade | `localStorage` | Banco relacional no servidor |
| Compartilhamento | Por dispositivo/navegador | Por grupo familiar e papel |
| Sincronização | Não existe | Entre sessões e dispositivos autorizados |
| Autorização | Não existe | Aplicada no servidor em toda operação |
| Auditoria | Não existe | Eventos relevantes e minimizados |
| Recuperação | Dependente do navegador | Exportação, retenção e recuperação operacional |
| Emergência | Acesso de quem possui o dispositivo | Política explícita, limitada e revogável |

### O que continuará no navegador

- estado efêmero da interface: familiar selecionado, pesquisa, modal aberto e
  modo emergência;
- dados do formulário ainda não enviado;
- indicador da versão do formato local e dados legados durante uma migração;
- cookie de sessão `HttpOnly`, `Secure` e `SameSite`, inacessível ao JavaScript,
  quando a opção de autenticação exigir sessão própria;
- opcionalmente, um cache de emergência mínimo e criptografado, somente após
  decisão expressa do proprietário.

O navegador não deve ser a fonte autoritativa dos registros sincronizados.
Depois da migração, não deve manter uma cópia completa em `localStorage` por
padrão.

### O que será armazenado no servidor

- identidade mínima do usuário e vínculo com o provedor;
- grupos familiares, membros, papéis e estados de acesso;
- familiares, medicamentos e os campos clínicos já existentes;
- convites e revogações;
- sessões, caso o provedor não entregue uma sessão utilizável diretamente;
- eventos de auditoria minimizados;
- metadados de importação necessários para idempotência.

### Riscos específicos dos dados de saúde

- exposição pode causar dano pessoal, discriminação ou fraude;
- nomes, datas de nascimento e dados clínicos juntos aumentam a possibilidade de
  reidentificação;
- links de emergência podem ampliar a superfície de acesso;
- logs, analytics, backups e ferramentas de suporte podem criar cópias
  secundárias;
- um papel amplo ou uma consulta sem filtro de família pode expor outra família;
- exclusão na aplicação não significa remoção instantânea de backups;
- requisitos legais variam conforme jurisdição, público, finalidade e relação
  com prestadores de saúde.

Antes da etapa de persistência, deve existir uma classificação documentada dos
dados, finalidade, público, jurisdições e requisitos de hospedagem. Esse trabalho
deve contar com avaliação jurídica e de segurança apropriada fora deste
documento.

## 2. Modelo de usuários e famílias

### Entidades

**Usuário**

Pessoa autenticada. A chave interna é criada pelo FamilyCare e não deve ser o
e-mail. O vínculo externo usa `provider + provider_subject` estável. Nome e
e-mail são atributos atualizáveis.

**Grupo familiar**

Contêiner de autorização e ownership. Todo familiar pertence exatamente a um
grupo. Um usuário pode participar de vários grupos.

**Vínculo entre usuário e grupo**

Registro em `family_members` com papel e estado. É a fonte de autorização, não a
presença do usuário no controle de audiência do Sites.

### Papéis

| Papel | Leitura | Cadastro/edição | Medicamentos | Convites/acessos | Exclusão do grupo | Transferência |
| --- | --- | --- | --- | --- | --- | --- |
| Administrador | Sim | Sim | Sim | Sim | Sim, com proteção reforçada | Sim |
| Cuidador | Sim | Sim | Sim | Não | Não | Não |
| Somente leitura | Sim | Não | Não | Não | Não | Não |

Regras adicionais:

- deve sempre existir ao menos um administrador ativo;
- convites comuns só podem conceder `caregiver` ou `viewer`;
- conceder `admin` exige uma ação separada e confirmação reforçada;
- o administrador não pode remover o último administrador;
- cuidador não pode alterar papéis, ownership ou política de emergência;
- somente leitura pode consultar o modo emergência, conforme a política
  aprovada, mas não pode editar.

### Convites

1. Administrador informa o e-mail e o papel permitido.
2. Servidor cria token aleatório, armazena apenas o hash e define expiração.
3. Convite pode ser aceito somente por identidade compatível com o destinatário,
   salvo se o proprietário aprovar convites transferíveis.
4. Aceite cria ou reativa `family_members` em uma transação.
5. Reenvio invalida o token anterior.
6. Tokens aceitos, expirados ou revogados não podem ser reutilizados.

### Revogação

- marcar o vínculo como `revoked`, com autor e timestamp;
- invalidar convites pendentes daquele usuário/e-mail;
- revogar sessões próprias quando aplicável;
- negar novas consultas imediatamente;
- registrar evento de auditoria;
- caches offline só podem garantir revogação ao reconectar ou expirar.

### Transferência de administração

Operação transacional:

1. confirmar que o destinatário é membro ativo;
2. elevar o destinatário a administrador;
3. registrar auditoria;
4. opcionalmente rebaixar o administrador anterior;
5. verificar novamente que existe ao menos um administrador;
6. exigir reautenticação recente e confirmação explícita.

## 3. Decisões do modo emergência

Nenhuma destas opções deve ser ativada implicitamente.

| Opção | Benefício | Riscos/limites | Recomendação |
| --- | --- | --- | --- |
| Somente após login | Menor superfície e revogação imediata | Pode atrasar acesso e depender de rede | Padrão da primeira versão autenticada |
| Cache local em dispositivo autorizado | Consulta durante falha de rede | Perda/roubo do dispositivo, XSS, revogação tardia, complexidade de chaves | Adiar até existir threat model e necessidade comprovada |
| PIN local | Acesso rápido | PIN não prova identidade; força bruta e compartilhamento | Usar apenas para desbloquear cache cifrado, nunca como autenticação única |
| Link temporário | Compartilhamento rápido e revogável | Vazamento por histórico, encaminhamento, logs e referrer | Somente leitura, token hash, escopo mínimo e uso monitorado |
| QR Code temporário | Facilita abrir o link em outro aparelho | Fotografia ou encaminhamento equivale a copiar o token | Codificar apenas link temporário, nunca dados clínicos |
| Expiração curta | Reduz janela de exposição | Pode expirar durante atendimento | Começar com proposta de 10 minutos; proprietário decide |
| Revogação manual | Interrompe acesso online antes da expiração | Não apaga conteúdo já visto e não alcança cache offline | Obrigatória para links e dispositivos autorizados |

### Recomendação técnica

**Fase inicial:** acesso somente após login, com os mesmos papéis do grupo e sem
cache offline.

**Fase posterior, se aprovada:** link/QR Code online, somente leitura, restrito a
um familiar e a um subconjunto de campos. O token deve ter ao menos 128 bits de
entropia, ser armazenado apenas como hash, expirar rapidamente, poder ser
revogado e não aparecer em logs. A resposta deve enviar política de
`Referrer-Policy: no-referrer` e impedir indexação e cache compartilhado.

### Decisões do proprietário

- quais campos aparecem: tipo sanguíneo, alergias, comorbidades, medicamentos,
  orientação e/ou observações;
- login obrigatório ou compartilhamento temporário;
- expiração e uso único ou múltiplo;
- cache offline ou não;
- uso de PIN e limite de tentativas;
- quem pode gerar e revogar acesso;
- se leitura de emergência deve gerar notificação e auditoria visível.

## 4. Modelo de dados proposto

### Convenções

- IDs: `TEXT` com UUID/ULID gerado no servidor;
- timestamps: `INTEGER` em milissegundos UTC;
- booleanos: `INTEGER` limitado a `0` ou `1`;
- enums: `TEXT` com `CHECK`;
- estruturas compatíveis com o modelo atual: JSON serializado em `TEXT`, validado
  no servidor;
- tabelas mutáveis: `created_at`, `updated_at`, `deleted_at` e `version`;
- exclusão lógica primeiro; purga física por política explícita;
- nenhuma consulta de produto pode omitir `family_id`.

D1 usa semântica SQLite, suporta chaves estrangeiras e índices. As constraints
devem complementar, não substituir, a autorização de aplicação.
[Chaves estrangeiras no D1](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)
[Índices no D1](https://developers.cloudflare.com/d1/best-practices/use-indexes/)

### `users`

| Coluna | Tipo/regras |
| --- | --- |
| `id` | `TEXT PRIMARY KEY` |
| `auth_provider` | `TEXT NOT NULL` |
| `auth_subject` | `TEXT NOT NULL` |
| `email_normalized` | `TEXT NOT NULL` |
| `display_name` | `TEXT` |
| `status` | `TEXT NOT NULL CHECK (status IN ('active','blocked','deleted'))` |
| `last_login_at` | `INTEGER` |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |
| `deleted_at` | `INTEGER` |

Índices:

- `UNIQUE(auth_provider, auth_subject)`;
- índice não único em `email_normalized`;
- índice em `(status, updated_at)`.

Ownership: a conta pertence ao usuário; dados familiares pertencem ao grupo.
E-mail não deve ser usado como chave estrangeira.

### `families`

| Coluna | Tipo/regras |
| --- | --- |
| `id` | `TEXT PRIMARY KEY` |
| `name` | `TEXT NOT NULL` |
| `created_by_user_id` | `TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT` |
| `status` | `TEXT NOT NULL CHECK (status IN ('active','pending_deletion','deleted'))` |
| `version` | `INTEGER NOT NULL DEFAULT 1` |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |
| `deleted_at`, `purge_after` | `INTEGER` |

Índices: `(created_by_user_id)`, `(status, purge_after)`.

Ownership efetivo é coletivo, expresso pelos administradores ativos em
`family_members`; `created_by_user_id` é histórico.

### `family_members`

| Coluna | Tipo/regras |
| --- | --- |
| `family_id` | `TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT` |
| `user_id` | `TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT` |
| `role` | `TEXT NOT NULL CHECK (role IN ('admin','caregiver','viewer'))` |
| `status` | `TEXT NOT NULL CHECK (status IN ('active','revoked'))` |
| `invited_by_user_id` | `TEXT REFERENCES users(id) ON DELETE SET NULL` |
| `joined_at`, `created_at`, `updated_at` | `INTEGER NOT NULL` |
| `revoked_at` | `INTEGER` |
| `revoked_by_user_id` | `TEXT REFERENCES users(id) ON DELETE SET NULL` |

Chave primária: `(family_id, user_id)`.

Índices: `(user_id, status)`, `(family_id, role, status)`.

Uma transação de serviço deve impedir zero administradores ativos.

### `relatives`

| Coluna | Tipo/regras |
| --- | --- |
| `id` | `TEXT PRIMARY KEY` |
| `family_id` | `TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT` |
| `import_source_id` | `TEXT` para idempotência do `localStorage` |
| `name`, `relation`, `birth_date`, `blood_type` | `TEXT NOT NULL` |
| `conditions_json`, `allergies_json` | `TEXT NOT NULL DEFAULT '[]'` |
| `notes`, `color` | `TEXT NOT NULL DEFAULT ''` |
| `position` | `INTEGER NOT NULL DEFAULT 0` |
| `version` | `INTEGER NOT NULL DEFAULT 1` |
| `created_by_user_id`, `updated_by_user_id` | `TEXT REFERENCES users(id)` |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |
| `deleted_at`, `deleted_by_user_id` | `INTEGER`, `TEXT REFERENCES users(id)` |

Índices:

- `(family_id, deleted_at, position)`;
- `(family_id, updated_at)`;
- `UNIQUE(family_id, import_source_id)` quando `import_source_id` não for nulo;
- `UNIQUE(family_id, id)` para referência composta de medicamentos.

`conditions_json` e `allergies_json` mantêm compatibilidade com `string[]`. Não
devem ser usados em filtros sem uma futura decisão de normalização.

### `medications`

| Coluna | Tipo/regras |
| --- | --- |
| `id` | `TEXT PRIMARY KEY` |
| `family_id` | `TEXT NOT NULL` |
| `relative_id` | `TEXT NOT NULL` |
| `name`, `dosage`, `orientation` | `TEXT NOT NULL DEFAULT ''` |
| `frequency` | `INTEGER` |
| `schedules_json` | `TEXT NOT NULL DEFAULT '[]'` |
| `legacy_schedule` | `TEXT` durante compatibilidade |
| `position` | `INTEGER NOT NULL DEFAULT 0` |
| `version` | `INTEGER NOT NULL DEFAULT 1` |
| `created_by_user_id`, `updated_by_user_id` | `TEXT REFERENCES users(id)` |
| `created_at`, `updated_at` | `INTEGER NOT NULL` |
| `deleted_at`, `deleted_by_user_id` | `INTEGER`, `TEXT REFERENCES users(id)` |

Chave estrangeira composta:
`(family_id, relative_id) REFERENCES relatives(family_id, id) ON DELETE RESTRICT`.

Índices: `(family_id, relative_id, deleted_at, position)` e
`(family_id, updated_at)`.

Duplicar `family_id` é intencional: facilita impor escopo em toda consulta e
evita buscar um medicamento apenas por ID global.

### `invitations`

| Coluna | Tipo/regras |
| --- | --- |
| `id` | `TEXT PRIMARY KEY` |
| `family_id` | `TEXT NOT NULL REFERENCES families(id)` |
| `email_normalized` | `TEXT NOT NULL` |
| `role` | `TEXT NOT NULL CHECK (role IN ('caregiver','viewer'))` |
| `token_hash` | `TEXT NOT NULL UNIQUE` |
| `status` | `TEXT NOT NULL CHECK (status IN ('pending','accepted','expired','revoked'))` |
| `invited_by_user_id` | `TEXT NOT NULL REFERENCES users(id)` |
| `accepted_by_user_id` | `TEXT REFERENCES users(id)` |
| `expires_at`, `created_at`, `updated_at` | `INTEGER NOT NULL` |
| `accepted_at`, `revoked_at` | `INTEGER` |

Índices: `(family_id, status, expires_at)` e
`(email_normalized, status)`. Recomenda-se índice único parcial para um convite
pendente por família/e-mail.

### `audit_events`

| Coluna | Tipo/regras |
| --- | --- |
| `id` | `TEXT PRIMARY KEY` |
| `family_id` | `TEXT REFERENCES families(id) ON DELETE SET NULL` |
| `actor_user_id` | `TEXT REFERENCES users(id) ON DELETE SET NULL` |
| `action` | `TEXT NOT NULL` |
| `target_type`, `target_id` | `TEXT` |
| `outcome` | `TEXT NOT NULL CHECK (outcome IN ('success','denied','failed'))` |
| `request_id` | `TEXT` |
| `metadata_json` | `TEXT NOT NULL DEFAULT '{}'` |
| `created_at` | `INTEGER NOT NULL` |

Índices: `(family_id, created_at)`, `(actor_user_id, created_at)` e
`(action, created_at)`.

Tabela append-only para a aplicação. `metadata_json` deve aceitar somente uma
allowlist de códigos e IDs; nunca conteúdo clínico.

### `sessions` — condicional

Necessária se a aplicação emitir sua própria sessão. Pode ser dispensada quando
o runtime fornece identidade autenticada confiável em toda requisição e a
revogação de `family_members` é suficiente.

| Coluna | Tipo/regras |
| --- | --- |
| `id` | `TEXT PRIMARY KEY` |
| `user_id` | `TEXT NOT NULL REFERENCES users(id)` |
| `token_hash` | `TEXT NOT NULL UNIQUE` |
| `created_at`, `expires_at`, `last_seen_at` | `INTEGER NOT NULL` |
| `revoked_at` | `INTEGER` |
| `rotated_from_session_id` | `TEXT REFERENCES sessions(id)` |
| `user_agent_hash`, `ip_prefix_hash` | `TEXT`, opcionais e sujeitos à retenção |

Índices: `(user_id, revoked_at, expires_at)` e `(expires_at)`.

### `emergency_access_grants` — condicional

Necessária apenas se link ou QR Code temporário forem aprovados.

| Coluna | Tipo/regras |
| --- | --- |
| `id` | `TEXT PRIMARY KEY` |
| `family_id` | `TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT` |
| `relative_id` | `TEXT NOT NULL` |
| `created_by_user_id` | `TEXT NOT NULL REFERENCES users(id)` |
| `token_hash` | `TEXT NOT NULL UNIQUE` |
| `scope_json` | `TEXT NOT NULL` com allowlist de campos visíveis |
| `status` | `TEXT NOT NULL CHECK (status IN ('active','expired','revoked'))` |
| `max_uses` | `INTEGER CHECK (max_uses > 0)` |
| `use_count` | `INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0)` |
| `created_at`, `expires_at` | `INTEGER NOT NULL` |
| `last_used_at`, `revoked_at` | `INTEGER` |
| `revoked_by_user_id` | `TEXT REFERENCES users(id)` |

Índices: `(family_id, status, expires_at)` e `(expires_at, status)`. O token em
texto claro existe apenas no cliente que cria/abre o acesso e nunca é persistido
ou registrado. A chave estrangeira deve ser composta:
`(family_id, relative_id) REFERENCES relatives(family_id, id) ON DELETE RESTRICT`.

### `migration_imports` — suporte recomendado

| Coluna | Tipo/regras |
| --- | --- |
| `id` | `TEXT PRIMARY KEY` |
| `family_id` | `TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT` |
| `user_id` | `TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT` |
| `source_device_id`, `idempotency_key`, `content_hash` | `TEXT NOT NULL` |
| `status` | `TEXT NOT NULL CHECK (status IN ('started','completed','failed'))` |
| `relative_count`, `medication_count` | `INTEGER NOT NULL DEFAULT 0` |
| `created_at` | `INTEGER NOT NULL` |
| `completed_at` | `INTEGER` |

`UNIQUE(user_id, idempotency_key)` impede reimportação após timeout ou repetição
do clique.

### Exclusões e regras por papel

- exclusões comuns são lógicas e incrementam `version`;
- somente administradores excluem grupo, membros ou iniciam purga;
- cuidadores podem excluir familiares/medicamentos, com confirmação e auditoria;
- visualizadores nunca fazem `INSERT`, `UPDATE` ou `DELETE`;
- purga física percorre medicamentos, familiares, vínculos e família em ordem
  explícita; não depender de cascata silenciosa;
- exclusão de usuário não exclui automaticamente um grupo compartilhado;
- exclusão ou saída do último administrador deve falhar;
- o prazo de recuperação antes da purga precisa de aprovação.

## 5. Autenticação

### Opções compatíveis

| Opção | Compatibilidade | Vantagens | Limites |
| --- | --- | --- | --- |
| Sign in with ChatGPT do Sites | Nativa no Site atual | Menos código de login; criação, login, logout e recuperação ficam com ChatGPT | Documentação atual expõe e-mail/nome ao servidor, mas não documenta nesses headers um subject opaco; acesso do Site não substitui papéis internos; depende das políticas do Sites |
| Provedor OIDC gerenciado compatível com Workers | Compatível via rotas server-side, `fetch`, Web Crypto e cookies | Subject estável, MFA/passkeys e recuperação gerenciados; maior portabilidade de hosting | Novo fornecedor, configuração de callback/secrets e verificação de compatibilidade do SDK com Workers |
| Credenciais próprias no D1 | Tecnicamente possível | Controle integral | Maior risco e custo de senhas, recuperação, MFA, abuso e suporte; não recomendado para este produto |

O Sign in with ChatGPT compartilha identidade apresentada no consentimento, como
nome e e-mail, e não concede acesso automático a conversas, arquivos ou memória.
[Sign in with ChatGPT](https://help.openai.com/pt-br/articles/20001410-sign-in-with-chatgpt)

### Recomendação

- **Protótipo sem PHI e mantido no Sites:** avaliar Sign in with ChatGPT, desde
  que seja definido como obter uma identidade externa estável. Não criar
  ownership somente pelo e-mail.
- **Produto real com dados cuja classificação impeça Sites:** selecionar
  hospedagem apropriada e um provedor OIDC gerenciado, mantendo a mesma camada
  interna de usuários, famílias e papéis.
- não hospedar senhas no FamilyCare na primeira versão.

### Fluxos

**Criação de conta**

1. Provedor autentica ou cadastra a pessoa.
2. Servidor valida emissor, audiência, estado/nonce e identidade verificada.
3. FamilyCare localiza por `auth_provider + auth_subject`.
4. Se não existir, cria `users` após aceite dos termos e aviso de privacidade.
5. E-mail e nome são atributos, não ownership.

**Login**

- sempre concluído no servidor;
- proteção contra CSRF/state e replay;
- rotação de sessão após autenticação;
- resposta não inclui token persistente em `localStorage`.

**Logout**

- revoga sessão local, quando existente;
- remove cookie com os mesmos atributos de criação;
- aciona logout do provedor apenas se essa for a experiência aprovada.

**Recuperação**

- delegada ao provedor;
- alteração de e-mail não transfere ownership automaticamente;
- recuperação de acesso ao grupo é um fluxo administrativo separado e auditado.

**Expiração de sessão**

- inatividade proposta: 30 minutos para operações sensíveis;
- duração absoluta proposta: 12 horas;
- reautenticação recente, por exemplo até 10 minutos, para exportação total,
  transferência, exclusão de grupo e mudanças de administrador;
- valores finais dependem de aprovação.

**Proteção e revogação**

- cookie `HttpOnly`, `Secure`, `SameSite=Lax` ou mais estrito;
- proteção CSRF em mutações;
- CSP restritiva, prevenção de XSS e ausência de tokens em URLs/logs;
- hash de tokens de sessão no banco;
- rotação após login e elevação de privilégio;
- lista de sessões e “sair de todos os dispositivos”, se houver sessão própria;
- revogação de vínculo aplicada em toda requisição, mesmo com sessão válida.

## 6. Autorização

### Regra central

Toda consulta começa pela identidade autenticada e por um vínculo ativo:

```text
request identity
  -> users
  -> family_members WHERE user_id = ? AND family_id = ? AND status = 'active'
  -> regra do papel
  -> consulta/mutação com family_id = ?
```

### Controles obrigatórios

- validar identidade, família e papel no servidor;
- nunca confiar em `familyId`, `relativeId`, papel ou owner enviados pelo cliente;
- buscar registros por `(family_id, id)`, não apenas por `id`;
- não retornar diferença observável entre ID inexistente e ID não autorizado;
- validar payloads no servidor, inclusive tamanho e formato de JSON;
- usar statements parametrizados;
- aplicar optimistic concurrency com `version` para evitar sobrescrita;
- proteger mutações contra CSRF;
- limitar taxa de login, convite, PIN, links e operações destrutivas;
- registrar acessos negados relevantes sem dados clínicos;
- testar IDOR trocando IDs entre duas famílias em todos os endpoints.

### Operações destrutivas

- exclusão de medicamento/familiar: papel mínimo `caregiver`, confirmação e
  auditoria;
- revogação, convite e papel: `admin`;
- transferência, exportação total e exclusão do grupo: `admin`, reautenticação
  recente e confirmação reforçada;
- exclusão do grupo deve entrar em `pending_deletion` antes da purga;
- ações em lote devem ter limite e idempotency key.

## 7. Migração do `localStorage`

### Fluxo proposto

1. **Detecção:** após login, verificar `familycare-family` sem enviar dados.
2. **Prévia:** validar com a lógica compatível existente e mostrar contagens de
   familiares/medicamentos e campos inválidos.
3. **Consentimento:** explicar destino, grupo alvo, compartilhamento e o que
   acontecerá com a cópia local.
4. **Preparação:** atribuir `source_device_id`, `idempotency_key` e hash do
   conteúdo; manter IDs locais como `import_source_id`.
5. **Validação no servidor:** repetir toda validação; rejeitar campos/tamanhos
   inválidos e nunca confiar na validação do navegador.
6. **Importação transacional:** criar `migration_imports`, familiares e
   medicamentos no grupo autorizado.
7. **Idempotência:** a repetição retorna o resultado anterior; constraints
   impedem duplicatas por `family_id + import_source_id`.
8. **Confirmação:** servidor devolve contagens, IDs e hash confirmados.
9. **Recuperação:** em timeout/falha, manter `localStorage`, permitir consulta de
   status e repetição segura.
10. **Remoção local:** somente depois de confirmação do servidor e consentimento
    final; oferecer exportação local antes da remoção.

Não misturar automaticamente dados locais com um grupo existente sem mostrar o
destino. Se houver conflitos, oferecer: ignorar duplicado, importar como novo ou
cancelar; nunca sobrescrever silenciosamente.

## 8. Privacidade e operação

### Exportação

- disponível ao usuário para grupos autorizados;
- formato documentado e portável, como JSON e opcionalmente CSV;
- exportação completa exige administrador e reautenticação;
- arquivo gerado deve ter expiração curta e não usar URL pública permanente;
- registrar quem exportou e quando, sem registrar o conteúdo.

### Exclusão e retenção

- separar “remover meu acesso”, “excluir minha conta” e “excluir o grupo”;
- definir janela de recuperação antes da purga;
- apagar tokens e sessões imediatamente;
- purgar dados clínicos e identificadores conforme política aprovada;
- documentar por quanto tempo auditoria e backups permanecem;
- pedidos de exclusão não podem depender apenas de esconder linhas na interface.

### Backups

Se D1 for aprovado em ambiente compatível, dados são cifrados em repouso e em
trânsito. Time Travel oferece recuperação pontual por período limitado, mas
restauração é uma operação destrutiva e dados excluídos podem continuar no
histórico até a expiração. Isso precisa constar da política de retenção.
[Segurança do D1](https://developers.cloudflare.com/d1/reference/data-security/)
[Time Travel e backups](https://developers.cloudflare.com/d1/reference/time-travel/)

O plano deve incluir:

- teste periódico de restauração em ambiente isolado;
- acesso operacional mínimo e auditado;
- procedimento para incidente e restauração;
- política de retenção além da janela nativa, se necessária;
- confirmação de localização antes de criar o banco, pois decisões de jurisdição
  podem ser imutáveis após a criação.
  [Localização no D1](https://developers.cloudflare.com/d1/configuration/data-location/)

### Auditoria

Registrar:

- login/logout/revogação;
- convite, aceite e mudança de papel;
- criação, alteração e exclusão de registros, por IDs;
- geração, uso e revogação de acesso de emergência;
- exportação, solicitação de exclusão e transferência.

Não registrar:

- nome de familiar;
- data de nascimento;
- tipo sanguíneo, condições, alergias ou medicamentos;
- observações;
- corpo de formulários/respostas;
- token, cookie, PIN, link ou QR Code;
- conteúdo de exportação;
- e-mail completo quando um ID interno atende ao objetivo.

### Minimização

- manter somente campos usados pelo produto;
- não coletar documentos, endereço, telefone ou localização sem finalidade
  aprovada;
- tornar observações livres opcionais e limitar seu tamanho;
- não enviar dados clínicos a analytics, error tracking ou suporte;
- sanitizar erros e desabilitar captura de payload;
- revisar dados de teste para evitar informação real.

## 9. Plano de implementação

Cada etapa deve ser pequena, testável, reversível e protegida por feature flag.

### Etapa 0 — decisões e elegibilidade

- classificar dados e público pretendido;
- decidir se Sites é um ambiente permitido;
- escolher autenticação, política de emergência, retenção e papéis;
- produzir threat model e critérios de aceite;
- manter aplicação local sem mudanças até aprovação.

**Saída reversível:** documento aprovado, sem infraestrutura.

### Etapa 1 — contratos de domínio e API

- separar tipos persistidos de tipos de formulário;
- definir schemas de validação de request/response;
- especificar endpoints e erros sem implementar armazenamento;
- criar testes de autorização com duas famílias fictícias.

**Rollback:** remover feature flag; MVP local continua.

### Etapa 2 — identidade em ambiente isolado

- integrar o provedor escolhido em branch/ambiente de teste;
- mapear identidade externa para `users`;
- implementar login, logout, recuperação e expiração;
- provar que e-mail não é a chave de ownership;
- não acessar dados clínicos.

**Rollback:** desativar feature flag de login.

### Etapa 3 — schema e migrations revisadas

- transformar este modelo em schema Drizzle;
- criar migrations somente nessa tarefa futura;
- revisar constraints, índices e política de localização antes de criar D1;
- testar migrations do zero e rollback operacional.

**Rollback:** nenhum binding em produção até aprovação.

### Etapa 4 — autorização server-side

- implementar serviço central de membership/papéis;
- cobrir IDOR, CSRF, último administrador e operações destrutivas;
- adicionar auditoria minimizada;
- fazer revisão de segurança antes de dados reais.

**Rollback:** endpoints persistentes permanecem indisponíveis.

### Etapa 5 — persistência em paralelo

- criar repositórios server-side;
- iniciar com leitura/gravação apenas em ambiente de teste;
- comparar serialização com `Relative`/`Medication`;
- manter UI e store local como caminho padrão;
- testar concorrência e falhas.

**Rollback:** desligar feature flag de persistência.

### Etapa 6 — migração opt-in do `localStorage`

- implementar detecção e prévia;
- importar em grupo vazio de teste;
- testar repetição, timeout, conflito e recuperação;
- nunca apagar dados locais automaticamente;
- piloto com dados sintéticos.

**Rollback:** cópia local permanece intacta.

### Etapa 7 — troca controlada da fonte de verdade

- habilitar por usuário/grupo piloto;
- monitorar erros sem payload clínico;
- oferecer exportação e suporte de rollback;
- só então desativar gravação completa em `localStorage`.

**Rollback:** exportar servidor e restaurar fluxo local compatível.

### Etapa 8 — emergência autenticada

- lançar somente login obrigatório;
- medir necessidade real de compartilhamento temporário;
- implementar link/QR/cache apenas após nova aprovação e threat model.

### Etapa 9 — privacidade e operação

- implementar exportação, exclusão, retenção e sessões;
- testar restauração e resposta a incidente;
- revisar política, textos e contratos;
- auditoria externa de segurança antes de uso amplo.

## Decisões que exigem aprovação do proprietário

1. Se os dados e o uso pretendido podem permanecer no ChatGPT Sites ou exigem
   outra hospedagem.
2. Jurisdição, localização e requisitos de residência dos dados.
3. Provedor de autenticação: Sign in with ChatGPT ou OIDC gerenciado.
4. Identificador estável aceito para vincular a conta; e-mail não é recomendado.
5. Se o Site será público com login interno ou restrito pela audiência do Sites.
6. Papéis finais e se cuidadores podem excluir familiares/medicamentos.
7. Regras de convite, compatibilidade de e-mail e concessão de administrador.
8. Fluxo e confirmação para transferência de administração.
9. Política inicial do modo emergência e campos visíveis.
10. Uso futuro de link, QR Code, PIN e/ou cache offline.
11. Prazo, uso único e regras de revogação do acesso temporário.
12. Inatividade, duração absoluta e reautenticação de sessão.
13. Janela de recuperação, retenção e purga de dados excluídos.
14. Retenção de auditoria, logs e backups.
15. Formatos e papéis autorizados para exportação.
16. Estratégia de conflitos e destino na migração do `localStorage`.
17. Momento em que a cópia local pode ser removida.
18. Critérios de piloto, revisão de segurança e autorização para dados reais.
