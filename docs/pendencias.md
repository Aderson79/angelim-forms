# Pendências

## A fazer

### Logo nova
- [ ] Receber a logo nova, de preferência em **SVG** ou PNG grande (a atual tem 150×38 px e fica pouco nítida).
- [ ] Substituir `public/logo-angelim.png`. Se mudar o nome ou a proporção, ajustar `src/components/site-chrome.tsx`.
- [ ] Opcional: gerar o favicon a partir da logo (`src/app/favicon.ico`).

### E-mail com cópia da doação (adiado)
O código já existe (`src/lib/email.ts`) e fica desligado enquanto `RESEND_API_KEY` não estiver configurada. Até lá, a confirmação na tela não menciona e-mail. Para ativar:
- [ ] Criar uma conta no [Resend](https://resend.com) e verificar um domínio (ex.: `angelim.org`).
- [ ] Na Vercel, cadastrar `RESEND_API_KEY` e `RESEND_FROM` (ex.: `Missão Angelim <doacoes@angelim.org>`) e fazer um novo deploy.
- [ ] Testar uma doação e confirmar que o e-mail chega.
- O formulário promete "será enviada uma cópia para o e-mail cadastrado". **Se o e-mail não for ativado antes de divulgar, remover essa frase** em `src/components/info-panel.tsx`.

### Datas, local e horários
- [ ] Definir as datas finais, o local e os horários de entrega e atualizá-los no painel em **Configurações** (não precisa de deploy).
- [ ] Opcional: configurar o fechamento automático do formulário por data.

### Antes de divulgar
- [ ] Na Vercel, conferir `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e fazer o deploy.
- [ ] No Supabase, desligar **Allow new users to sign up** (Authentication → Sign In / Providers).
- [ ] Fazer uma doação de teste em produção, conferir no painel e anulá-la.
- [ ] Testar o login no `/admin` e as telas do painel com dados reais.
- [ ] Opcional: domínio próprio (ex.: `doacoes.angelim.org`) apontando para a Vercel.

## Ideias para depois (fora da v1)
- Anti-spam com captcha (Cloudflare Turnstile) e limite de envios por IP.
- Perfis de acesso separados: visualizador, que só confirma entregas, e admin.
- Lista de conferência para imprimir no dia da entrega.

## Concluído
- [x] Projeto Next.js + Supabase + Vercel criado e integrado ao GitHub.
- [x] Migrações rodando automaticamente pela integração do Supabase.
- [x] Login de admin criado (meskytaaderson@hotmail.com).
- [x] Formulário público com limites por item e painel administrativo com auditoria.
