-- Campanas (23 nov 2026): opcion "incluir clientes con plan".
--
-- Al enviar, una campana salta a todo contacto con una etiqueta que excluye de
-- seguimientos. Las etiquetas de plan ("Plan Pro", "Plan Anual", "Plan
-- Inicial"...) estan marcadas asi para que a los clientes no les lleguen
-- masivos de venta. Pero un masivo de acompanamiento a clientes (asesoria,
-- activar cuenta) va justo a ellos. Con esta opcion encendida, en ESA campana
-- se ignoran solo las etiquetas de plan (nombre que empieza por "Plan "); las
-- demas exclusiones siguen: Conflictivo, NO interesados, etapa No interesado,
-- bloqueados y quien pidio no recibir marketing.
--
-- Apagada por defecto: ninguna campana existente cambia.

alter table public.campaigns add column if not exists incluir_clientes_con_plan boolean not null default false;

create or replace function public.campaign_no_followup_recipient_ids__interno(p_campaign_id uuid)
returns table(contact_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct cr.contact_id
  from campaign_recipients cr
  join campaigns k on k.id = cr.campaign_id
  join contact_tags ct on ct.contact_id = cr.contact_id
  join tags t on t.id = ct.tag_id
  where cr.campaign_id = p_campaign_id
    and t.excludes_followups = true
    and not (k.incluir_clientes_con_plan and t.name ilike 'Plan %')
  union
  select cr.contact_id
  from campaign_recipients cr
  join campaigns k on k.id = cr.campaign_id
  join lead_etapas l on l.contact_id = cr.contact_id and l.etapa = 'no_interesado'
  where cr.campaign_id = p_campaign_id
    and not ('no_interesado' = any(coalesce(k.audience_etapas, '{}')));
$$;
