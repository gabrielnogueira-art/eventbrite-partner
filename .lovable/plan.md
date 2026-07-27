# Plano de Implementação

Vou entregar tudo em uma sequência de mudanças coesas. Divisão em blocos:

## 1. Banco de dados (uma migration)

- `events`: adicionar `caravan_regions text[]` (padrão `{}`). Se vazio ou nulo → nenhuma caravana; se preenchido → checkbox de caravana aparece apenas para EJs cujas regiões estão na lista.
- `order_participants.phone`: já existe; torná-lo obrigatório (NOT NULL) apenas em novos inserts (validação no frontend, sem constraint quebrando dados antigos).
- `ej_directory`: adicionar RLS já existe; garantir CRUD via admin.
- Nada de mudar `profiles` (já tem `ej_name`, `ej_slug`, `region`).

## 2. Checkout — telefone obrigatório e caravana condicional

- `ParticipantFields.tsx`: mover campo **Telefone** para fora do bloco de caravana e marcá-lo como obrigatório sempre.
- `checkout.$orderId.tsx`: validar telefone em todos os participantes. Passar `requireCaravan` = `profile.region ∈ event.caravan_regions`.

## 3. Admin — eventos

- `admin.events.new.tsx` e `admin.events.$id.tsx`:
  - Adicionar multi-select de **Regiões com caravana** (checkboxes: Norte, Sul, Centro Sul 1, Centro Sul 2, Centro Norte).
  - Permitir alterar a **capa** do evento na edição (mesmo componente de upload usado na criação).

## 4. Perfil da EJ (usuário)

- Nova rota `/_authenticated/profile.tsx`: formulário para editar `full_name`, `ej_name`, `region` (select das 5 regiões). Salva em `profiles`.
- Link "Meu Perfil" na sidebar (`AppShell.tsx`) para não-admins.

## 5. Redefinição de senha

- Em `/auth`: link "Esqueci minha senha" que chama `resetPasswordForEmail` com `redirectTo: origin + "/reset-password"`.
- Nova rota pública `/reset-password.tsx`: form que chama `supabase.auth.updateUser({ password })`.

## 6. Login com Google

- Chamar `supabase--configure_social_auth` com `providers: ["google"]`.
- Botão "Entrar com Google" em `/auth` usando `lovable.auth.signInWithOAuth("google", { redirect_uri: origin + "/auth/callback" })`.
- Nova rota pública `/auth/callback.tsx`: aguarda sessão; se o perfil ainda não tem `ej_slug`, redireciona para `/onboarding` para o usuário escolher a EJ na lista `ej_directory`; caso contrário, para `/`.
- Nova rota `/_authenticated/onboarding.tsx`: combobox de EJs (busca por nome), salva `ej_name`, `ej_slug`, `region` em `profiles`.

## 7. Admin — gerenciar EJs cadastradas (perfis de usuários)

- Nova rota `/_authenticated/admin.ejs.tsx`: lista todos os `profiles` (via admin RLS já existente) mostrando EJ, e-mail, região; select para trocar a região.

## 8. Admin — gerenciar diretório de EJs Federadas

- Nova rota `/_authenticated/admin.directory.tsx`: CRUD sobre `ej_directory` (adicionar, editar nome/slug/região, excluir). RLS admin já existe.
- Atualizar o diretório com base no PDF anexo (reprocessar `Região_das_EJs-2.pdf` e inserir/atualizar registros faltantes).

## 9. Sidebar

- Adicionar itens: "Meu Perfil" (todos), "EJs Cadastradas" e "Diretório de EJs" (admin).

## Detalhes técnicos

- Regiões canônicas: `["Norte","Centro Norte","Centro Sul 1","Centro Sul 2","Sul"]` — constante em `src/lib/regions.ts` para reutilizar.
- Uso do PDF: fazer parse via `document--parse_document` para atualizar `ej_directory` (insert/upsert por `slug`).
- Google OAuth: `redirect_uri` deve ser rota pública (`/auth/callback`), nunca `/`.
- `handle_new_user` já usa `ej_directory` para preencher região; login Google entra com metadata vazia e cai no fluxo de onboarding.

Confirma que posso seguir?
