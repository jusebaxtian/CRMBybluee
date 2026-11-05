-- El agente de IA lee las imagenes que manda el cliente y avisa si son un
-- comprobante de pago. Se activa agente por agente: leer cada imagen gasta la
-- llave de IA del dueno del agente, y el comprobante viaja a su proveedor de IA.
alter table public.ai_agents
  add column if not exists lee_imagenes boolean not null default false;

-- Lo que el agente entendio de la imagen, para no volver a pagar por leerla en
-- cada respuesta: { descripcion, esComprobante, valor, banco, fecha }.
alter table public.messages
  add column if not exists lectura_imagen jsonb;

select pg_notify('pgrst', 'reload schema');
