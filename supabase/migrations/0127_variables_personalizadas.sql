-- Tres variables propias por espacio, para lo que cada negocio necesite:
-- fecha de la cita, número de pedido, ciudad, valor de la cuota, lo que sea.
--
-- Se llaman variable2, variable3 y variable4 y no "campo1/2/3" porque así es
-- como las ve el cliente al armar una plantilla: la {{1}} siempre es el
-- nombre del contacto, así que la primera propia es la {{2}}. Que el nombre
-- de la columna coincida con el de la variable evita el error de emparejar
-- "campo1" con {{2}} y mandarle a medio mundo el dato equivocado.
--
-- El motivo real de todo esto: hoy TODAS las variables de una plantilla se
-- rellenan con el nombre del contacto (ver buildTemplateSendParams). Una
-- plantilla con dos o tres variables no funciona -- Meta rechaza el envío con
-- error 132000 porque faltan parámetros.
--
-- Tres y no "las que quiera" a propósito: tres columnas fijas se importan, se
-- filtran y se muestran sin construir un motor de campos dinámicos. Si algún
-- día hacen falta más, se agregan columnas; el diseño no cambia.

alter table public.contacts
  add column if not exists variable2 text,
  add column if not exists variable3 text,
  add column if not exists variable4 text;

comment on column public.contacts.variable2 is
  'Dato propio del espacio: lo que rellena {{2}} en las plantillas. Se nombra en variables_personalizadas.';

-- Cómo se llama cada variable en ESTE espacio, y de qué tipo es.
--
-- El tipo no cambia cómo se guarda --todo es texto-- sino cómo se valida al
-- importar. Guardar un número como número aquí no aporta nada: lo que viaja a
-- WhatsApp es texto de todas formas.
create table if not exists public.variables_personalizadas (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- 2, 3 o 4: el número de variable que describe. La 1 es siempre el nombre.
  indice smallint not null check (indice between 2 and 4),
  nombre text not null,
  tipo text not null default 'texto' check (tipo in ('texto', 'numero', 'fecha')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, indice)
);

alter table public.variables_personalizadas enable row level security;

create policy variables_personalizadas_all on public.variables_personalizadas
for all
using (
  (select public.is_platform_admin())
  or workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid()))
)
with check (
  (select public.is_platform_admin())
  or workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid()))
);

-- Con qué se rellena cada variable de una plantilla aprobada.
--
-- Va en la plantilla y no en la campaña porque es parte de lo que se le
-- prometió a Meta al aprobarla: si {{2}} es "la fecha de la cita", lo es
-- siempre, en cualquier envío. Guardarlo por campaña permitiría que la misma
-- plantilla diga una cosa hoy y otra mañana, que es justo lo que Meta
-- sanciona.
--
-- `origen` es 'nombre' o 'variable2'|'variable3'|'variable4'. `ejemplo` es el
-- valor de muestra que se le manda a Meta para la aprobación.
alter table public.templates
  add column if not exists variables_origen jsonb;

comment on column public.templates.variables_origen is
  'Array ordenado: [{"origen":"nombre"},{"origen":"variable2","ejemplo":"23 de octubre"}]. La posición es {{1}}, {{2}}...';

select pg_notify('pgrst', 'reload schema');
