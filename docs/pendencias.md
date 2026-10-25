# Pendências

## A fazer

### Logo nova
- [ ] Receber a logo nova, de preferência em **SVG** ou PNG grande (a atual tem 150×38 px e fica pouco nítida).
- [ ] Substituir `public/logo-angelim.png`. Se mudar o nome ou a proporção, ajustar `src/components/site-chrome.tsx`.
- [x] Favicon: só o círculo da árvore (sem o nome), PNG só com as partes brancas; fundo e linhas da árvore vazados (`src/app/favicon.ico` e `icon.png`). O `apple-icon.png` mantém fundo preto porque o iOS não aceita transparência.

### E-mail com cópia da doação (adiado)
O código já existe (`src/lib/email.ts`) e fica desligado enquanto `RESEND_API_KEY` não estiver configurada. Até lá, a confirmação na tela não menciona e-mail. Para ativar:
- [ ] Criar uma conta no [Resend](https://resend.com) e verificar um domínio (ex.: `angelim.org`).
- [ ] Na Vercel, cadastrar `RESEND_API_KEY` e `RESEND_FROM` (ex.: `Missão Angelim <doacoes@angelim.org>`) e fazer um novo deploy.
- [ ] Testar uma doação e confirmar que o e-mail chega.
- [ ] Readicionar no `InfoPanel` (`src/components/info-panel.tsx`), abaixo de "Fique atento aos prazos…", a frase que foi removida enquanto o e-mail está desligado:
  > **OBS.:** Ao confirmar o preenchimento do formulário será enviada uma cópia para o e-mail cadastrado.

### Datas, local e horários
Hoje aparecem como "A definir" no formulário, na confirmação e no e-mail.
- [ ] Definir as datas finais, o local e os horários de entrega e atualizá-los no painel em **Configurações** (não precisa de deploy).
- [ ] Opcional: configurar o fechamento automático do formulário por data.

### Antes de divulgar
- [x] Na Vercel, conferir `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e fazer o deploy.
- [ ] No Supabase, desligar **Allow new users to sign up** (Authentication → Sign In / Providers).
- [x] Doações de teste e todas as telas do painel validadas pelos testes automáticos (`npm run test:e2e`).
- [ ] **Apagar os dados de teste** (veja abaixo) para a primeira doação real ser o protocolo #0001.
- [ ] Opcional: domínio próprio (ex.: `doacoes.angelim.org`) apontando para a Vercel.

#### Apagar os dados de teste
Os testes automáticos criam doações com **"[TESTE E2E]"** no nome e as anulam no final, devolvendo o saldo.
Elas continuam no histórico como anuladas. Para apagá-las de vez, cole no **SQL Editor** do Supabase:

```sql
-- 1. Registros de auditoria das doações de teste e das alterações feitas pelos testes
delete from audit_log
where donation_id in (select id from donations where name like '%[TESTE E2E]%')
   or details::text like '%E2E%';

-- 2. Doações de teste (os itens de cada doação saem junto)
delete from donations where name like '%[TESTE E2E]%';

-- 3. Opcional: recomeça a numeração do protocolo (só se não houver doações reais)
select setval(pg_get_serial_sequence('public.donations', 'protocol'),
              coalesce((select max(protocol) from donations), 0) + 1, false);
```

Rodar os testes de novo depois disso cria novas doações de teste. Repita a limpeza antes de divulgar.

## Ideias para depois (fora da v1)
- Anti-spam com captcha (Cloudflare Turnstile) e limite de envios por IP.
- Perfis de acesso separados: visualizador, que só confirma entregas, e admin.
- Lista de conferência para imprimir no dia da entrega.

## Concluído
- [x] Projeto Next.js + Supabase + Vercel criado e integrado ao GitHub.
- [x] Migrações rodando automaticamente pela integração do Supabase.
- [x] Login de admin criado (meskytaaderson@hotmail.com).
- [x] Acesso ao painel liberado para natalsolidario@angelim.com.
- [x] Resumo da doação exportável: PDF, WhatsApp e mensagem copiada.
- [x] Testes ponta a ponta (Playwright) cobrindo formulário, painel, auditoria e configurações.
- [x] Formulário público com limites por item e painel administrativo com auditoria.
