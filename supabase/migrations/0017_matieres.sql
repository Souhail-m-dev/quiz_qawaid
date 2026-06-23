-- Matière = entité de 1er ordre par tenant (vitrine publique + gating mot de passe).
-- exams.subject / quiz_courses.subject (texte libre) restent; on ajoute subject_id (FK)
-- renseigné automatiquement par trigger find-or-create. parent_id réservé sous-matières (pas d'UI v1).

create table if not exists public.matieres (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  parent_id uuid references public.matieres(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  access_code text,                       -- null = matière publique (sans mdp)
  position int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
alter table public.matieres enable row level security;

alter table public.exams        add column if not exists subject_id uuid references public.matieres(id) on delete set null;
alter table public.quiz_courses add column if not exists subject_id uuid references public.matieres(id) on delete set null;
create index if not exists exams_subject_idx on public.exams (subject_id);
create index if not exists quiz_courses_subject_idx on public.quiz_courses (subject_id);
create index if not exists matieres_tenant_idx on public.matieres (tenant_id);

-- slug simple (sans accents gérés; collisions rares traitées par on conflict).
create or replace function public.slugify(p text)
returns text language sql immutable as $$
  select trim(both '-' from lower(regexp_replace(coalesce(p,''), '[^a-zA-Z0-9]+', '-', 'g')));
$$;

-- tenant_id auto pour matieres (insert manuel via admin).
create or replace function public.tg_set_matiere_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null then
    new.tenant_id := (select tenant_id from public.profiles where id = coalesce(new.created_by, auth.uid()));
  end if;
  if new.slug is null or new.slug = '' then new.slug := public.slugify(new.name); end if;
  return new;
end $$;
drop trigger if exists trg_set_matiere_tenant on public.matieres;
create trigger trg_set_matiere_tenant before insert on public.matieres
  for each row execute function public.tg_set_matiere_tenant();

-- find-or-create matière depuis le texte subject; pose subject_id. (exams + quiz_courses)
-- Nommé trg_z_* pour passer APRÈS les triggers qui posent tenant_id.
create or replace function public.tg_link_subject_matiere()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_mid uuid; v_slug text;
begin
  if new.subject is not null and new.subject <> '' and new.tenant_id is not null then
    select id into v_mid from public.matieres where tenant_id = new.tenant_id and name = new.subject;
    if v_mid is null then
      v_slug := public.slugify(new.subject);
      insert into public.matieres (tenant_id, name, slug)
        values (new.tenant_id, new.subject, v_slug)
        on conflict (tenant_id, slug) do nothing
        returning id into v_mid;
      if v_mid is null then
        select id into v_mid from public.matieres where tenant_id = new.tenant_id and name = new.subject;
      end if;
    end if;
    new.subject_id := v_mid;
  end if;
  return new;
end $$;
drop trigger if exists trg_z_link_subject on public.exams;
create trigger trg_z_link_subject before insert or update of subject on public.exams
  for each row execute function public.tg_link_subject_matiere();
drop trigger if exists trg_z_link_subject on public.quiz_courses;
create trigger trg_z_link_subject before insert or update of subject on public.quiz_courses
  for each row execute function public.tg_link_subject_matiere();

-- RLS staff (anon lit via RPC uniquement).
drop policy if exists matieres_staff_all on public.matieres;
create policy matieres_staff_all on public.matieres for all to authenticated
  using (public.is_platform_admin() or tenant_id = public.current_tenant_id())
  with check (public.is_platform_admin() or tenant_id = public.current_tenant_id());

-- Backfill: créer les matières depuis les subjects existants + relier.
insert into public.matieres (tenant_id, name, slug)
select tenant_id, subject, public.slugify(subject)
from (
  select tenant_id, subject from public.exams        where subject is not null and subject <> '' and tenant_id is not null
  union
  select tenant_id, subject from public.quiz_courses where subject is not null and subject <> '' and tenant_id is not null
) s
on conflict (tenant_id, slug) do nothing;

update public.exams e set subject_id = m.id
from public.matieres m
where e.subject_id is null and e.tenant_id = m.tenant_id and e.subject = m.name;
update public.quiz_courses c set subject_id = m.id
from public.matieres m
where c.subject_id is null and c.tenant_id = m.tenant_id and c.subject = m.name;

-- RPC publics.
create or replace function public.matieres_by_host(p_host text)
returns table(id uuid, name text, slug text, description text, has_password boolean, exam_count bigint, course_count bigint)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.slug, m.description,
         (m.access_code is not null) as has_password,
         (select count(*) from public.exams e where e.subject_id = m.id and e.is_open = true),
         (select count(*) from public.quiz_courses c where c.subject_id = m.id)
  from public.matieres m
  join public.tenants t on t.id = m.tenant_id
  where t.host = p_host
  order by m.position, m.name;
$$;

create or replace function public.matiere_content(p_host text, p_slug text, p_code text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m record;
begin
  select mm.* into m from public.matieres mm
    join public.tenants t on t.id = mm.tenant_id
    where t.host = p_host and mm.slug = p_slug;
  if not found then return null; end if;
  if m.access_code is not null and (p_code is null or p_code <> m.access_code) then
    return jsonb_build_object('locked', true, 'name', m.name);
  end if;
  return jsonb_build_object(
    'locked', false,
    'name', m.name,
    'description', m.description,
    'exams', coalesce((
      select jsonb_agg(jsonb_build_object('slug', e.slug, 'title', e.title) order by e.title)
      from public.exams e where e.subject_id = m.id and e.is_open = true), '[]'::jsonb),
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'number', c.number, 'title', c.title,
        'question_count', (select count(*) from public.quiz_questions q where q.course_id = c.id)) order by c.position)
      from public.quiz_courses c where c.subject_id = m.id), '[]'::jsonb)
  );
end $$;

grant execute on function public.matieres_by_host(text) to anon, authenticated;
grant execute on function public.matiere_content(text, text, text) to anon, authenticated;
