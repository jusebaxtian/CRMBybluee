-- 0181: el tope de meses gratis por referidos pasa de 3 a 5, de por vida,
-- para todos los que ya tienen el plan de referidos (15 nov 2026).
-- Solo cambia el tope; el resto de la funcion queda igual que en 0155.
begin;

create or replace function public.otorgar_mes_por_referido(p_referido uuid, p_pago uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref uuid;
  v_total int;
  v_motivo text;
  a public.workspaces%rowtype;
  b public.workspaces%rowtype;
begin
  select referred_by into v_ref from public.workspaces where id = p_referido;
  if v_ref is null or v_ref = p_referido then return; end if;

  perform pg_advisory_xact_lock(hashtext('referidos:' || v_ref::text));

  if exists (select 1 from public.referral_rewards where referred_id = p_referido) then return; end if;

  select count(*) into v_total from public.referral_rewards
   where referrer_id = v_ref and status in ('en_revision', 'disponible', 'usado');
  if v_total >= 5 then return; end if;

  select * into a from public.workspaces where id = v_ref;
  select * into b from public.workspaces where id = p_referido;
  if a.id is null or b.id is null then return; end if;

  if a.signup_ip is not null and a.signup_ip = b.signup_ip then
    v_motivo := 'Se registraron desde la misma IP';
  elsif a.phone is not null and a.phone = b.phone then
    v_motivo := 'Tienen el mismo teléfono';
  elsif a.documento_numero is not null and a.documento_numero = b.documento_numero then
    v_motivo := 'Tienen el mismo documento legal';
  end if;

  insert into public.referral_rewards (referrer_id, referred_id, payment_id, status, motivo_revision)
  values (v_ref, p_referido, p_pago, case when v_motivo is null then 'disponible' else 'en_revision' end, v_motivo)
  on conflict (referred_id) do nothing;
end;
$$;

revoke all on function public.otorgar_mes_por_referido(uuid, uuid) from public, anon, authenticated;

commit;
