// Hôte utilisé pour résoudre le tenant (RPC *_by_host).
//
// En production, c'est le domaine servi: tenants.host y correspond.
// En local (`npm run dev`), window.location.hostname vaut 'localhost' — aucun
// tenant ne porte ce host, donc toutes les vitrines et l'espace élève seraient
// vides. On retombe sur une instance réelle pour pouvoir tester.
//
// Surcharge: VITE_TENANT_HOST dans .env.local (ex: qawaid.abouabdelwahab.com).

const DEV_FALLBACK_HOST = 'examen.drmiloud.com'; // instance Miloud
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '']);

const actual = window.location.hostname;
const isLocal = LOCAL_HOSTS.has(actual) || actual.endsWith('.local');

export const TENANT_HOST = import.meta.env.VITE_TENANT_HOST || (isLocal ? DEV_FALLBACK_HOST : actual);

// Vrai quand on ne sert pas réellement ce domaine (bandeau de dev).
export const IS_HOST_OVERRIDDEN = TENANT_HOST !== actual;
