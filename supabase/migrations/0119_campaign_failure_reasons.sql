-- Motivo de fallo predominante de cada campaña, para poder mostrarlo al pasar
-- el cursor sobre "Falló"/"fallidos" en la lista de campañas sin abrir el
-- envío. Se agrupa en SQL por lo mismo que campaign_recipient_counts (0076):
-- traer campaign_recipients directo se topa con el límite de 1000 filas de
-- PostgREST en cualquier campaña grande.
create or replace function campaign_failure_reasons(p_workspace_id uuid)
returns table (
  campaign_id uuid,
  reason text,
  reason_count bigint,
  failed_count bigint,
  distinct_reasons bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with fallos as (
    select
      cr.campaign_id,
      coalesce(nullif(trim(cr.error_message), ''), 'Sin motivo registrado') as reason,
      count(*) as reason_count
    from campaign_recipients cr
    join campaigns c on c.id = cr.campaign_id
    where c.workspace_id = p_workspace_id
      and cr.status = 'failed'
      and (is_workspace_member(p_workspace_id) or is_platform_admin())
    group by 1, 2
  ),
  ordenados as (
    select
      f.*,
      sum(f.reason_count) over (partition by f.campaign_id) as failed_count,
      count(*) over (partition by f.campaign_id) as distinct_reasons,
      row_number() over (partition by f.campaign_id order by f.reason_count desc, f.reason) as rn
    from fallos f
  )
  select campaign_id, reason, reason_count, failed_count, distinct_reasons
  from ordenados
  where rn = 1;
$$;

grant execute on function campaign_failure_reasons(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
