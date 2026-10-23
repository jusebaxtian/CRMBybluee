-- API publica (fase 2): webhooks de salida.
--
-- El cliente registra una URL y elige eventos. Los eventos se encolan desde la
-- BASE (disparadores), no desde el codigo: asi salen igual venga el cambio de la
-- bandeja, de una automatizacion, de una importacion o del webhook de Meta, sin
-- tocar ninguna de esas rutas. Un trabajo del servidor los entrega, firmados y
-- con reintentos.
--
-- Regla de oro de los disparadores: NUNCA pueden romper la operacion que los
-- dispara. Todo va dentro de un bloque con "exception when others", y lo primero
-- que hacen es comprobar si el espacio tiene algun webhook activo; sin ninguno
-- (casi todos los espacios) cuestan una consulta por un indice.
begin;

create table public.api_webhooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 80),
  url text not null check (char_length(url) <= 2000),
  -- Secreto con el que se firman los avisos; cifrado (AES-256-GCM), el navegador no lo lee.
  secreto_cifrado text not null,
  eventos text[] not null default '{}',
  activo boolean not null default true,
  fallos_seguidos integer not null default 0,
  desactivado_motivo text,
  ultimo_envio_el timestamptz,
  created_at timestamptz not null default now()
);

create index api_webhooks_workspace_idx on public.api_webhooks (workspace_id) where activo;

create table public.api_webhook_envios (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.api_webhooks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  evento text not null,
  payload jsonb not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'fallido')),
  intentos integer not null default 0,
  proximo_intento_el timestamptz not null default now(),
  ultimo_codigo integer,
  ultimo_error text,
  creado_el timestamptz not null default now(),
  enviado_el timestamptz
);

-- Lo que el trabajo busca cada pocos segundos: solo lo pendiente.
create index api_webhook_envios_pendientes_idx on public.api_webhook_envios (proximo_intento_el) where estado = 'pendiente';
create index api_webhook_envios_webhook_idx on public.api_webhook_envios (webhook_id, creado_el desc);
create index api_webhook_envios_limpieza_idx on public.api_webhook_envios (creado_el);

alter table public.api_webhooks enable row level security;
alter table public.api_webhook_envios enable row level security;
revoke all on public.api_webhooks from anon, authenticated;
revoke all on public.api_webhook_envios from anon, authenticated;

