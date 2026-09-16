-- Plantillas por cuenta de WhatsApp Business (WABA).
--
-- Hasta ahora el CRM asumia que todas las lineas de un espacio compartian la
-- misma WABA y las plantillas eran comunes. Un espacio con lineas en WABAs
-- distintas (GC Solutions: 316... y 324...) podia elegir una plantilla que
-- no existia en la linea desde la que enviaba y Meta rechazaba el masivo
-- (#132001). Cada plantilla queda ahora ligada a su WABA.

alter table public.templates add column if not exists waba_id text;

-- Relleno: hasta hoy sincronizar y crear usaban siempre la primera linea
-- conectada del espacio, asi que esa es la WABA de todas las existentes.
update public.templates t
set waba_id = a.waba_id
from (
  select distinct on (workspace_id) workspace_id, waba_id
  from public.whatsapp_accounts
  where status <> 'frozen'
  order by workspace_id, connected_at
) a
where t.workspace_id = a.workspace_id and t.waba_id is null;

-- Espacios sin linea conectada: la plantilla no se puede usar de todos
-- modos; queda con cadena vacia para no romper la unicidad.
update public.templates set waba_id = '' where waba_id is null;
alter table public.templates alter column waba_id set not null;
alter table public.templates alter column waba_id set default '';

alter table public.templates drop constraint if exists templates_workspace_id_meta_template_name_language_key;
alter table public.templates
  add constraint templates_workspace_waba_nombre_idioma_key
  unique (workspace_id, waba_id, meta_template_name, language);

create index if not exists templates_workspace_waba_idx on public.templates (workspace_id, waba_id);
