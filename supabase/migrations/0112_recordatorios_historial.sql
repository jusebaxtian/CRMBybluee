-- Recordatorios: historial de 60 dias.
--
-- Al cumplirse ya no se borran: quedan marcados con avisado_en para verse
-- en la Agenda como historial. El trabajo de fondo elimina los que tengan
-- mas de 60 dias calendario (por su fecha de recordatorio).
alter table public.recordatorios add column if not exists avisado_en timestamptz;
create index if not exists recordatorios_pendientes_idx on public.recordatorios (recordar_en) where avisado_en is null;
