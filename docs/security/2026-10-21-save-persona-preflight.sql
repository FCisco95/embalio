-- READ ONLY: function code/settings; no application rows or Auth credentials.
-- Run in the Embalio SQL Editor and return all rows (including any overloads).
select p.oid::regprocedure::text as signature,
       p.prosecdef as security_definer,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'save_persona'
  and p.prokind = 'f'
order by p.oid;
