// Generates 30 candidate attempts for the Niveau 1 exam to showcase the
// deterministic autocorrector's behaviour and its limits (false pos / false
// neg / needsReview). Uses the REAL grader (buildAnswer/tallyScore) so the
// computed scores match exactly what the app stores.
//
//   node scripts/seed-attempts.mjs            -> prints showcase summary
//   node scripts/seed-attempts.mjs --json     -> writes scripts/out/attempts.json
//
// SQL emission is a separate step (needs the real exam slug + table columns).

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildAnswer, tallyScore } from '../src/utils/questionModel.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const exam = JSON.parse(readFileSync(join(__dir, '../src/data/exam-niveau1.json'), 'utf8'));
const questions = exam.questions;
const byId = Object.fromEntries(questions.map((q) => [q.id, q]));

// --- Open-answer text variants per question, with the score a human grader
//     would *deserve* to give. Mismatch auto-vs-deserved = the showcase.
//     strategy tags: correct | wrong | partial | falsePos | falseNeg
const OPEN = {
  niveau1_q1: {
    correct:  { txt: "Non, elle n'est pas soumise : le niṣāb de l'argent dépasse 1300 €.", deserved: 1 },
    wrong:    { txt: "Oui, elle doit s'acquitter de 32,5 € de zakât.", deserved: 0 },
    falsePos: { txt: "Oui elle est soumise… enfin non, je ne suis pas sûr du montant.", deserved: 0 }, // 'non' → 1
    falseNeg: { txt: "Cette somme est exemptée de la zakât.", deserved: 1 },                            // correct, 0
  },
  niveau1_q2: {
    correct:  { txt: "La dixième année après la révélation.", deserved: 1 },
    wrong:    { txt: "La cinquième année après la révélation.", deserved: 0 },
    falseNeg: { txt: "Vers la dixième année de la mission prophétique.", deserved: 1 },                 // correct, 0
  },
  niveau1_q3: {
    correct:  { txt: "Le décès de Khadīja et de son oncle Abū Ṭālib.", deserved: 1 },
    wrong:    { txt: "À cause de la défaite de Uhud.", deserved: 0 },
    partial:  { txt: "À cause du décès de Khadīja.", deserved: 1 },                                     // 1 grp → 0.5 review
    falsePos: { txt: "Cela n'a rien à voir avec Khadīja ni avec Abū Ṭālib, je ne sais pas.", deserved: 0 }, // 2 grp → 1
  },
  niveau1_q4: {
    correct:  { txt: "Al-Fiqh al-Akbar et al-Fiqh al-Asghar.", deserved: 1 },
    wrong:    { txt: "Le fiqh du commerce et le fiqh du mariage.", deserved: 0 },
    partial:  { txt: "Le grand fiqh (al-Akbar).", deserved: 1 },                                        // 0.5 review
    falseNeg: { txt: "La croyance et les actes pratiques.", deserved: 1 },                              // correct sens, 0
  },
  niveau1_q6: {
    correct:  { txt: "waḥḥada – yuwaḥḥidu", deserved: 1 },
    wrong:    { txt: "ḥamida – yaḥmadu", deserved: 0 },
    falseNeg: { txt: "Du verbe waḥḥada, qui signifie unifier.", deserved: 1 },                          // correct, 0
  },
  niveau1_q8: {
    correct:  { txt: "La possession (mulk), la création (khalq), puis la gérance (tadbir).", deserved: 1 },
    wrong:    { txt: "La miséricorde, la science et la volonté.", deserved: 0 },
    partial:  { txt: "La possession et la création.", deserved: 0.67 },                                 // 0.67 review
    falsePos: { txt: "Dans le désordre : tadbir, puis khalq, puis mulk.", deserved: 0.5 },              // 1 though order wrong
  },
  niveau1_q9: {
    correct:  { txt: "Leur reconnaissance du destin (al-qadar).", deserved: 1 },
    wrong:    { txt: "Leur reconnaissance de la création.", deserved: 0 },
    falsePos: { txt: "C'est sûrement lié au destin, mais je n'en suis pas certain.", deserved: 0 },     // 'destin' → 1
    falseNeg: { txt: "Leur foi en ce qu'Allah décrète d'avance.", deserved: 1 },                        // correct, 0
  },
  niveau1_q17: {
    correct:  { txt: "Ne pas devancer l'imam dans les gestes, et se positionner derrière lui.", deserved: 1 },
    wrong:    { txt: "Prier le plus vite possible pour finir avant lui.", deserved: 0 },
    partial:  { txt: "Ne pas le devancer.", deserved: 1 },                                              // 0.5 review
    falsePos: { txt: "Il faut le devancer et se mettre devant, jamais derrière.", deserved: 0 },        // 2 grp → 1, wrong
  },
  niveau1_q18: {
    correct:  { txt: "Pour s'acquitter de l'obligation avec certitude, et car c'est plus bénéfique pour les pauvres.", deserved: 1 },
    wrong:    { txt: "Parce que l'or coûte plus cher que l'argent.", deserved: 0 },
    partial:  { txt: "Parce que c'est une obligation religieuse.", deserved: 1 },                       // 0.5 review
  },
};

