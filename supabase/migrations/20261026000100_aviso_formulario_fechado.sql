-- Qual aviso aparece quando o formulário está fechado:
-- 'em_breve' (as doações ainda não abriram) ou 'encerrado' (a campanha acabou).
alter table public.settings
  add column if not exists closed_notice text not null default 'em_breve';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_closed_notice_check') then
    alter table public.settings
      add constraint settings_closed_notice_check check (closed_notice in ('em_breve', 'encerrado'));
  end if;
end $$;

create or replace function public.admin_update_settings(p jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_actor text := assert_admin();
  v_old settings;
begin
  select * into v_old from settings where id = 1;
  update settings set
    form_open = coalesce((p ->> 'form_open')::boolean, form_open),
    closed_notice = coalesce(p ->> 'closed_notice', closed_notice),
    closes_at = case when p ? 'closes_at' then nullif(p ->> 'closes_at', '')::timestamptz else closes_at end,
    delivery_deadline = coalesce(p ->> 'delivery_deadline', delivery_deadline),
    delivery_place = coalesce(p ->> 'delivery_place', delivery_place),
    morning_hours = coalesce(p ->> 'morning_hours', morning_hours),
    afternoon_hours = coalesce(p ->> 'afternoon_hours', afternoon_hours),
    pix_deadline = coalesce(p ->> 'pix_deadline', pix_deadline),
    pix_key = coalesce(p ->> 'pix_key', pix_key),
    contacts = coalesce(p -> 'contacts', contacts),
    updated_at = now()
  where id = 1;
  insert into audit_log(actor, action, details)
  values (v_actor, 'configuracoes_alteradas', jsonb_build_object('antes', to_jsonb(v_old), 'alteracoes', p));
end $$;
