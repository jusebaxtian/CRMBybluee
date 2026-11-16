-- 0182: cuenta con el plan vencido = todo lo automatico en pausa (16 nov 2026).
-- La misma regla que src/lib/billing/pausa.ts: vencida, cancelada, suspendida o
-- con el acceso desactivado. Aqui la usan los mensajes programados, que se
-- toman desde la base: los de una cuenta pausada se quedan "pendiente" y salen
-- cuando pague, en vez de gastarse como fallidos.
begin;

create or replace function public.espacio_pausado(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select w.access_disabled or w.status in ('past_due', 'canceled', 'suspended')
       from public.workspaces w where w.id = p_workspace),
    false);
$$;
revoke all on function public.espacio_pausado(uuid) from public, anon, authenticated;
grant execute on function public.espacio_pausado(uuid) to service_role;

create or replace function public.tomar_mensajes_programados(p_limite integer default 20)
returns setof public.mensajes_programados
language plpgsql
security definer
set search_path = public
as $$
begin
  update mensajes_programados set estado = 'fallido', error = 'Se interrumpió el envío. Revisa el chat antes de programarlo de nuevo.'
  where estado = 'enviando' and enviado_el < now() - interval '10 minutes';

  return query
  update mensajes_programados m set estado = 'enviando', enviado_el = now()
  where m.id in (
    select p.id from mensajes_programados p
    where p.estado = 'pendiente' and p.enviar_en <= now()
      and not public.espacio_pausado(p.workspace_id)
    order by p.enviar_en
    limit p_limite
    for update skip locked
  )
  returning m.*;
end;
$$;
revoke all on function public.tomar_mensajes_programados(integer) from public, anon, authenticated;
grant execute on function public.tomar_mensajes_programados(integer) to service_role;

select pg_notify('pgrst', 'reload schema');

commit;
