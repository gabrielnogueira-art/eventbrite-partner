## Visão geral

Sistema de venda de ingressos para eventos de Empresas Juniores, com dois painéis (usuário comprador e administrador), inspirado nas telas EVNTTZ enviadas. Backend via Lovable Cloud (auth + banco + storage + edge functions).

## Funcionalidades — Usuário (EJ)

- **Login/Cadastro** (email + senha)
- **Painel de eventos**: grid com capa, organizador, título, data e local + busca textual
- **Página do evento**: capa, descrição, local (endereço), datas, lista de lotes ativos com preço e seletor de quantidade (limite definido pelo admin, padrão 5)
- **Checkout (15 min de reserva)**:
  - Formulário de participantes (nome + email por ingresso)
  - Dados de cobrança (CPF/CNPJ, telefone, endereço completo)
  - Escolha de pagamento: PIX (QR code mock) ou Cartão
  - Timer regressivo; ao expirar, ingressos liberados
- **Meus ingressos**: lista de pedidos e status (reservado, pago, cancelado, expirado)

## Funcionalidades — Administrador

- **Login separado** (mesma tela, papel detectado via `user_roles`)
- **Dashboard admin** com lista de eventos e métricas básicas (vendidos, receita)
- **Criar/editar evento**: capa (upload), organizador, título, descrição, local, endereço, datas início/fim, política de cancelamento, máximo de ingressos por usuário
- **Gerenciar lotes** (até ~5 por evento): nome, preço, quantidade total, data/hora de abertura, data/hora de encerramento
- **Ver pedidos** de cada evento

## Liberação automática de reservas

Edge function agendada (ou checada on-read) marca pedidos `pending` com mais de 15 min como `expired` e devolve as quantidades ao estoque do lote.

## Modelo de dados (resumo técnico)

- `profiles` (id, full_name, email)
- `user_roles` (user_id, role: 'admin' | 'user') — separado, com `has_role()` SECURITY DEFINER
- `events` (id, title, organizer, description, cover_url, location_name, address, starts_at, ends_at, cancellation_policy, max_tickets_per_user, created_by)
- `ticket_lots` (id, event_id, name, price_cents, total_quantity, sold_quantity, opens_at, closes_at)
- `orders` (id, user_id, event_id, lot_id, quantity, status, payment_method, total_cents, reserved_until, paid_at, billing_*)
- `order_participants` (id, order_id, full_name, email)
- Storage bucket `event-covers` (público para leitura)
- RLS: usuário vê só seus pedidos; admin (via `has_role`) gerencia eventos/lotes/pedidos; eventos e lotes públicos para leitura autenticada

## Rotas

```text
/auth                       login/cadastro
/                           painel de eventos (usuário)
/events/$id                 detalhes + seleção de ingressos
/checkout/$orderId          formulário + pagamento (timer)
/my-tickets                 meus pedidos
/admin                      dashboard admin
/admin/events/new           criar evento
/admin/events/$id           editar evento + lotes + pedidos
```

## Pagamento

Mock nesta primeira versão: PIX gera QR code fictício e botão "Confirmar pagamento" (simulação); Cartão simula aprovação imediata. Integração real com Stripe/Mercado Pago pode ser adicionada depois.

## Design

Paleta inspirada nos prints: azul vibrante (#2B7FFF) como primary, fundo claro neutro, cards com sombra suave, badges coloridos para organizador. Tipografia sans moderna (Inter).

## Logins de teste

Ao final, criarei via migration (seed) e te entrego:
- **Admin**: admin@portalej.test / Admin123!
- **Usuário**: user@portalej.test / User123!

## Fora do escopo desta primeira versão

- Limite de ingressos por usuário com base em base externa (futuro)
- Integração real com gateway de pagamento
- Envio real de email com ingressos (apenas registro no banco)
- Cancelamento/reembolso pelo usuário
