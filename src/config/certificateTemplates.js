// Template de certificat par tenant.
// Mets l'image dans public/ (ou public/certificates/) et référence-la ici par
// l'id du tenant. PAS d'entrée pour un tenant => ce tenant N'ÉMET PAS de
// certificat (email envoyé sans pièce jointe ni mention du certificat).
//
// Le template de base (al-qawaid) est ainsi réservé à l'instance par défaut.

export const CERT_TEMPLATES = {
  // Instance par défaut (al-qawaid) — garde le template de base existant.
  // TODO: vérifier que cet id est bien celui de « Instance par défaut ».
  '6badf254-27a3-4f69-98e3-e67caa917371': '/certificat.jpg',

  // Miloud — décommente quand tu déposes le fichier dans public/certificates/.
  // 'b466dda0-caa9-461e-8056-5d3989017a55': '/certificates/miloud.jpg',
};

// Renvoie l'URL du template du tenant, ou null s'il n'émet pas de certificat.
export function certTemplateFor(tenantId) {
  return (tenantId && CERT_TEMPLATES[tenantId]) || null;
}
