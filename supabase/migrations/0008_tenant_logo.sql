-- Logo par tenant pour l'email de certificat. NULL = pas de logo (l'email
-- n'affiche alors aucun logo). URL publique (ex. asset hébergé / storage).
alter table public.tenants add column if not exists logo_url text;
