-- Datos para etiquetar a cada cliente del administrador como Mensual, Semestral
-- o Anual en su bandeja.
--
-- La etiqueta NO sale del plan (plans.billing_cycle): ningun plan es "anual" y
-- 31 clientes con plan mensual o semestral tienen un vencimiento a casi un ano.
-- Sale de la distancia entre el ultimo pago aprobado y el vencimiento, que es el
-- periodo que el cliente realmente compro. El calculo vive en TypeScript
-- (lib/inbox/ciclo-de-plan.ts); aqui solo se entregan los datos.
--
-- Como las demas funciones del cruce "contacto <-> espacio" (0096), solo
-- responde al administrador de la plataforma, y el cruce es el mismo: el vinculo
-- manual (workspaces.cliente_contact_id) o, si no hay, el telefono.
begin;

create or replace function admin_ciclos_de_clientes()
returns table (
  wa_id text,
  status text,
  vence timestamptz,
  ultimo_pago timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    return;
  end if;

  return query
  select c.wa_id, w.status,
    (select max(s.current_period_end) from subscriptions s where s.workspace_id = w.id),
    (select max(coalesce(p.reviewed_at, p.created_at))
       from payments p
      where p.workspace_id = w.id and p.status = 'approved')
  from workspaces w
  join contacts c
    on c.workspace_id in (select m.workspace_id from workspace_members m where m.user_id = auth.uid())
   and (c.id = w.cliente_contact_id
        or (w.cliente_contact_id is null and c.wa_id = admin_telefono_normalizado(w.phone)));
end;
$$;

revoke all on function admin_ciclos_de_clientes() from public;
grant execute on function admin_ciclos_de_clientes() to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
