/* D'Griff Trésorerie — logique de l'application (vanilla JS, aucune dépendance) */

const STORAGE_KEY = 'dgriff_tresorerie_v1';
const todayISO = () => new Date().toISOString().slice(0, 10);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* Les montants ci-dessous sont volontairement à 0 : ce fichier est public sur
   GitHub, il ne doit jamais contenir de vraies données personnelles ou
   bancaires. Les catégories/libellés reprennent la structure définie lors du
   cadrage, à toi de renseigner tes propres montants dans Réglages au premier
   lancement — ils resteront alors uniquement sur ton appareil. */
function defaultState() {
  const today = todayISO();
  return {
    version: 1,
    premierLancement: true,
    settings: {
      soldeCompteCourant: 0,
      soldeCompteDepot: 0,
      dateReferenceSolde: today,
      decouvertAutorise: 0,
      tauxUrssaf: 13,
      objectifCA: 4000,
      datePrelevementDiffere: 12, // jour du mois
      dateClotureDifferee: 5, // estimation, jour du mois — à ajuster dans Réglages
      delaiEncaissementJours: 1, // SumUp -> compte, J+1
    },
    charges: [
      { id: uid(), label: 'Loyer boutique', montant: 0, type: 'pro', actif: true },
      { id: uid(), label: 'Prêt professionnel', montant: 0, type: 'pro', actif: true },
      { id: uid(), label: 'Assurance véhicule', montant: 0, type: 'pro', actif: true },
      { id: uid(), label: 'Assurance local commercial', montant: 0, type: 'pro', actif: true },
      { id: uid(), label: 'Électricité boutique', montant: 0, type: 'pro', actif: true },
      { id: uid(), label: 'Internet boutique', montant: 0, type: 'pro', actif: true },
      { id: uid(), label: 'Téléphone', montant: 0, type: 'pro', actif: true },
      { id: uid(), label: 'Tenue de compte', montant: 0, type: 'pro', actif: true },
      { id: uid(), label: 'Loyer logement', montant: 0, type: 'perso', actif: true },
      { id: uid(), label: 'Assurance maison', montant: 0, type: 'perso', actif: true },
    ],
    echeancesAnnuelles: [
      { id: uid(), label: 'CFE', montant: 0, type: 'pro', dateEcheance: today.slice(0, 4) + '-12-15', estimee: true },
    ],
    transactions: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.settings) return defaultState();
    return parsed;
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Sauvegarde impossible', e);
  }
}

let state = loadState();

