-- Las lecciones de un curso de pago solo las lee quien lo compro.
--
-- Hallazgo del 28 sep 2026: la politica de `tutoriales` decia "cualquiera
-- puede leer lo que este activo", sin mirar la compra. La pantalla del curso
-- si respetaba el pago (mostraba candados), pero la API no: con la llave
-- publica que va incrustada en la aplicacion --que cualquiera ve abriendo el
-- navegador-- se podian listar los enlaces de YouTube de las lecciones sin
-- haber pagado, e incluso sin sesion.
--
-- Queda asi:
--   - Capacitaciones sueltas (sin curso): cualquier usuario con sesion.
--   - Lecciones de un curso: solo espacios con compra aprobada.
--   - Anonimos: nada.
--   - Administrador de plataforma: todo, como siempre.
alter policy tutoriales_select on public.tutoriales
using (
  (select public.is_platform_admin())
  or (
    activo
    and (select auth.uid()) is not null
    and (
      curso_id is null
      or exists (
        select 1
        from public.curso_compras cc
        join public.workspace_members m
          on m.workspace_id = cc.workspace_id
         and m.user_id = (select auth.uid())
        where cc.curso_id = tutoriales.curso_id
          and cc.status = 'approved'
      )
    )
  )
);

-- Los cursos siguen visibles (titulo, precio, portada: es lo que vende), pero
-- ya no para anonimos. Ninguna pagina publica los usa: solo /dashboard y
-- /admin, las dos con sesion.
alter policy cursos_select on public.cursos
using (
  (select public.is_platform_admin())
  or (activo and (select auth.uid()) is not null)
);

-- Temario sin enlaces: lo que ve quien todavia no ha pagado.
--
-- Hace falta porque la politica de arriba le esconde las filas completas, y
-- sin esto la ficha del curso quedaria sin la lista de lecciones -- que es
-- justamente el argumento de venta. Devuelve titulo y duracion; nunca `url`.
create or replace function public.curso_temario(p_curso_id uuid)
returns table (id uuid, titulo text, duracion text, orden int)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.titulo, t.duracion, t.orden
  from tutoriales t
  join cursos c on c.id = t.curso_id
  where t.curso_id = p_curso_id
    and t.activo
    and c.activo
    and auth.uid() is not null
  order by t.orden, t.created_at;
$$;

grant execute on function public.curso_temario(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
