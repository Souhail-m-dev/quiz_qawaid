# PRD – Application Quiz : Al-Qawā'id Al-Muthlaa
## Les Noms et Attributs d'Allah – Dr. Abdelrahman Abu AbdelWahhab

---

## 1. Vision du projet

Créer une application web de quiz interactive permettant aux élèves ayant suivi les cours d'Al-Qawā'id Al-Muthlaa de réviser et tester leurs connaissances. L'application tire ses questions d'une banque de données structurée couvrant les 21 cours, avec une sélection aléatoire équilibrée par niveau de difficulté.

---

## 2. Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React (functional components + hooks) |
| Styling | Tailwind CSS (classes utilitaires uniquement) |
| Données | Fichier JSON local importé statiquement |
| State | `useState`, `useReducer` |
| Routing | Aucun (SPA à écran unique) |
| Build | Vite |
| Déploiement | Vercel / Netlify (fichier statique) |

> **Contrainte critique** : aucune balise HTML `<form>`. Tous les inputs utilisent `onClick` / `onChange`.

---

## 3. Structure des données

### 3.1 Fichier source : `src/data/questions.json`

```json
{
  "meta": {
    "title": "Quiz Al-Qawā'id Al-Muthlaa",
    "subtitle": "Les Noms et Attributs d'Allah",
    "instructor": "Dr. Abdelrahman Abu AbdelWahhab",
    "totalCours": 21,
    "questionsPerCours": 20,
    "questionsPerQuiz": 30,
    "difficultyDistributionPerQuiz": {
      "facile": 10,
      "moyenne": 10,
      "difficile": 10
    },
    "difficultyDistributionPerCours": {
      "facile": 10,
      "moyenne": 5,
      "difficile": 5
    }
  },
  "cours": [
    {
      "id": 1,
      "titre": "Introduction à l'unicité d'Allah (at-Tawḥīd)",
      "date": "...",
      "questions": [
        {
          "id": "c1_q1",
          "cours": 1,
          "difficulte": "facile",
          "question": "...",
          "options": ["A", "B", "C", "D"],
          "reponseCorrecte": 0,
          "justification": "..."
        }
      ]
    }
  ]
}
```

### 3.2 Types TypeScript (si migration souhaitée)

```ts
type Difficulte = "facile" | "moyenne" | "difficile";

interface Question {
  id: string;
  cours: number;
  difficulte: Difficulte;
  question: string;
  options: [string, string, string, string];
  reponseCorrecte: 0 | 1 | 2 | 3;
  justification: string;
}

interface Cours {
  id: number;
  titre: string;
  date: string;
  questions: Question[];
}

interface QuizData {
  meta: Meta;
  cours: Cours[];
}
```

---

## 4. Algorithme de sélection des questions

```
FUNCTION selectQuestions(data, mode):
  
  IF mode === "tous":
    pool = toutes les questions de tous les cours (21 × 20 = 420)
  ELSE IF mode === "cours":
    pool = questions du cours sélectionné (20 questions)
    → retourner les 20 questions directement (pas de sélection aléatoire)
  
  // Pour le mode "tous" :
  faciles   = shuffle(pool.filter(d === "facile")).slice(0, 10)
  moyennes  = shuffle(pool.filter(d === "moyenne")).slice(0, 10)
  difficiles= shuffle(pool.filter(d === "difficile")).slice(0, 10)
  
  RETURN shuffle([...faciles, ...moyennes, ...difficiles])
  // → 30 questions mélangées
```

**Règle** : la fonction `shuffle` implémente l'algorithme Fisher-Yates.

---

## 5. Écrans et flux de navigation

```
[Écran Accueil]
       ↓
[Sélection du mode]
  ├── Mode "Quiz complet" (30 questions, tous cours)
  └── Mode "Par cours" (sélectionner un cours → 20 questions)
       ↓
[Écran Quiz]
  → Question (1/30 ou 1/20)
  → 4 choix (boutons radio visuels)
  → Bouton "Valider"
  → Feedback immédiat (correct/incorrect + justification)
  → Bouton "Question suivante"
       ↓
[Écran Résultats]
  → Score global
  → Score par difficulté
  → Liste des questions ratées avec réponse correcte
  → Boutons : "Rejouer" / "Retour accueil"
```

