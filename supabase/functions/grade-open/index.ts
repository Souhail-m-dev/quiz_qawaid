// Supabase Edge Function: grade-open (OPTIONNELLE — IA de secours).
// Note des réponses ouvertes par LLM, en sortie structurée.
// La correction déterministe (src/utils/gradeOpen.js) reste la voie principale;
// cette fonction n'est appelée que si elle est configurée et déployée.
//
// Secrets requis (selon le fournisseur choisi):
//   ANTHROPIC_API_KEY  + GRADE_MODEL (défaut "claude-haiku-4-5-20251001")
// Entrée  POST: { items: [{ questionId, question, modelAnswer, pointsMax, bareme?, studentAnswer }] }
// Sortie       : { results: [{ questionId, points, rationale, confidence }] }
//
// NOTE: scaffold. Le fournisseur LLM n'est pas arrêté (cf. plan, partie IA en spec).
// Adapter l'appel `callLLM` au fournisseur retenu avant déploiement.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

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

interface GradeItem {
  questionId: string;
  question: string;
  modelAnswer?: string;
  pointsMax: number;
  bareme?: string;
  studentAnswer: string;
}

// Appel LLM (exemple Anthropic Claude). À adapter au fournisseur retenu.
async function callLLM(items: GradeItem[]) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const model = Deno.env.get('GRADE_MODEL') || 'claude-haiku-4-5-20251001';
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquant — fonction IA non configurée.');

  const prompt = [
    'Tu es correcteur d\'examen. Pour chaque question, compare la réponse de l\'étudiant',
    'à la réponse de référence et au barème, puis attribue un nombre de points entre 0 et',
    'pointsMax (décimales autorisées). Réponds UNIQUEMENT en JSON: ',
    '{"results":[{"questionId","points","rationale","confidence"}]} où confidence ∈ [0,1].',
    'Justifie en français, concis.',
    '',
    JSON.stringify({ items }, null, 2)
  ].join('\n');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || 'Échec appel LLM.');
  const text: string = data?.content?.[0]?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Réponse LLM non parsable.');
  return JSON.parse(match[0]).results as Array<{ questionId: string; points: number; rationale: string; confidence: number }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  let payload: { items?: GradeItem[] };
  try { payload = await req.json(); } catch { return json({ error: 'Corps JSON invalide.' }, 400); }

  const items = payload.items || [];
  if (items.length === 0) return json({ error: 'Aucune réponse à corriger.' }, 400);

  try {
    const raw = await callLLM(items);
    // Clamp défensif: jamais au-dessus de pointsMax, jamais négatif.
    const byMax = Object.fromEntries(items.map((i) => [i.questionId, i.pointsMax]));
    const results = raw.map((r) => ({
      questionId: r.questionId,
      points: Math.max(0, Math.min(Number(r.points) || 0, byMax[r.questionId] ?? 0)),
      rationale: r.rationale || '',
      confidence: Math.max(0, Math.min(Number(r.confidence) || 0, 1))
    }));
    return json({ results });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
