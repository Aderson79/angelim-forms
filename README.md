# Doações para a Ceia de Natal 2025 · Missão Angelim

Formulário público de doações com limite por item e painel administrativo com relatório e auditoria.

- **Formulário (`/`)**: sem login. Mostra o saldo de cada item em tempo real e não permite passar do limite. Duas pessoas disputando o último saldo são serializadas no banco, então só uma consegue.
- **Painel (`/admin`)**: exige login de um e-mail cadastrado na tabela `admins`.
  - **Painel**: progresso por item (recebido, prometido e disponível), PIX esperado × confirmado e exportação consolidada.
  - **Doações**: busca e filtros, marcar item recebido ou PIX confirmado, editar dados e quantidades, anular com motivo e restaurar, WhatsApp com mensagem pronta, alerta de possíveis duplicados e exportação para Excel (CSV).
  - **Itens**: alterar limites, ativar/desativar e criar itens.
  - **Configurações**: abrir/fechar o formulário (inclusive por data), prazos, local, horários, chave PIX e contatos.
  - **Auditoria**: histórico de tudo o que foi feito, por quem e quando.

Stack: Next.js 16 + Supabase (Postgres, Auth, RLS) + Vercel. O e-mail com a cópia é enviado pelo Resend (opcional).

## Configuração

### 1. Banco (Supabase)

As migrações ficam em [supabase/migrations](supabase/migrations). Com a integração GitHub do Supabase ativa, elas rodam a cada push na `main`. Sem a integração, cole os arquivos em ordem no **SQL Editor** do Supabase. Eles são idempotentes: rodar de novo não quebra nada.

### 2. Usuário administrador

1. Supabase → **Authentication → Users → Add user → Create new user**: e-mail `meskytaaderson@hotmail.com`, uma senha e **Auto Confirm User** marcado.
2. Supabase → **Authentication → Sign In / Providers**: desligue **Allow new users to sign up**. Ninguém de fora consegue criar conta.
3. Para dar acesso a outra pessoa: crie o usuário e rode `insert into admins(email) values ('email@exemplo.com');`.

### 3. Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qeskedgteaseiwwbeihg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → *Publishable key* (ou a `anon` legada) |
| `RESEND_API_KEY` | *(opcional)* chave do Resend para enviar a cópia por e-mail |
| `RESEND_FROM` | *(opcional)* ex.: `Missão Angelim <doacoes@seudominio.org>`; exige domínio verificado no Resend |

Sem `RESEND_API_KEY`, o formulário funciona normalmente, só não envia e-mail.

### 4. Desenvolvimento local

Crie um `.env.local` (ignorado pelo git) com as variáveis da tabela acima e rode:

```bash
npm install
npm run dev
```

Decisões do projeto e pendências estão em [docs/](docs/).
