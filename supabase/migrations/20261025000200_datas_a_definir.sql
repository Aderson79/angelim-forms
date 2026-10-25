-- Datas, local e horários ainda não foram definidos: passam a exibir "A definir".
-- Só substitui os valores iniciais, preservando qualquer edição feita pelo painel.

alter table public.settings
  alter column delivery_deadline set default 'A definir',
  alter column delivery_place set default 'A definir',
  alter column morning_hours set default 'A definir',
  alter column afternoon_hours set default 'A definir',
  alter column pix_deadline set default 'A definir';

update public.settings set
  delivery_deadline = case when delivery_deadline = '14/12/2025' then 'A definir' else delivery_deadline end,
  delivery_place = case when delivery_place = 'Campus Expedicionários' then 'A definir' else delivery_place end,
  morning_hours = case when morning_hours = '08h00 às 12h00' then 'A definir' else morning_hours end,
  afternoon_hours = case when afternoon_hours = '14h00 às 18h00' then 'A definir' else afternoon_hours end,
  pix_deadline = case when pix_deadline = '14/12/2025' then 'A definir' else pix_deadline end,
  updated_at = now()
where id = 1;
