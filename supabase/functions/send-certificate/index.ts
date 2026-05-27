// Supabase Edge Function: send-certificate
// Reçoit un certificat PDF (base64) + destinataire, l'envoie via Resend.
// Secrets requis: RESEND_API_KEY, CERT_FROM (ex. "Al-Qawaaid <certificat@mondomaine.com>").
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Méthode non autorisée.' }, 405);
  }

  let payload: {
    to?: string;
    studentName?: string;
    examTitle?: string;
    fileName?: string;
    pdfBase64?: string;
    score?: number;
    total?: number;
    logoBase64?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Corps JSON invalide.' }, 400);
  }

  const { to, fileName, pdfBase64, score, total, logoBase64 } = payload;
  if (!to || !pdfBase64) {
    return json({ error: 'Champs requis manquants: to, pdfBase64.' }, 400);
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('CERT_FROM');
  if (!apiKey || !from) {
    return json(
      { error: 'Configuration serveur incomplète (RESEND_API_KEY / CERT_FROM).' },
      500
    );
  }

  const hasScore = typeof score === 'number' && typeof total === 'number' && total > 0;
  const percent = hasScore ? Math.round((score / total) * 100) : null;
  const resultLine = hasScore ? `${score}/${total} (${percent}%)` : '';

  const subject = 'Résultat examen — Al-Qawāʿid al-Muthlā';

  const logoBlock = logoBase64
    ? `<tr><td align="center" style="padding:26px 28px 8px;">
         <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
           <td align="center" bgcolor="#101827" style="background:#101827;border:1px solid rgba(197,160,89,0.45);border-radius:50%;padding:16px;">
             <img src="cid:logo" alt="Sceau" width="128" height="128" style="display:block;width:128px;height:128px;" />
           </td>
         </tr></table>
       </td></tr>`
    : '';

  const html = `
  <div style="margin:0;padding:0;background:#101827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#101827" style="background:#101827;padding:32px 12px;font-family:'Montserrat',Arial,Helvetica,sans-serif;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#1A1F2C" style="max-width:600px;width:100%;background:#1A1F2C;border:1px solid rgba(197,160,89,0.35);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
          <tr><td style="height:4px;background:#C5A059;font-size:0;line-height:0;">&nbsp;</td></tr>
          ${logoBlock}
          <tr><td align="center" style="padding:10px 28px 0;">
            <h1 style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:700;color:#D4AF37;letter-spacing:.5px;">Al-Qawāʿid al-Muthlā</h1>
            <p style="margin:6px 0 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;">Les Noms et Attributs d'Allah</p>
          </td></tr>
          <tr><td style="padding:18px 32px 0;"><div style="height:1px;background:rgba(197,160,89,0.25);"></div></td></tr>

          <tr><td style="padding:20px 32px 4px;color:#E6DFD1;font-size:15px;line-height:1.7;">
            <p style="margin:0 0 14px;">As salām ‘alaykum wa rahmatullāhi wa barakātuh,</p>
            <p style="margin:0;">Nous avons le plaisir de vous informer que vous avez <strong style="color:#10B981;">réussi l'examen final</strong> du séminaire <strong style="color:#F9FAFB;">Al-Qawāʿid al-Muthlā : Les Noms et Attributs d'Allah</strong>.</p>
          </td></tr>

          <tr><td style="padding:14px 32px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#101827" style="background:#101827;border:1px solid rgba(197,160,89,0.45);border-radius:12px;">
              <tr><td align="center" style="padding:18px;">
                <span style="display:block;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;margin-bottom:6px;">Votre résultat</span>
                <span style="font-family:'Playfair Display',Georgia,serif;font-size:32px;font-weight:700;color:#10B981;">${resultLine || '—'}</span>
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:10px 32px 4px;color:#E6DFD1;font-size:15px;line-height:1.7;">
            <p style="margin:0;">Qu'Allah vous récompense pour vos efforts, votre assiduité et votre sérieux tout au long de ce séminaire. Nous demandons à Allah que cette science vous soit bénéfique ici-bas et dans l'au-delà, et qu'Il nous fasse tous agir conformément à ce que nous apprenons.</p>
          </td></tr>

          <tr><td style="padding:14px 32px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(197,160,89,0.10);border-left:3px solid #C5A059;border-radius:8px;">
              <tr><td style="padding:14px 16px;color:#E6DFD1;font-size:14px;">
                <span style="font-size:17px;vertical-align:middle;">📎</span>&nbsp; Vous trouverez <strong style="color:#D4AF37;">en pièce jointe</strong> votre certificat de réussite au format PDF.
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:14px 32px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#101827" style="background:#101827;border-right:3px solid #D4AF37;border-radius:8px;">
              <tr><td style="padding:16px 18px;text-align:right;">
                <p style="margin:0 0 6px;font-family:'Amiri','Times New Roman',serif;font-size:20px;color:#D4AF37;direction:rtl;">بارك الله فيكم</p>
                <p style="margin:0;color:#9CA3AF;font-size:14px;line-height:1.6;text-align:right;">Qu'Allah vous accorde la sincérité, la constance dans la recherche de la science et vous ouvre les portes du bien.</p>
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:12px 32px 0;color:#E6DFD1;font-size:15px;line-height:1.7;">
            <p style="margin:0;">Wa salām ‘alaykum wa rahmatullāhi wa barakātuh.</p>
          </td></tr>

          <tr><td style="padding:20px 32px 4px;">
            <div style="height:1px;background:rgba(197,160,89,0.25);margin-bottom:14px;"></div>
            <p style="margin:0;font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:19px;color:#D4AF37;">Dr. AbdelRahman Abou Abdelwahab</p>
            <p style="margin:3px 0 0;font-size:12px;color:#9CA3AF;">Enseignant du séminaire</p>
          </td></tr>

          <tr><td align="center" style="padding:22px 28px 26px;">
            <p style="margin:0;font-size:11px;color:#6B7280;letter-spacing:.5px;">Al-Qawāʿid al-Muthlā · Certificat de réussite</p>
          </td></tr>
          <tr><td style="height:4px;background:#C5A059;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td></tr>
    </table>
  </div>
  `;

  const attachments: Array<{ filename: string; content: string; content_id?: string }> = [
    { filename: fileName || 'certificat.pdf', content: pdfBase64 }
  ];
  if (logoBase64) {
    attachments.push({ filename: 'logo.png', content: logoBase64, content_id: 'logo' });
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      attachments
    })
  });

  const result = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return json(
      { error: result?.message || 'Échec de l\'envoi via Resend.', details: result },
      resp.status
    );
  }

  return json({ ok: true, id: result?.id ?? null });
});
