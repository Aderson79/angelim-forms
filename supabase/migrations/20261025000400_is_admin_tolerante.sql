-- Compara e-mails ignorando espaços e maiúsculas dos dois lados, para um detalhe
-- de digitação no cadastro não bloquear o acesso de um admin liberado.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admins
    where lower(btrim(email)) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

create or replace function public.assert_admin() returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  return lower(btrim(auth.jwt() ->> 'email'));
end $$;

update public.admins set email = lower(btrim(email)) where email <> lower(btrim(email));
