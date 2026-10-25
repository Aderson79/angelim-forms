# Decisões do projeto

Registro das decisões tomadas para o formulário de doações da Ceia de Natal 2025 (Missão Angelim) e do motivo de cada uma.

## Stack e infraestrutura

| Decisão | Motivo |
|---|---|
| **Next.js 16** (App Router, TypeScript, Tailwind v4) | Formulário público e painel admin no mesmo projeto |
| **Supabase** (Postgres + Auth + RLS) | Plano grátis atende o volume. Login pronto e transações seguras para o limite de itens |
| **Vercel** | Grátis, com deploy automático a cada push na `main` |
| Migrações aplicadas pela **integração GitHub do Supabase** | Cada push na `main` roda os arquivos novos de `supabase/migrations`. As migrações são idempotentes |
| Supabase: projeto `qeskedgteaseiwwbeihg` · Vercel: projeto `angelim-forms` | Ambos ligados ao repositório `Aderson79/angelim-forms` |
| Arquivos `.env*` fora do repositório | As chaves ficam só no `.env.local` de cada máquina e nas variáveis da Vercel |

## Itens e limites

Fonte: planilha de limites + PDF "Lista final de insumos". Quando divergem:

| Item | Decisão |
|---|---|
| Creme de leite | **45 doações de 4 caixas** (PDF). A planilha dizia 18 de 10. O total de 180 caixas é o mesmo |
| Batata | **Batata inglesa 2kg × 40** (planilha). O PDF tinha o erro "2kg de cenoura" |
| Colher grande para refeição 100 unid | **× 30**. Está na planilha, mas não no PDF; foi mantida |
| Itens via PIX | **Frango 2kg (R$ 37,00)** e **Embalagens de quentinha 100 unid (R$ 38,00)**. Todos os outros são entrega física |

Total: 26 itens em 4 categorias (Estrogonofe de frango, Salada, Arroz, Materiais). Limites, itens novos e ativação podem ser alterados pelo painel em **Itens**.

## Conteúdo do formulário

- Textos e contatos seguem os formulários de referência (Google Forms).
- Contatos: **Janaína (86) 9 8800-6865** e **Carol (86) 9 9814-6020**. Chave PIX: `institutovidaabencoada@gmail.com`.
- Datas, local e horários de entrega **não ficam no código**. São editáveis em **Configurações** porque ainda serão definidos. Enquanto isso, todos aparecem como **"A definir"**. Os textos usam o formato rótulo + valor ("Prazo: …", "Local: …") para funcionar tanto com "A definir" quanto com o valor real.

## Regras de negócio

- **O limite nunca é ultrapassado.** O envio trava as linhas dos itens no banco (`FOR UPDATE`), então duas pessoas disputando o último saldo são atendidas uma de cada vez.
- O formulário atualiza o saldo a cada 20s e ao voltar para a aba. Se o saldo cair abaixo do que a pessoa escolheu, a quantidade é ajustada e ela é avisada.
- **Nada é apagado.** Anular exige motivo e devolve o saldo. Restaurar só é permitido se ainda houver saldo.
- O limite de um item não pode ficar abaixo do que já foi prometido.
- Cada doação recebe um **protocolo** sequencial (#0001…). Pode haver saltos na numeração, o que é normal no Postgres e não indica perda.
- O formulário tem um campo "honeypot" invisível contra robôs.

## Segurança e acesso

- O formulário é público, sem login.
- O painel `/admin` exige login por e-mail e senha (Supabase Auth). Só e-mails cadastrados na tabela `admins` veem dados.
- Admin inicial: **meskytaaderson@hotmail.com**. Novos admins: criar o usuário no Supabase e rodar `insert into admins(email) values ('...');`.
- RLS em todas as tabelas. O público só lê itens e configurações. Todas as escritas passam por funções do banco que verificam `is_admin()` e registram a ação na auditoria.

## Auditoria (escopo da v1)

Incluído:
- **Essenciais:** anular com motivo e restaurar, status de recebimento por item (recebido / PIX confirmado), log de auditoria, painel de progresso, exportação para Excel (CSV), busca e filtros.
- **Úteis:** WhatsApp com mensagem pronta, alerta de possíveis duplicados (mesmo telefone ou e-mail), edição de dados e quantidades, gestão de itens e limites, abrir/fechar o formulário (manual ou por data).

Fora da v1 (opcionais): anti-spam com captcha e limite por IP, perfis separados (visualizador × admin), lista de conferência para impressão.

## Identidade visual

Baseada em angelim.org:
- Cores: grafite `#232325`, verde `#3b7a52` e vinho `#9b2737`.
- Hero: **fundo grafite** (igual ao site) com neve sutil. O toque natalino é **só no texto**, em vermelho `#e5394e` ("ceia de Natal", rótulos). Fundo vermelho foi testado e descartado por lembrar identidade partidária.
- Fontes: Bebas Neue nos títulos e Montserrat no texto.
- Logo provisória em `public/logo-angelim.png`.
