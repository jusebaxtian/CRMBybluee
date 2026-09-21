-- La pagina de contactos embebe conversations(ad_source_id, ad_headline) por
-- contacto. Solo existia el indice (workspace_id, contact_id), que no sirve
-- para buscar por contact_id solo: cada contacto recorria el indice completo
-- y con 6.000 contactos la consulta superaba el statement timeout (UVA TEC).
create index concurrently if not exists conversations_contact_id_idx
  on public.conversations (contact_id);
