-- Limpeza antes do lançamento: apaga as doações de teste e o histórico da auditoria
-- e recomeça a numeração (a primeira doação real será o protocolo #0001).
-- Roda uma única vez: a marca em maintenance_runs impede que dados reais sejam
-- apagados se as migrações forem executadas de novo.

create table if not exists public.maintenance_runs (
  name text primary key,
  ran_at timestamptz not null default now()
);
alter table public.maintenance_runs enable row level security;

do $$
begin
  if not exists (select 1 from public.maintenance_runs where name = 'limpeza_pre_lancamento') then
    truncate table public.audit_log, public.donation_items, public.donations restart identity;
    insert into public.maintenance_runs(name) values ('limpeza_pre_lancamento');
  end if;
end $$;
