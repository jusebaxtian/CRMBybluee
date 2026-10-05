-- La audiencia de una campaña devuelve cada contacto UNA vez.
--
-- El fallo, reportado el 5 oct 2026 por la línea de citytours: en la vista
-- previa de la campaña salían 4 contactos para una etiqueta que tiene 2, y al
-- darle Enviar salían 0.
--
-- La causa. La función unía cada contacto con TODAS sus conversaciones. Desde
-- que un espacio puede tener varias líneas de WhatsApp, un contacto tiene una
-- conversación por línea, así que uno que escribió a las 3 líneas salía 3
-- veces: 1 + 3 = 4 filas para 2 contactos.
--
-- Y al guardar la campaña, `campaign_recipients` no admite el mismo contacto
-- dos veces (unique campaign_id, contact_id). Postgres rechazaba el lote
-- entero y el código no revisaba el error: la campaña quedaba creada, vacía,
-- sin aviso. Había 7 borradores así en citytours y 3 en GC Solutions.
--
-- Ahora se agrupa por contacto. La ventana de 24 horas queda abierta si el
-- contacto escribió en cualquiera de sus conversaciones, que es lo que ya
-- significaba antes para un contacto de una sola línea.
--
-- También se ordena por contacto: la aplicación pide la lista por páginas de
-- 1.000 con .range(), y sin un orden fijo dos páginas podían repetir o
-- saltarse filas.
create or replace function public.resolve_campaign_recipients(
  p_workspace_id uuid,
  p_include_tag_ids uuid[] default null,
  p_exclude_tag_ids uuid[] default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null
)
returns table (contact_id uuid, has_open_window boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as contact_id,
    coalesce(bool_or(li.created_at > now() - interval '24 hours'), false) as has_open_window
  from contacts c
  left join conversations conv on conv.contact_id = c.id and conv.workspace_id = p_workspace_id
  left join lateral (
    select created_at from messages m
    where m.conversation_id = conv.id and m.direction = 'in'
    order by created_at desc
    limit 1
  ) li on true
  where c.workspace_id = p_workspace_id
    and c.likely_blocked = false
    and (p_created_from is null or c.created_at >= p_created_from)
    and (p_created_to is null or c.created_at <= p_created_to)
    and (
      p_include_tag_ids is null or array_length(p_include_tag_ids, 1) is null
      or exists (
        select 1 from contact_tags ct
        where ct.contact_id = c.id and ct.tag_id = any(p_include_tag_ids)
      )
    )
    and not exists (
      select 1 from contact_tags ct
      join tags t on t.id = ct.tag_id
      where ct.contact_id = c.id
        and (
          (p_exclude_tag_ids is not null and ct.tag_id = any(p_exclude_tag_ids))
          or t.excludes_followups = true
        )
    )
  group by c.id
  order by c.id;
$$;

select pg_notify('pgrst', 'reload schema');