const OPEN_IDS = Object.keys(OPEN);
const CHOICE = questions.filter((q) => q.type === 'mcq' || q.type === 'truefalse');

// deterministic RNG (mulberry32) for reproducible seeds
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  'Yûsuf Belhaj', 'Âmina Cherif', 'Bilâl Mansouri', 'Khadîja Saïdi', 'Idris Hamdani',
  'Maryam Toumi', 'Ismaïl Ferhat', 'Safiya Bennani', 'Hârûn Kaddouri', 'Nûr Lahmar',
  'Zakariya Ouali', 'Asmâ Brahimi', 'Sulaymân Ziani', 'Ruqayya Daoudi', 'Ibrâhîm Saâdi',
  'Hafsa Meziane', 'Mûsâ Tahiri', 'Sumayya Rahal', 'Yahyâ Berkane', 'Lubna Hadji',
  'Anas Boukhari', 'Ouns Slimani', 'Târiq Naceri', 'Halima Drissi', 'Saʿd Belkacem',
  'Rayân Mokrani', 'Janna Tlili', ' Usâma Cheriet', 'Imân Belaïd', 'Hamza Loukil',
];

function slug(name) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
}

// archetypes -> per-open strategy pickers + choice accuracy
const ARCHETYPES = {
  excellent_honest:    { open: () => 'correct',                            choiceAcc: 1.0 },
  excellent_penalized: { open: (r) => (r < 0.4 ? 'falseNeg' : 'correct'),  choiceAcc: 0.95 }, // FN showcase
  keyword_gamer:       { open: (r) => (r < 0.5 ? 'falsePos' : (r < 0.7 ? 'wrong' : 'correct')), choiceAcc: 0.55 }, // FP showcase
  average_partial:     { open: (r) => (r < 0.4 ? 'partial' : (r < 0.7 ? 'correct' : 'wrong')), choiceAcc: 0.7 },
  weak_onsubject:      { open: (r) => (r < 0.7 ? 'wrong' : 'partial'),     choiceAcc: 0.4 },
};
const PLAN = [
  ...Array(6).fill('excellent_honest'),
  ...Array(6).fill('excellent_penalized'),
  ...Array(6).fill('keyword_gamer'),
  ...Array(6).fill('average_partial'),
  ...Array(6).fill('weak_onsubject'),
];

function pickOpenStrategy(qid, want) {
  const bank = OPEN[qid];
  if (bank[want]) return want;
  // fallbacks when an archetype asks for a variant a question lacks
  if (want === 'falseNeg') return bank.partial ? 'partial' : 'wrong';
  if (want === 'falsePos') return bank.partial ? 'partial' : 'correct';
  if (want === 'partial') return 'correct';
  return 'correct';
}

const candidates = PLAN.map((arch, i) => {
  const r = rng(1000 + i * 7);
  const a = ARCHETYPES[arch];
  const name = NAMES[i % NAMES.length];
  const answers = [];
  let deserved = 0;
  const flags = { falsePos: 0, falseNeg: 0, review: 0 };

  for (const q of questions) {
    if (q.type === 'mcq' || q.type === 'truefalse') {
      const correct = r() < a.choiceAcc;
      const idx = correct
        ? q.reponseCorrecte
        : (q.reponseCorrecte + 1) % q.options.length;
      const ans = buildAnswer(q, { reponseChoisie: idx });
      answers.push(ans);
      deserved += ans.pointsObtenus; // choice has no grader limitation
    } else {
      const want = a.open(r());
      const strat = pickOpenStrategy(q.id, want);
      const variant = OPEN[q.id][strat];
      const ans = buildAnswer(q, { reponseTexte: variant.txt });
      answers.push(ans);
      deserved += variant.deserved;
      const gap = +(ans.pointsObtenus - variant.deserved).toFixed(2);
      if (gap > 0.001) flags.falsePos++;
      else if (gap < -0.001) flags.falseNeg++;
      if (ans.needsReview) flags.review++;
    }
  }

  const { score, total } = tallyScore(answers);
  return {
    name, email: `${slug(name)}@eleve.test`, telegram: '@' + slug(name).replace(/\./g, '_'),
    archetype: arch, answers, auto: score, deserved: +deserved.toFixed(2), total, flags,
  };
});

