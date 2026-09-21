-- Notificaciones tipo aviso emergente: ademas de la campana, el admin puede
-- mostrarla a pantalla completa (con X para cerrar) la proxima vez que el
-- espacio abra el panel. Cerrarla la marca como leida (notification_reads).
alter table notifications
  add column if not exists modo text not null default 'campana'
  check (modo in ('campana', 'pantalla'));
