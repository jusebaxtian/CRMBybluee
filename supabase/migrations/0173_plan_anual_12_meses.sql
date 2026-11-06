-- El PRO ANUAL de $800.000 estaba guardado como semestral: al renovar habria dado
-- 6 meses aunque se vende por 12. No toca el vencimiento de quienes ya lo tienen.
update public.plans set billing_cycle = 'yearly' where name like 'PRO ANUAL%' and billing_cycle = 'semiannual';