---

## 6. Composants React

### Architecture des fichiers

```
src/
├── App.jsx                   # Orchestrateur principal (état global)
├── data/
│   └── questions.json        # Banque de questions
├── utils/
│   └── quizUtils.js          # shuffle(), selectQuestions()
├── components/
│   ├── Accueil.jsx            # Écran d'accueil + sélection mode
│   ├── SelectionCours.jsx     # Liste des 21 cours (mode par cours)
│   ├── QuizSession.jsx        # Écran de quiz actif
│   ├── QuestionCard.jsx       # Une question + ses options
│   ├── OptionButton.jsx       # Bouton de choix de réponse
│   ├── FeedbackPanel.jsx      # Affichage correct/incorrect + justification
│   ├── ProgressBar.jsx        # Barre de progression (n/total)
│   ├── ScoreIndicator.jsx     # Compteur de bonnes réponses en temps réel
│   └── ResultatsFinaux.jsx    # Écran de résultats
```

### États globaux (App.jsx)

```js
const [phase, setPhase] = useState("accueil"); 
// "accueil" | "selection_cours" | "quiz" | "resultats"

const [mode, setMode] = useState(null);
// "complet" | "cours"

const [coursSelectionne, setCoursSelectionne] = useState(null);

const [questions, setQuestions] = useState([]);
// Questions sélectionnées pour la session en cours

const [indexQuestion, setIndexQuestion] = useState(0);

const [reponses, setReponses] = useState([]);
// Array de { questionId, reponseChoisie, estCorrecte }

const [reponseEnCours, setReponseEnCours] = useState(null);
// Index de l'option sélectionnée (0-3) ou null

const [feedbackVisible, setFeedbackVisible] = useState(false);
```

---

## 7. Comportement détaillé par composant

### 7.1 QuestionCard

- Affiche le numéro de la question (ex. "Question 5 / 30")
- Affiche le badge de difficulté (vert=facile, orange=moyenne, rouge=difficile)
- Affiche le texte de la question
- Affiche 4 boutons `OptionButton`
- Bouton "Valider" désactivé tant qu'aucune option n'est sélectionnée
- Après validation : boutons désactivés, feedback visible

### 7.2 OptionButton

États visuels :
- **Neutre** : fond blanc/gris, bordure légère
- **Sélectionné** : bordure bleue, fond bleu clair
- **Correct** (après validation) : fond vert, icône ✓
- **Incorrect sélectionné** (après validation) : fond rouge, icône ✗
- **Correct non sélectionné** (après validation) : fond vert clair pour montrer la bonne réponse

### 7.3 FeedbackPanel

- Affiché après validation uniquement
- Indique "✓ Bonne réponse !" ou "✗ Mauvaise réponse"
- Affiche la justification tirée du JSON
- Bouton "Question suivante" (ou "Voir les résultats" à la dernière question)

### 7.4 ProgressBar

- Barre de progression horizontale : `(indexQuestion / total) * 100%`
- Affiche "X / Y" en texte

### 7.5 ScoreIndicator

- Affiché pendant le quiz
- Format : "✓ X bonnes réponses"
- Mis à jour en temps réel après chaque validation

### 7.6 ResultatsFinaux

Sections affichées :
1. **Score global** : `X / Y` avec mention (voir section 8)
2. **Score par difficulté** :
   - Faciles : X/10
   - Moyennes : X/10
   - Difficiles : X/10
3. **Questions ratées** : liste déroulante de chaque question incorrecte avec la bonne réponse et justification
4. **Boutons d'action** :
   - "Rejouer avec les mêmes paramètres" → repart au `selectQuestions`
   - "Nouveau quiz" → retour à `phase = "accueil"`

---

## 8. Système de mention (ResultatsFinaux)

| Score | Mention |
|-------|---------|
| 28-30 / 30 | Excellent – Qu'Allah vous bénisse |
| 24-27 / 30 | Très bien |
| 18-23 / 30 | Bien |
| 12-17 / 30 | Passable – À retravailler |
| 0-11 / 30  | Insuffisant – Révisez le cours |