-- Encola un evento para cada webhook activo del espacio que lo tenga marcado.
create or replace function public.api_encolar_evento(p_workspace uuid, p_evento text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.api_webhook_envios (webhook_id, workspace_id, evento, payload)
  select id, workspace_id, p_evento, p_payload
    from public.api_webhooks
   where workspace_id = p_workspace and activo and p_evento = any (eventos);
exception when others then
  null;
end;
$$;

revoke all on function public.api_encolar_evento(uuid, text, jsonb) from public, anon, authenticated;

-- Mensajes nuevos: recibido (del cliente) o enviado (del negocio).
create or replace function public.api_evento_mensaje_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_contacto uuid;
  v_tel text;
begin
  begin
    select workspace_id, contact_id into v_ws, v_contacto from public.conversations where id = new.conversation_id;
    if v_ws is null or not exists (select 1 from public.api_webhooks where workspace_id = v_ws and activo) then
      return null;
    end if;
    select wa_id into v_tel from public.contacts where id = v_contacto;
    perform public.api_encolar_evento(
      v_ws,
      case when new.direction = 'in' then 'mensaje.recibido' else 'mensaje.enviado' end,
      jsonb_build_object(
        'id', coalesce(new.wa_message_id, new.id::text),
        'direccion', case when new.direction = 'in' then 'entrante' else 'saliente' end,
        'tipo', new.message_type,
        'texto', coalesce(new.body, new.caption),
        'estado', new.status,
        'contacto_id', v_contacto,
        'telefono', v_tel,
        'conversacion_id', new.conversation_id,
        'creado_el', new.created_at
      )
    );
  exception when others then
    null;
  end;
  return null;
end;
$$;

create trigger api_evento_mensaje_nuevo
  after insert on public.messages
  for each row execute function public.api_evento_mensaje_nuevo();

-- Cambio de estado de un mensaje enviado: entregado, leido o fallido.
create or replace function public.api_evento_mensaje_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_contacto uuid;
  v_tel text;
  v_evento text;
begin
  begin
    v_evento := case new.status when 'delivered' then 'mensaje.entregado' when 'read' then 'mensaje.leido' when 'failed' then 'mensaje.fallido' else null end;
    if v_evento is null or new.direction <> 'out' then
      return null;
    end if;
    select workspace_id, contact_id into v_ws, v_contacto from public.conversations where id = new.conversation_id;
    if v_ws is null or not exists (select 1 from public.api_webhooks where workspace_id = v_ws and activo) then
      return null;
    end if;
    select wa_id into v_tel from public.contacts where id = v_contacto;
    perform public.api_encolar_evento(
      v_ws,
      v_evento,
      jsonb_build_object(
        'id', coalesce(new.wa_message_id, new.id::text),
        'estado', new.status,
        'error', new.error_detail,
        'contacto_id', v_contacto,
        'telefono', v_tel,
        'conversacion_id', new.conversation_id
      )
    );
  exception when others then
    null;
  end;
  return null;
end;
$$;

create trigger api_evento_mensaje_estado
  after update of status on public.messages
  for each row
  when (old.status is distinct from new.status)
  execute function public.api_evento_mensaje_estado();

-- Contactos: creado, y actualizado solo cuando cambia algo que el cliente edita.
create or replace function public.api_evento_contacto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if not exists (select 1 from public.api_webhooks where workspace_id = new.workspace_id and activo) then
      return null;
    end if;
    perform public.api_encolar_evento(
      new.workspace_id,
      case when tg_op = 'INSERT' then 'contacto.creado' else 'contacto.actualizado' end,
      jsonb_build_object(
        'id', new.id,
        'telefono', new.wa_id,
        'nombre', new.name,
        'notas', new.notes,
        'variable2', new.variable2,
        'variable3', new.variable3,
        'variable4', new.variable4,
        'creado_el', new.created_at
      )
    );
  exception when others then
    null;
  end;
  return null;
end;
$$;

create trigger api_evento_contacto_creado
  after insert on public.contacts
  for each row execute function public.api_evento_contacto();

create trigger api_evento_contacto_actualizado
  after update on public.contacts
  for each row
  when (
    (old.name, old.notes, old.variable2, old.variable3, old.variable4, old.wa_id)
    is distinct from
    (new.name, new.notes, new.variable2, new.variable3, new.variable4, new.wa_id)
  )
  execute function public.api_evento_contacto();

-- Etiqueta asignada a un contacto.
create or replace function public.api_evento_etiqueta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_tel text;
  v_etiqueta text;
begin
  begin
    select workspace_id, wa_id into v_ws, v_tel from public.contacts where id = new.contact_id;
    if v_ws is null or not exists (select 1 from public.api_webhooks where workspace_id = v_ws and activo) then
      return null;
    end if;
    select name into v_etiqueta from public.tags where id = new.tag_id;
    perform public.api_encolar_evento(
      v_ws,
      'etiqueta.asignada',
      jsonb_build_object('contacto_id', new.contact_id, 'telefono', v_tel, 'etiqueta', v_etiqueta)
    );
  exception when others then
    null;
  end;
  return null;
end;
$$;

create trigger api_evento_etiqueta
  after insert on public.contact_tags
  for each row execute function public.api_evento_etiqueta();

-- Conversacion asignada (o desasignada) a un agente.
create or replace function public.api_evento_conversacion_asignada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tel text;
begin
  begin
    if not exists (select 1 from public.api_webhooks where workspace_id = new.workspace_id and activo) then
      return null;
    end if;
    select wa_id into v_tel from public.contacts where id = new.contact_id;
    perform public.api_encolar_evento(
      new.workspace_id,
      'conversacion.asignada',
      jsonb_build_object('conversacion_id', new.id, 'contacto_id', new.contact_id, 'telefono', v_tel, 'agente_id', new.assigned_agent_id)
    );
  exception when others then
    null;
  end;
  return null;
end;
$$;

create trigger api_evento_conversacion_asignada
  after update of assigned_agent_id on public.conversations
  for each row
  when (old.assigned_agent_id is distinct from new.assigned_agent_id)
  execute function public.api_evento_conversacion_asignada();

commit;
