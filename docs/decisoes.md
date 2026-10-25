# Decisões do projeto

Registro das decisões tomadas para o formulário de doações da Ceia de Natal 2026 (Missão Angelim) e do motivo de cada uma.

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
- **Não dá para confirmar sem dados e sem itens.** O botão "Confirmar doação" fica desabilitado e a barra mostra o que falta preencher. O banco também valida, então não há como burlar.
- **Resumo ao confirmar:** a pessoa vê o protocolo, seus dados, os itens via PIX com valor e total, a chave PIX, o prazo, os contatos para o comprovante e os itens de entrega física com data, local e horários. Pode copiar o resumo em texto ou imprimir / salvar em PDF.

## Segurança e acesso

- O formulário é público, sem login.
- O painel `/admin` exige login por e-mail e senha (Supabase Auth). Só e-mails cadastrados na tabela `admins` veem dados.
- Admins: **meskytaaderson@hotmail.com** e **natalsolidario@angelim.com**. Para liberar outro e-mail: criar o usuário no Supabase (Authentication → Users) e adicionar uma migração com `insert into admins(email) values ('...') on conflict do nothing;`.
- RLS em todas as tabelas. O público só lê itens e configurações. Todas as escritas passam por funções do banco que verificam `is_admin()` e registram a ação na auditoria.

## Auditoria (escopo da v1)

Incluído:
- **Essenciais:** anular com motivo e restaurar, status de recebimento por item (recebido / PIX confirmado), log de auditoria, painel de progresso, exportação para Excel (CSV), busca e filtros.
- **Úteis:** WhatsApp com mensagem pronta, alerta de possíveis duplicados (mesmo telefone ou e-mail), edição de dados e quantidades, gestão de itens e limites, abrir/fechar o formulário (manual ou por data).

Fora da v1 (opcionais): anti-spam com captcha e limite por IP, perfis separados (visualizador × admin), lista de conferência para impressão.

## Identidade visual

A página pública segue a arte do **Natal Solidário 2025** (angelim.org), porque a ceia faz parte dessa ação:
- Fundo **creme** `#f6f4dc`, letreiro **"Ceia de Natal"** em letra cursiva vermelha (Lobster) e a faixa **"• DOAÇÕES •"** em vermelho `#cf2433` com texto branco, como o "SOLIDÁRIO" da arte original.
- Selo amarelo do ano, estrelas de quatro pontas em dourado e vermelho, e "Lagoa do Piauí" em letra manuscrita (Gochi Hand).
- Faixa **vinho** `#9a1b31` atrás do topo do formulário; cabeçalhos das categorias e a barra de confirmação em **verde-floresta** `#173a1f`.
- Cartões e botões com **contorno grafite e sombra sólida deslocada**, como os botões "Faça sua doação" do site.
- Texto em Montserrat. O cabeçalho usa a logo da Angelim em preto sobre o creme. O rodapé continua grafite, igual ao site.
- O **painel admin** mantém o visual sóbrio (grafite e verde), sem os elementos natalinos.
- Histórico: o hero grafite com destaque vermelho neon foi descartado; o fundo vermelho também, por lembrar identidade partidária.
- Favicon: o círculo da árvore da logo "Igreja Angelim Teresina", só as partes brancas, com fundo e linhas vazados.

## Exportar a doação

Na tela de resumo, a pessoa pode guardar o que prometeu doar de três formas:
- **Baixar PDF:** comprovante de uma página gerado no próprio aparelho (jsPDF), com a logo, o protocolo, os itens, a chave PIX, os prazos e o local.
- **Enviar no WhatsApp:** abre o WhatsApp com o resumo pronto para mandar a si mesma ou a alguém.
- **Copiar mensagem:** o mesmo texto, para colar onde quiser.

"Imprimir" foi descartado porque funciona mal no celular.

## Testes

Testes ponta a ponta com Playwright (`tests/e2e`), usando o Edge instalado e o **Supabase real**:
formulário (bloqueio sem dados/itens, limite de saldo, doação, resumo, PDF/WhatsApp/cópia, saldo atualizado),
login, recebimento, edição, anulação/restauração, exportação CSV, limites de itens, auditoria e
configurações refletidas na página pública. As doações de teste levam "[TESTE E2E]" no nome e são anuladas no fim;
as configurações alteradas são restauradas.
