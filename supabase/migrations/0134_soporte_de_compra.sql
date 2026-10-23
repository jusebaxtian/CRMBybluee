-- Soporte de compra: lo que hace falta para entregarle al cliente un
-- documento que respalde cada pago aprobado.
--
-- 1) Datos del cliente en su espacio. El soporte lleva el documento de quien
--    compra: NIT si es empresa, cedula si es persona natural. Hasta ahora el
--    CRM no guardaba nada de eso. Se piden la primera vez que el cliente
--    descarga un soporte y se reutilizan despues.
--
-- 2) Un numero consecutivo por pago. Un contador necesita poder referirse a
--    "el soporte 123"; el id uuid del pago no sirve para eso. Es una columna de
--    identidad: la base la asigna sola, tambien a los pagos que ya existen, y
--    ningun codigo que inserte pagos necesita cambiar. Los pagos pendientes o
--    rechazados tambien consumen numero, asi que la serie de soportes tiene
--    saltos: es una referencia, no una numeracion fiscal.
alter table public.workspaces
  add column if not exists documento_tipo text
    check (documento_tipo in ('NIT', 'CC', 'CE', 'OTRO')),
  add column if not exists documento_numero text,
  add column if not exists direccion text;

comment on column public.workspaces.documento_tipo is
  'Tipo de documento de quien compra: NIT (empresa), CC o CE (persona natural) u OTRO (otros paises).';

alter table public.payments
  add column if not exists soporte_numero bigint generated always as identity;

select pg_notify('pgrst', 'reload schema');
