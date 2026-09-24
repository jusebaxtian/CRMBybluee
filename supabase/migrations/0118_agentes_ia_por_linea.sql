-- Varios agentes de IA por espacio: uno por linea de WhatsApp.
--
-- Antes habia uno solo (la clave primaria era workspace_id). Ahora cada fila
-- es un agente y puede apuntar a una linea:
--   whatsapp_account_id = null  -> atiende las lineas que no tienen agente propio
--   whatsapp_account_id = linea -> atiende solo esa linea
-- Los espacios que ya tenian su agente quedan con whatsapp_account_id null,
-- o sea siguen funcionando igual que antes.

alter table ai_agents drop constraint ai_agents_pkey;
alter table ai_agents add column id uuid not null default gen_random_uuid();
alter table ai_agents add primary key (id);

alter table ai_agents
  add column whatsapp_account_id uuid references whatsapp_accounts (id) on delete cascade;

-- Un agente por linea, y como maximo uno "para las demas lineas" por espacio.
create unique index ai_agents_linea_unica
  on ai_agents (workspace_id, coalesce(whatsapp_account_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index ai_agents_workspace_idx on ai_agents (workspace_id);
