-- Bug trigger find-or-create matière : lookup par name EXACT. Une variante de
-- casse/typo du même slug ("HISNUL MOUSLIM" vs "Hisnul Mouslim") ne trouve rien
-- par name, l'insert tombe sur le conflit (tenant_id, slug) → do nothing → et
-- subject_id reste NULL. Cours orphelins : visibles en admin (groupés par texte)
-- mais absents des pages publiques matière (qui lisent par subject_id).
-- Fix : matcher par slug, et normaliser le texte subject vers le nom canonique.

create or replace function public.tg_link_subject_matiere()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_mid uuid; v_name text; v_slug text;
begin
  if new.subject is not null and new.subject <> '' and new.tenant_id is not null then
    v_slug := public.slugify(new.subject);
    select id, name into v_mid, v_name
      from public.matieres where tenant_id = new.tenant_id and slug = v_slug;
    if v_mid is null then
      insert into public.matieres (tenant_id, name, slug)
        values (new.tenant_id, new.subject, v_slug)
        on conflict (tenant_id, slug) do nothing
        returning id, name into v_mid, v_name;
      if v_mid is null then
        select id, name into v_mid, v_name
          from public.matieres where tenant_id = new.tenant_id and slug = v_slug;
      end if;
    end if;
    new.subject_id := v_mid;
    if v_name is not null then new.subject := v_name; end if;
  end if;
  return new;
end $$;

-- Backfill : relier + normaliser tout cours/examen dont le subject correspond au
-- slug d'une matière existante du même tenant (répare les 5 cours "HISNUL MOUSLIM").
update public.quiz_courses c
set subject = m.name, subject_id = m.id
from public.matieres m
where c.tenant_id = m.tenant_id
  and public.slugify(c.subject) = m.slug
  and (c.subject_id is distinct from m.id or c.subject <> m.name);

update public.exams e
set subject = m.name, subject_id = m.id
from public.matieres m
where e.tenant_id = m.tenant_id
  and public.slugify(e.subject) = m.slug
  and (e.subject_id is distinct from m.id or e.subject <> m.name);
