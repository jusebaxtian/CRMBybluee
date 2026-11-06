-- Notas de voz del agente vendedor con ElevenLabs. Sin ELEVENLABS_API_KEY en el
-- servidor, el agente sigue escribiendo y no se le menciona el audio.
alter table public.agente_vendedor
  add column if not exists voz_activa boolean not null default true,
  add column if not exists voz_id text not null default 'sv5TkBbFxLHfFVQpMSah';
