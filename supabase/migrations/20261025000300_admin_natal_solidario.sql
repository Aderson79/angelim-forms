-- Libera o painel para a conta da equipe do Natal Solidário.
insert into public.admins(email) values ('natalsolidario@angelim.com')
on conflict do nothing;