// --- showcase summary table ------------------------------------------------
const pad = (s, n) => String(s).padEnd(n);
const padN = (s, n) => String(s).padStart(n);
console.log('\n  30 attempts — autocorrector showcase (exam: ' + exam.examen.titre + ')\n');
console.log('  ' + pad('#', 3) + pad('Candidate', 20) + pad('Archetype', 22)
  + padN('Auto', 6) + padN('Deserv', 8) + padN('Gap', 7) + '  FP/FN/Rev');
console.log('  ' + '-'.repeat(78));
let tFP = 0, tFN = 0, tRev = 0;
candidates.forEach((c, i) => {
  const gap = +(c.auto - c.deserved).toFixed(2);
  tFP += c.flags.falsePos; tFN += c.flags.falseNeg; tRev += c.flags.review;
  const gapStr = (gap > 0 ? '+' : '') + gap;
  console.log('  ' + pad(i + 1, 3) + pad(c.name, 20) + pad(c.archetype, 22)
    + padN(c.auto, 6) + padN(c.deserved, 8) + padN(gapStr, 7)
    + '   ' + c.flags.falsePos + ' / ' + c.flags.falseNeg + ' / ' + c.flags.review);
});
console.log('  ' + '-'.repeat(78));
console.log(`  Totals across 30 attempts:  false-positives=${tFP}  false-negatives=${tFN}  needsReview=${tRev}`);
console.log('  (FP = grader gave points it should not — keyword fooled it.');
console.log('   FN = grader withheld points a correct paraphrase deserved — exact-match too strict.');
console.log('   Rev = flagged needsReview for a human corrector.)\n');

if (process.argv.includes('--json')) {
  mkdirSync(join(__dir, 'out'), { recursive: true });
  writeFileSync(join(__dir, 'out/attempts.json'), JSON.stringify(candidates, null, 2));
  console.log('  wrote scripts/out/attempts.json\n');
}

if (process.argv.includes('--sql')) {
  const EXAM_ID = 'bedcd834-46dc-4b7c-bfc4-f562e5da6460';
  const q = (s) => String(s).replace(/'/g, "''"); // SQL single-quote escape
  const rows = candidates.map((c, i) => {
    const json = q(JSON.stringify(c.answers));
    const hoursAgo = (candidates.length - i) * 8; // spread submissions over ~10 days
    return `  -- #${i + 1} ${c.name} [${c.archetype}]  auto=${c.auto}/${c.total}  deserved=${c.deserved}
  insert into public.candidates (exam_id, full_name, email, telegram, tenant_id, created_at)
  values (v_exam, '${q(c.name)}', '${q(c.email)}', '${q(c.telegram)}', v_tenant, now() - interval '${hoursAgo} hours')
  returning id into v_cand;
  insert into public.attempts (exam_id, candidate_id, answers, score, total, tenant_id, started_at, submitted_at)
  values (v_exam, v_cand, '${json}'::jsonb, ${c.auto}, ${c.total}, v_tenant,
          now() - interval '${hoursAgo} hours', now() - interval '${hoursAgo - 1} hours');`;
  }).join('\n\n');

  const sql = `-- Seed: 30 candidate attempts for the Niveau 1 exam.
-- Generated by scripts/seed-attempts.mjs (real grader output). RUN ONCE.
-- Showcases the deterministic autocorrector's limits:
--   keyword_gamer rows score ABOVE deserved (false positives),
--   excellent_penalized rows score BELOW deserved (false negatives, strict exact-match),
--   partial answers carry needsReview=true for a human corrector.
--
-- To remove this seed later:
--   delete from public.attempts where candidate_id in
--     (select id from public.candidates where email like '%@eleve.test');
--   delete from public.candidates where email like '%@eleve.test';

do $$
declare
  v_exam   uuid;
  v_tenant uuid;
  v_cand   uuid;
begin
  select id, tenant_id into v_exam, v_tenant
  from public.exams where id = '${EXAM_ID}';
  if v_exam is null then
    raise exception 'Exam ${EXAM_ID} not found';
  end if;

${rows}
end $$;
`;
  mkdirSync(join(__dir, 'out'), { recursive: true });
  writeFileSync(join(__dir, 'out/seed-attempts.sql'), sql);
  console.log('  wrote scripts/out/seed-attempts.sql\n');
}
