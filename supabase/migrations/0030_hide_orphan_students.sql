-- Ne lister que les élèves rattachés à une instance.
--
-- Le trigger `handle_new_user` crée une ligne profiles à chaque signUp, y compris
-- quand le rattachement (register_student) échoue ou n'est jamais appelé — par
-- exemple un lien d'invitation abandonné. Ces lignes n'ont pas de tenant_id.
--
-- Pour un owner elles étaient déjà exclues (la clause tenant les filtrait), mais
-- l'admin plateforme les voyait toutes: elles polluaient l'onglet « En attente »
-- de /admin/eleves, avec un sélecteur de classe vide (aucune classe ne peut
-- correspondre à une instance nulle).
--
-- On les masque au lieu de les supprimer: le compte auth existe toujours, et une
-- inscription depuis /eleve/inscription lui rendra une instance et le fera
-- réapparaître.

create or replace function public.list_students()
returns table (
  id uuid, email text, full_name text, status text, tenant_id uuid,
  class_id uuid, class_name text,
  matiere_ids uuid[], exams_done bigint, avg_pct numeric, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    u.email::text,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    p.status,
    p.tenant_id,
    p.class_id,
    cl.name,
    coalesce((select array_agg(sm.matiere_id) from public.student_matieres sm where sm.student_id = p.id),
             '{}'::uuid[]),
    (select count(*) from public.candidates c
      join public.attempts a on a.candidate_id = c.id
     where c.student_id = p.id and a.submitted_at is not null),
    (select round(avg(a.score / nullif(a.total, 0)) * 100, 1) from public.candidates c
      join public.attempts a on a.candidate_id = c.id
     where c.student_id = p.id and a.submitted_at is not null),
    u.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.classes cl on cl.id = p.class_id
  where p.role = 'eleve'
    and p.tenant_id is not null
    and (public.is_platform_admin()
         or (public.is_tenant_admin() and p.tenant_id = public.current_tenant_id()))
  order by p.status, u.created_at desc;
$$;

grant execute on function public.list_students() to authenticated;
