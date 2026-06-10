// Supabase Edge Function: send-certificate (Multi-Tenant)
// Dynamically fetches Resend config from the 'tenants' table.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  let payload: {
    to?: string;
    studentName?: string;
    examId?: string; // Critical for tenant lookup
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
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const { to, examId, examTitle, fileName, pdfBase64, score, total, logoBase64 } = payload;
  if (!to || !pdfBase64 || !examId) {
    return json({ error: 'Missing required fields (to, pdfBase64, examId).' }, 400);
  }

  // 1. Initialize Supabase client with SERVICE_ROLE to read tenant settings
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // 2. Fetch Tenant Config
  const { data: config, error: configErr } = await supabase
    .from('exams')
    .select('title, tenants(resend_api_key, email_from, app_name)')
    .eq('id', examId)
    .single();

  if (configErr || !config) {
    console.error('Config fetch error:', configErr);
    return json({ error: 'Failed to retrieve tenant configuration.' }, 500);
  }

  const tenant = config.tenants as unknown as { resend_api_key: string; email_from: string; app_name: string };
  
  // 3. Resolve Secrets (Tenant value with Env Var fallback)
  const apiKey = tenant?.resend_api_key || Deno.env.get('RESEND_API_KEY');
  const from = tenant?.email_from || Deno.env.get('CERT_FROM');
  const appName = tenant?.app_name || Deno.env.get('APP_NAME') || 'Plateforme d\'Examens';
  const finalExamTitle = examTitle || config.title || 'Examen';

  if (!apiKey || !from) {
    return json({ error: 'Incomplete email configuration for this tenant.' }, 500);
  }

  // 4. Prepare Email
  const hasScore = typeof score === 'number' && typeof total === 'number' && total > 0;
  const percent = hasScore ? Math.round((score / total) * 100) : null;
  const resultLine = hasScore ? `${score}/${total} (${percent}%)` : '';
  const subject = `Résultat examen — ${finalExamTitle}`;

  const logoBlock = logoBase64
    ? `<tr><td align="center" style="padding:26px 28px 8px;">
         <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
           <td align="center" bgcolor="#101827" style="background:#101827;border:1px solid rgba(197,160,89,0.45);border-radius:50%;padding:16px;">
             <img src="cid:logo" alt="Logo" width="128" height="128" style="display:block;width:128px;height:128px;" />
           </td>
         </tr></table>
       </td></tr>`
    : '';

  const html = `
  <div style="margin:0;padding:0;background:#101827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#101827" style="background:#101827;padding:32px 12px;font-family:Arial,sans-serif;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#1A1F2C" style="max-width:600px;width:100%;background:#1A1F2C;border:1px solid rgba(197,160,89,0.35);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
          <tr><td style="height:4px;background:#C5A059;font-size:0;line-height:0;">&nbsp;</td></tr>
          ${logoBlock}
          <tr><td align="center" style="padding:10px 28px 0;">
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#D4AF37;letter-spacing:.5px;">${finalExamTitle}</h1>
            <p style="margin:6px 0 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;">${appName}</p>
          </td></tr>
          <tr><td style="padding:18px 32px 0;"><div style="height:1px;background:rgba(197,160,89,0.25);"></div></td></tr>

          <tr><td style="padding:20px 32px 4px;color:#E6DFD1;font-size:15px;line-height:1.7;">
            <p style="margin:0 0 14px;">As salām ‘alaykum wa rahmatullāhi wa barakātuh,</p>
            <p style="margin:0;">Nous avons le plaisir de vous informer que vous avez <strong style="color:#10B981;">réussi l'examen</strong> : <strong style="color:#F9FAFB;">${finalExamTitle}</strong>.</p>
          </td></tr>

          <tr><td style="padding:14px 32px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#101827" style="background:#101827;border:1px solid rgba(197,160,89,0.45);border-radius:12px;">
              <tr><td align="center" style="padding:18px;">
                <span style="display:block;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;margin-bottom:6px;">Votre résultat</span>
                <span style="font-size:32px;font-weight:700;color:#10B981;">${resultLine || '—'}</span>
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:10px 32px 4px;color:#E6DFD1;font-size:15px;line-height:1.7;">
            <p style="margin:0;">Qu'Allah vous récompense pour vos efforts. Vous trouverez en pièce jointe votre certificat au format PDF.</p>
          </td></tr>

          <tr><td style="padding:12px 32px 0;color:#E6DFD1;font-size:15px;line-height:1.7;">
            <p style="margin:0;">Wa salām ‘alaykum wa rahmatullāhi wa barakātuh.</p>
          </td></tr>

          <tr><td align="center" style="padding:22px 28px 26px;">
            <p style="margin:0;font-size:11px;color:#6B7280;letter-spacing:.5px;">${appName} · Certificat envoyé par e-mail</p>
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
  if (logoBase64) attachments.push({ filename: 'logo.png', content: logoBase64, content_id: 'logo' });

  // 5. Send Email
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, attachments })
  });

  const result = await resp.json().catch(() => ({}));
  if (!resp.ok) return json({ error: result?.message || 'Resend error.', details: result }, resp.status);

  return json({ ok: true, id: result?.id ?? null });
});