*(Adapter proportionnellement si mode "par cours" = 20 questions)*

---

## 9. Design UI/UX

### Palette de couleurs

```css
--color-primary: #1B3A5C;       /* Bleu nuit islamique */
--color-primary-light: #2E5F8A;
--color-accent: #C9A84C;        /* Or */
--color-accent-light: #F0D080;
--color-bg: #F5F0E8;            /* Parchemin */
--color-surface: #FFFFFF;
--color-text: #1A1A1A;
--color-text-muted: #6B7280;
--color-correct: #16A34A;       /* Vert */
--color-incorrect: #DC2626;     /* Rouge */
--color-facile: #16A34A;
--color-moyenne: #D97706;
--color-difficile: #DC2626;
```

### Typographie

- Titre principal : police serif arabisante ou classique (ex. `Amiri`, `Scheherazade New`)
- Corps : police lisible (ex. `Noto Serif`, `Georgia`)
- Import via Google Fonts dans `index.html`

### Responsive

- Mobile-first : tout doit fonctionner sur écran 375px
- Boutons d'options en colonne sur mobile, grille 2×2 possible sur desktop
- Pas de scroll horizontal

### Accessibilité

- Contraste suffisant (WCAG AA)
- `aria-label` sur les boutons d'options
- Focus visible sur tous les éléments interactifs

---

## 10. Règles métier importantes

1. **Jamais de référence au numéro de cours** dans le texte d'une question ou d'une option.
2. **Jamais de texte arabe** dans les questions, options et justifications (uniquement les traductions françaises).
3. **Fidélité au PDF** : toute question, option et justification doit être directement tirée du contenu du PDF correspondant, sans ajout ni reformulation extensive.
4. **Randomisation** : à chaque nouveau quiz, les questions sont re-sélectionnées aléatoirement (Fisher-Yates).
5. **Pas de répétition** dans la même session : une question ne peut apparaître qu'une seule fois par quiz.

---

## 11. Fichiers à créer

```
quiz-alqawaaid/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.css               # Variables CSS globales
│   ├── data/
│   │   └── questions.json    # Banque complète (21 cours × 20 questions)
│   ├── utils/
│   │   └── quizUtils.js
│   └── components/
│       ├── Accueil.jsx
│       ├── SelectionCours.jsx
│       ├── QuizSession.jsx
│       ├── QuestionCard.jsx
│       ├── OptionButton.jsx
│       ├── FeedbackPanel.jsx
│       ├── ProgressBar.jsx
│       ├── ScoreIndicator.jsx
│       └── ResultatsFinaux.jsx
```

---

## 12. Commandes d'initialisation

```bash
npm create vite@latest quiz-alqawaaid -- --template react
cd quiz-alqawaaid
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm run dev
```

---

## 13. Critères d'acceptance (Definition of Done)

- [ ] L'application charge sans erreur console
- [ ] Le mode "Quiz complet" génère exactement 30 questions (10 faciles, 10 moyennes, 10 difficiles)
- [ ] Le mode "Par cours" affiche les 20 questions du cours sélectionné
- [ ] Chaque question propose exactement 4 options
- [ ] La validation affiche correctement : bonne/mauvaise réponse + justification
- [ ] Le compteur de bonnes réponses se met à jour en temps réel
- [ ] L'écran de résultats affiche : score global, scores par difficulté, questions ratées
- [ ] La randomisation varie entre chaque session (Fisher-Yates)
- [ ] L'interface est responsive (mobile 375px → desktop 1440px)
- [ ] Aucun texte arabe n'apparaît dans les questions/options/justifications
- [ ] Aucune référence au numéro de cours dans les questions

---

## 14. Livraisons attendues de Claude Code

1. Scaffold complet du projet (`npm create vite` + configuration Tailwind)
2. Fichier `src/data/questions.json` complet (21 cours × 20 questions)
3. Tous les composants React listés en section 6
4. `src/utils/quizUtils.js` avec `shuffle()` et `selectQuestions()`
5. `App.jsx` avec la gestion d'état complète
6. `App.css` avec les variables CSS
7. `index.html` avec les imports Google Fonts

---

*Document rédigé pour Claude Code – Version 1.0 – Mai 2026*
