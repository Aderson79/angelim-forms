-- Corrige categoria, nome e valor PIX de um item cadastrado errado.
-- As doações apontam para o id do item, então já passam a mostrar o nome corrigido.
create or replace function public.admin_edit_item(
  p_id int, p_category text, p_name text, p_pix_price numeric
) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_actor text := assert_admin();
  it items;
begin
  if length(btrim(coalesce(p_name, ''))) < 2 or length(btrim(coalesce(p_category, ''))) < 2 then
    raise exception 'INVALID_NAME';
  end if;
  select * into it from items where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  update items set category = btrim(p_category), name = btrim(p_name), pix_price = nullif(p_pix_price, 0)
  where id = p_id;

  insert into audit_log(actor, action, details)
  values (v_actor, 'item_editado', jsonb_build_object(
    'antes', jsonb_build_object('categoria', it.category, 'nome', it.name, 'pix', it.pix_price),
    'depois', jsonb_build_object('categoria', btrim(p_category), 'nome', btrim(p_name), 'pix', nullif(p_pix_price, 0)::numeric(10,2))));
end $$;

revoke execute on function public.admin_edit_item(int, text, text, numeric) from public, anon;
grant execute on function public.admin_edit_item(int, text, text, numeric) to authenticated;
