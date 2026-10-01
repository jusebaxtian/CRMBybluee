-- Tres columnas propias por espacio, para lo que cada negocio necesite:
-- fecha de la cita, número de pedido, ciudad, valor de la cuota.
--
-- El motivo real: hoy TODAS las variables de una plantilla se rellenan con el
-- nombre del contacto (ver buildTemplateSendParams). Una plantilla con dos o
-- tres variables no funciona: Meta rechaza el envío con error 132000 porque
-- faltan parámetros. Con esto, cada variable se empareja con un dato.
--
-- Tres y no "las que quiera" a propósito: tres columnas fijas se importan, se
-- filtran y se muestran sin construir un motor de campos dinámicos, y cubren
-- lo que pide el caso real ("cita el 23 de octubre a las 8 pm" son dos datos).
-- Si algún día hacen falta más, se agregan columnas; el diseño no cambia.

alter table public.contacts
  add column if not exists campo1 text,
  add column if not exists campo2 text,
  add column if not exists campo3 text;

comment on column public.contacts.campo1 is
  'Dato propio del espacio, definido en campos_personalizados. Se rellena por importación de Excel o a mano.';

-- Cómo se llama cada columna en ESTE espacio, y de qué tipo es.
--
-- El tipo no cambia cómo se guarda --todo es texto-- sino cómo se valida al
-- importar y cómo se muestra. Guardar un número como número aquí no aporta
-- nada: lo que viaja a WhatsApp es texto de todas formas.
create table if not exists public.campos_personalizados (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- 1, 2 o 3: la columna que describe.
  indice smallint not null check (indice between 1 and 3),
  nombre text not null,
  tipo text not null default 'texto' check (tipo in ('texto', 'numero', 'fecha')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, indice)
);

alter table public.campos_personalizados enable row level security;

create policy campos_personalizados_all on public.campos_personalizados
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
-- `origen` es 'nombre' o 'campo1'|'campo2'|'campo3'. `ejemplo` es el valor de
-- muestra que se le manda a Meta para la aprobación.
alter table public.templates
  add column if not exists variables_origen jsonb;

comment on column public.templates.variables_origen is
  'Array ordenado: [{"origen":"nombre"},{"origen":"campo1","ejemplo":"23 de octubre"}]. La posición es {{1}}, {{2}}...';

select pg_notify('pgrst', 'reload schema');
