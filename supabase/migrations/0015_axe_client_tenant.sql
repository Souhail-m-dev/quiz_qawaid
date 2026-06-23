-- Axe SaaS retenu: tenant = CLIENT (centre d'examen), matière = catégorie (exams.subject).
-- Hisnul Mouslim n'est PAS un tenant : c'est une matière sous le tenant client.
-- On défait donc le tenant "Hisnul Mouslim" créé en 0013 (vide) + un doublon Miloud vide,
-- et on renomme le tenant client par défaut. Suppressions sûres: 0 exam/candidat/profil rattaché.

delete from public.tenants where host = 'hisnulmouslim.abouabdelwahab';
delete from public.tenants where id = '2c1a2b7f-e995-42eb-925e-f9b725ee4c01';
update public.tenants set name = 'Abou Abdelwahab' where id = '6badf254-27a3-4f69-98e3-e67caa917371';
