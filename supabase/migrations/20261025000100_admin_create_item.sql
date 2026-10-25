-- Permite cadastrar novos itens pelo painel administrativo.
create or replace function public.admin_create_item(
  p_category text, p_name text, p_limit int, p_pix_price numeric
) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  v_actor text := assert_admin();
  v_id int;
begin
  if length(btrim(coalesce(p_name, ''))) < 2 or length(btrim(coalesce(p_category, ''))) < 2 then
    raise exception 'INVALID_NAME';
  end if;
  if p_limit is null or p_limit < 0 then raise exception 'INVALID_QTY'; end if;

  insert into items(category, name, limit_qty, pix_price, sort_order)
  values (
    btrim(p_category), btrim(p_name), p_limit, nullif(p_pix_price, 0),
    coalesce((select max(sort_order) from items where category = btrim(p_category)),
             (select max(sort_order) from items), 0) + 1
  )
  returning id into v_id;

  insert into audit_log(actor, action, details)
  values (v_actor, 'item_criado', jsonb_build_object(
    'item', btrim(p_name), 'categoria', btrim(p_category), 'limite', p_limit, 'pix', p_pix_price));
  return v_id;
end $$;

revoke execute on function public.admin_create_item(text, text, int, numeric) from public, anon;
grant execute on function public.admin_create_item(text, text, int, numeric) to authenticated;

-- Liga o log à doação para o painel de auditoria mostrar protocolo e nome.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'audit_log_donation_id_fkey') then
    alter table public.audit_log
      add constraint audit_log_donation_id_fkey foreign key (donation_id) references public.donations(id);
  end if;
end $$;