/* ---------- Helpers dates ---------- */

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayOfMonth(dateStr) {
  return parseInt(dateStr.slice(8, 10), 10);
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function addMonths(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function isoWithDay(dateStr, day) {
  const [y, m] = dateStr.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, day);
  return d.toISOString().slice(0, 10);
}

/* Calcule la date de prélèvement prévue d'un achat en carte différée,
   à partir de la date d'achat et des réglages clôture/prélèvement. */
function datePrelevementPrevue(dateAchat) {
  const { dateClotureDifferee: C, datePrelevementDiffere: P } = state.settings;
  const d = dayOfMonth(dateAchat);
  let clotureRef = isoWithDay(dateAchat, C);
  if (d > C) clotureRef = addMonths(clotureRef, 1);
  let prelevement = isoWithDay(clotureRef, P);
  if (P < C) prelevement = addMonths(prelevement, 1);
  return prelevement;
}

/* ---------- Transactions ---------- */

function addTransaction(tx) {
  tx.id = uid();
  if (!tx.date) tx.date = todayISO();
  state.transactions.push(tx);
  saveState();
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter((t) => t.id !== id);
  saveState();
}

function updateTransaction(id, patch) {
  const t = state.transactions.find((t) => t.id === id);
  if (t) Object.assign(t, patch);
  saveState();
}

/* ---------- Calculs financiers ---------- */

// Date effective à laquelle une transaction impacte le solde bancaire
function dateEffetBancaire(tx) {
  if (tx.type === 'ca') return addDays(tx.date, state.settings.delaiEncaissementJours);
  if (tx.type === 'achat' && tx.moyenPaiement === 'carte_differee') {
    return tx.datePrelevementOverride || datePrelevementPrevue(tx.date);
  }
  return tx.date;
}

function impactSolde(tx) {
  // signe de l'effet sur le solde bancaire, une fois effectif
  switch (tx.type) {
    case 'ca':
    case 'entree_autre':
    case 'injection':
      return tx.montant;
    case 'achat':
      return -tx.montant; // (carte différée: seulement à la date de prélèvement, cf dateEffetBancaire)
    case 'depense':
    case 'retrait':
    case 'paiement_charge':
      return -tx.montant;
    case 'correction_solde':
      return null; // traité à part : redéfinit une nouvelle référence
    default:
      return 0;
  }
}

function soldeBancaireActuel(asOf = todayISO()) {
  let solde = state.settings.soldeCompteCourant + state.settings.soldeCompteDepot;
  let refDate = state.settings.dateReferenceSolde;

  const corrections = state.transactions
    .filter((t) => t.type === 'correction_solde' && t.date > refDate && t.date <= asOf)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const mouvements = state.transactions.filter((t) => {
    if (t.type === 'correction_solde') return false;
    const eff = dateEffetBancaire(t);
    return eff > refDate && eff <= asOf;
  });

  // Applique corrections et mouvements dans l'ordre chronologique
  const timeline = [
    ...corrections.map((t) => ({ date: t.date, kind: 'correction', tx: t })),
    ...mouvements.map((t) => ({ date: dateEffetBancaire(t), kind: 'mouvement', tx: t })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  for (const item of timeline) {
    if (item.kind === 'correction') {
      solde = item.tx.montant;
    } else {
      const delta = impactSolde(item.tx);
      if (delta !== null) solde += delta;
    }
  }
  return solde;
}

function encoursDiffereDetail(asOf = todayISO()) {
  const P = state.settings.datePrelevementDiffere;
  const prochainePrelevementDate = isoWithDay(asOf, P) >= asOf ? isoWithDay(asOf, P) : isoWithDay(addMonths(asOf, 1), P);

  let cycleActuel = 0; // sera débité au prochain prélèvement
  let cycleSuivant = 0; // débité au prélèvement d'après

  for (const t of state.transactions) {
    if (t.type !== 'achat' || t.moyenPaiement !== 'carte_differee') continue;
    const eff = t.datePrelevementOverride || datePrelevementPrevue(t.date);
    if (eff <= asOf) continue; // déjà prélevé, déjà reflété dans le solde bancaire
    if (eff <= prochainePrelevementDate) cycleActuel += t.montant;
    else cycleSuivant += t.montant;
  }
  return { cycleActuel, cycleSuivant, total: cycleActuel + cycleSuivant, prochainePrelevementDate };
}

function caPourPeriode(dateDebut, dateFin) {
  return state.transactions
    .filter((t) => t.type === 'ca' && t.date >= dateDebut && t.date <= dateFin)
    .reduce((s, t) => s + t.montant, 0);
}

function caAujourdHui() {
  const t = todayISO();
  return caPourPeriode(t, t);
}

function startOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function caCetteSemaine() {
  return caPourPeriode(startOfWeek(todayISO()), todayISO());
}

function caCeMois() {
  const mk = monthKey(todayISO());
  return state.transactions
    .filter((t) => t.type === 'ca' && monthKey(t.date) === mk)
    .reduce((s, t) => s + t.montant, 0);
}

function chargesActivesDuMois(dateRef = todayISO()) {
  const mk = monthKey(dateRef);
  const mensuelles = state.charges.filter((c) => c.actif && (!c.dateFin || c.dateFin >= dateRef));
  const totalMensuelles = mensuelles.reduce((s, c) => s + c.montant, 0);

  const echeancesDuMois = state.echeancesAnnuelles.filter((e) => monthKey(e.dateEcheance) === mk);
  const totalEcheances = echeancesDuMois.reduce((s, e) => s + e.montant, 0);

  const proMensuelles = mensuelles.filter((c) => c.type === 'pro').reduce((s, c) => s + c.montant, 0);
  const persoMensuelles = mensuelles.filter((c) => c.type === 'perso').reduce((s, c) => s + c.montant, 0);

  return {
    mensuelles, echeancesDuMois,
    total: totalMensuelles + totalEcheances,
    pro: proMensuelles + echeancesDuMois.filter((e) => e.type === 'pro').reduce((s, e) => s + e.montant, 0),
    perso: persoMensuelles + echeancesDuMois.filter((e) => e.type === 'perso').reduce((s, e) => s + e.montant, 0),
  };
}

function reserveUrssaf() {
  return caCeMois() * (state.settings.tauxUrssaf / 100);
}

function disponibleReel(asOf = todayISO()) {
  const solde = soldeBancaireActuel(asOf);
  const differe = encoursDiffereDetail(asOf);
  const urssaf = reserveUrssaf();
  const charges = chargesActivesDuMois(asOf);
  const disponible = solde - differe.total - urssaf - charges.total;
  return { solde, differe, urssaf, charges, disponible };
}

function niveauDisponible(valeur, chargesTotal) {
  if (valeur <= 0) {
    if (chargesTotal > 0 && valeur >= -chargesTotal * 0.3) return 'orange';
    return 'rouge';
  }
  if (chargesTotal === 0 || valeur > chargesTotal * 0.5) return 'vert';
  return 'jaune';
}

function simulerAchat(montant) {
  const avant = disponibleReel();
  const apres = avant.disponible - montant;
  const niveau = niveauDisponible(apres, avant.charges.total);
  return { avant, apres, niveau, soldeFutur: avant.solde, montant };
}

/* Prévisions simples basées sur un CA hebdomadaire prévisionnel */
function previsionA(dateCible, caHebdoPrevisionnel) {
  const aujourdhui = todayISO();
  const joursRestants = Math.round((new Date(dateCible) - new Date(aujourdhui)) / 86400000);
  const caProjete = caHebdoPrevisionnel > 0 ? (joursRestants / 7) * caHebdoPrevisionnel : 0;
  const base = disponibleReel(aujourdhui);
  return {
    dateCible, joursRestants,
    disponibleProjete: base.disponible + Math.max(0, caProjete) * (1 - state.settings.tauxUrssaf / 100),
  };
}

/* Expose sur window pour ui.js */
window.DG = {
  state, saveState, addTransaction, deleteTransaction, updateTransaction,
  soldeBancaireActuel, encoursDiffereDetail, caAujourdHui, caCetteSemaine, caCeMois,
  chargesActivesDuMois, reserveUrssaf, disponibleReel, simulerAchat, previsionA, niveauDisponible,
  todayISO, uid, monthKey, caPourPeriode,
};
