/* D'Griff Trésorerie — interface (rendu des vues, formulaires, événements) */

const CATEGORIES = ['Vêtements', 'Chaussures', 'Accessoires', 'Sacs', 'Bijoux', 'Électronique', 'Matériel boutique'];
const MOYENS_PAIEMENT = [
  { v: 'carte_differee', l: 'Carte différée' },
  { v: 'carte_immediate', l: 'Carte immédiate' },
  { v: 'comptant', l: 'Comptant' },
  { v: 'virement', l: 'Virement' },
];
const TYPES_SAISIE = [
  { v: 'ca', ic: '💰', l: 'CA du jour' },
  { v: 'entree_autre', ic: '➕', l: 'Autre entrée' },
  { v: 'injection', ic: '🏦', l: 'Injection perso' },
  { v: 'achat', ic: '🛍️', l: 'Achat marchandise' },
  { v: 'depense', ic: '💸', l: 'Autre dépense' },
  { v: 'retrait', ic: '🙋', l: 'Retrait perso' },
  { v: 'paiement_charge', ic: '📄', l: 'Paiement charge' },
  { v: 'correction_solde', ic: '⚖️', l: 'Corriger solde' },
];

let currentView = 'dashboard';
let saisieType = 'ca';
let editingTxId = null;
let histMonth = window.DG.monthKey(window.DG.todayISO());
let dernierResultatSim = null;

function openEditTx(id) {
  const tx = window.DG.state.transactions.find((t) => t.id === id);
  if (!tx) return;
  editingTxId = id;
  saisieType = tx.type;
  switchView('saisie');
}

function euro(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function niveauLabel(n) {
  return { vert: '🟢 Achat possible', jaune: '🟡 Prudence', orange: '🟠 Risqué', rouge: '🔴 Déconseillé' }[n];
}
function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function switchView(v) {
  currentView = v;
  document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === 'view-' + v));
  document.querySelectorAll('nav.bottomnav button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  renderCurrent();
  window.scrollTo(0, 0);
}

function renderCurrent() {
  if (currentView === 'dashboard') renderDashboard();
  else if (currentView === 'saisie') renderSaisie();
  else if (currentView === 'simulateur') renderSimulateur();
  else if (currentView === 'historique') renderHistorique();
  else if (currentView === 'reglages') renderReglages();
}

/* ---------------- DASHBOARD ---------------- */

function renderDashboard() {
  const D = window.DG;
  const d = D.disponibleReel();
  const niveau = D.niveauDisponible(d.disponible, d.charges.total);
  const objectif = D.state.settings.objectifCA;
  const caMois = D.caCeMois();
  const reste = Math.max(0, objectif - caMois);

  const hint = D.state.premierLancement ? `
    <div class="card" style="border-color:var(--gold)">
      <h2 style="color:var(--gold)">Premier lancement</h2>
      <p style="margin:0 0 10px;color:var(--text)">Renseigne ton solde bancaire, tes charges et le taux URSSAF dans <b>Réglages</b> pour que le disponible réel soit juste. Ces informations restent uniquement sur ton téléphone.</p>
      <button class="btn secondary" id="hint-goto-reglages">Aller dans Réglages</button>
      <button class="btn secondary" id="hint-dismiss" style="margin-top:8px">Masquer ce message</button>
    </div>` : '';

  document.getElementById('view-dashboard').innerHTML = `
    ${hint}
    <div class="hero">
      <div class="label">🛍️ Je peux acheter</div>
      <div class="value num">${euro(Math.max(0, d.disponible))}</div>
      <div class="detail">${D.state.premierLancement ? 'Complète tes réglages pour un calcul fiable' : niveauLabel(niveau) + (d.disponible < 0 ? ' · disponible réel ' + euro(d.disponible) : '')}</div>
    </div>

    <div class="grid2">
      <div class="stat"><div class="l">Solde banque</div><div class="v num ${d.solde < 0 ? 'neg' : ''}">${euro(d.solde)}</div></div>
      <div class="stat"><div class="l">CA aujourd'hui</div><div class="v num pos">${euro(D.caAujourdHui())}</div></div>
      <div class="stat"><div class="l">CA cette semaine</div><div class="v num">${euro(D.caCetteSemaine())}</div></div>
      <div class="stat"><div class="l">CA ce mois</div><div class="v num">${euro(caMois)}</div></div>
    </div>

    <div class="card" style="margin-top:14px">
      <h2>Objectif du mois</h2>
      <div class="rows">
        <div class="row"><div>Objectif</div><div class="amount num">${euro(objectif)}</div></div>
        <div class="row"><div>Réalisé</div><div class="amount num">${euro(caMois)}</div></div>
        <div class="row"><div>Reste à faire</div><div class="amount num" style="color:var(--accent)">${euro(reste)}</div></div>
      </div>
    </div>

    <div class="card">
      <h2>Ce qui est réservé / engagé</h2>
      <div class="rows">
        <div class="row"><div>Charges du mois à couvrir<span class="meta">pro + perso, réserve de sécurité incluse</span></div><div class="amount num">${euro(d.charges.total)}</div></div>
        <div class="row"><div>Réserve URSSAF (${D.state.settings.tauxUrssaf}% du CA)</div><div class="amount num">${euro(d.urssaf)}</div></div>
        <div class="row"><div>Différé à débiter le ${D.state.settings.datePrelevementDiffere}<span class="meta">prochain prélèvement</span></div><div class="amount num">${euro(d.differe.cycleActuel)}</div></div>
        <div class="row"><div>Différé en cours d'accumulation<span class="meta">prélèvement suivant</span></div><div class="amount num">${euro(d.differe.cycleSuivant)}</div></div>
        <div class="row" style="border-top:2px solid var(--text);margin-top:4px;padding-top:10px"><div style="font-weight:700">Disponible réel</div><div class="amount num" style="font-weight:700;color:var(--accent)">${euro(d.disponible)}</div></div>
      </div>
    </div>

    <div class="card">
      <h2>Actions rapides</h2>
      <div class="typegrid" id="quick-actions"></div>
    </div>
  `;

  const qa = document.getElementById('quick-actions');
  TYPES_SAISIE.slice(0, 6).forEach((t) => {
    const b = document.createElement('button');
    b.innerHTML = `<span class="ic">${t.ic}</span>${t.l}`;
    b.onclick = () => { saisieType = t.v; editingTxId = null; switchView('saisie'); };
    qa.appendChild(b);
  });

  const goReglages = document.getElementById('hint-goto-reglages');
  if (goReglages) goReglages.onclick = () => switchView('reglages');
  const dismiss = document.getElementById('hint-dismiss');
  if (dismiss) dismiss.onclick = () => { D.state.premierLancement = false; D.saveState(); renderDashboard(); };
}

/* ---------------- SAISIE ---------------- */

function renderSaisie() {
  const D = window.DG;
  const wrap = document.getElementById('view-saisie');
  const editing = editingTxId ? D.state.transactions.find((t) => t.id === editingTxId) : null;
  if (editingTxId && !editing) editingTxId = null; // référence obsolète (déjà supprimée)

  const typeGrid = TYPES_SAISIE.map((t) => `<button data-t="${t.v}" class="${t.v === saisieType ? 'selected' : ''}"><span class="ic">${t.ic}</span>${t.l}</button>`).join('');

  let extraFields = '';
  if (saisieType === 'achat') {
    extraFields = `
      <div class="field"><label>Moyen de paiement</label>
        <select id="f-moyen">${MOYENS_PAIEMENT.map((m) => `<option value="${m.v}" ${editing && editing.moyenPaiement === m.v ? 'selected' : ''}>${m.l}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Catégorie</label>
        <select id="f-categorie"><option value="">—</option>${CATEGORIES.map((c) => `<option value="${c}" ${editing && editing.categorie === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Fournisseur / plateforme</label><input id="f-fournisseur" type="text" placeholder="TikTok, Whatnot, Internet..." value="${editing ? (editing.fournisseur || '') : ''}"></div>
    `;
  } else if (saisieType === 'paiement_charge') {
    const charges = D.state.charges.filter((c) => c.actif);
    extraFields = `
      <div class="field"><label>Charge concernée (optionnel)</label>
        <select id="f-charge"><option value="">—</option>${charges.map((c) => `<option value="${c.id}" data-montant="${c.montant}" ${editing && editing.chargeId === c.id ? 'selected' : ''}>${c.label} (${euro(c.montant)})</option>`).join('')}</select>
      </div>
    `;
  } else if (saisieType === 'correction_solde') {
    extraFields = `<p style="color:var(--text-dim);font-size:.85rem;margin-top:-6px">Renseigne le nouveau solde total (compte courant + compte de dépôt) tel qu'affiché par ta banque.</p>`;
  }

  const montantLabel = saisieType === 'correction_solde' ? 'Nouveau solde total' : 'Montant';
  const montantValue = editing ? editing.montant : '';
  const dateValue = editing ? editing.date : D.todayISO();
  const commentaireValue = editing ? (editing.commentaire || '') : '';

  wrap.innerHTML = `
    <div class="card"><h2>${editing ? 'Modifier ce mouvement' : 'Que veux-tu enregistrer ?'}</h2><div class="typegrid" id="type-grid">${typeGrid}</div></div>
    <div class="card">
      <div class="field"><label>${montantLabel}</label><input id="f-montant" type="number" step="0.01" inputmode="decimal" placeholder="0,00" value="${montantValue}"></div>
      <div class="field"><label>Date</label><input id="f-date" type="date" value="${dateValue}"></div>
      ${extraFields}
      <div class="field"><label>Commentaire (facultatif)</label><textarea id="f-commentaire">${commentaireValue}</textarea></div>
      <button class="btn" id="btn-save">${editing ? 'Enregistrer les modifications' : 'Enregistrer'}</button>
      ${editing ? '<button class="btn secondary" id="btn-cancel-edit" style="margin-top:10px">Annuler</button>' : ''}
    </div>
  `;

  wrap.querySelectorAll('#type-grid button').forEach((b) => {
    b.onclick = () => { saisieType = b.dataset.t; renderSaisie(); };
  });

  if (editing) {
    document.getElementById('btn-cancel-edit').onclick = () => {
      editingTxId = null;
      switchView('historique');
    };
  }

  document.getElementById('btn-save').onclick = () => {
    const montant = parseFloat(document.getElementById('f-montant').value);
    if (isNaN(montant) || montant <= 0) { toast('Indique un montant valide'); return; }
    const date = document.getElementById('f-date').value || D.todayISO();
    const commentaire = document.getElementById('f-commentaire').value || '';

    const tx = { type: saisieType, montant, date, commentaire };
    if (saisieType === 'achat') {
      tx.moyenPaiement = document.getElementById('f-moyen').value;
      tx.categorie = document.getElementById('f-categorie').value;
      tx.fournisseur = document.getElementById('f-fournisseur').value;
    }
    if (saisieType === 'paiement_charge') {
      tx.chargeId = document.getElementById('f-charge').value || null;
    }

    if (editingTxId) {
      D.updateTransaction(editingTxId, tx);
      editingTxId = null;
      toast('Modifié ✓');
    } else {
      D.addTransaction(tx);
      toast('Enregistré ✓');
    }
    switchView('historique');
  };
}

/* ---------------- SIMULATEUR ---------------- */

function renderSimulateur() {
  const wrap = document.getElementById('view-simulateur');
  const D = window.DG;
  const avant = D.disponibleReel();

  wrap.innerHTML = `
    <div class="card">
      <h2>Je veux acheter pour...</h2>
      <div class="field"><input id="sim-montant" type="number" step="0.01" inputmode="decimal" placeholder="Montant en €"></div>
      <button class="btn" id="sim-go">Simuler</button>
    </div>
    <div id="sim-result"></div>
  `;

  document.getElementById('sim-go').onclick = () => {
    const montant = parseFloat(document.getElementById('sim-montant').value);
    if (isNaN(montant) || montant <= 0) { toast('Indique un montant valide'); return; }
    dernierResultatSim = D.simulerAchat(montant);
    renderSimResult();
  };

  function renderSimResult() {
    if (!dernierResultatSim) return;
    const r = dernierResultatSim;
    document.getElementById('sim-result').innerHTML = `
      <div class="result-banner ${r.niveau}">
        <div>${niveauLabel(r.niveau)}</div>
        <div class="big num">${euro(r.montant)}</div>
      </div>
      <div class="card">
        <h2>Détail</h2>
        <div class="rows">
          <div class="row"><div>Disponible avant achat</div><div class="amount num">${euro(r.avant.disponible)}</div></div>
          <div class="row"><div>Disponible après achat</div><div class="amount num" style="color:${r.apres < 0 ? 'var(--bad)' : 'var(--text)'}">${euro(r.apres)}</div></div>
          <div class="row"><div>Solde bancaire actuel</div><div class="amount num">${euro(r.avant.solde)}</div></div>
          <div class="row"><div>Charges du mois restant à payer</div><div class="amount num">${euro(r.avant.charges.total)}</div></div>
          <div class="row"><div>Différé déjà engagé</div><div class="amount num">${euro(r.avant.differe.total)}</div></div>
          <div class="row"><div>Réserve URSSAF</div><div class="amount num">${euro(r.avant.urssaf)}</div></div>
        </div>
      </div>
      <button class="btn" id="sim-confirm">Enregistrer cet achat</button>
    `;
    document.getElementById('sim-confirm').onclick = () => {
      saisieType = 'achat';
      editingTxId = null;
      switchView('saisie');
      setTimeout(() => { document.getElementById('f-montant').value = r.montant.toFixed(2); }, 0);
    };
  }
}

/* ---------------- HISTORIQUE ---------------- */

function monthsAvailable() {
  const D = window.DG;
  const set = new Set(D.state.transactions.map((t) => D.monthKey(t.date)));
  set.add(histMonth);
  return Array.from(set).sort().reverse();
}

function typeLabel(t) {
  return (TYPES_SAISIE.find((x) => x.v === t) || {}).l || t;
}

function renderHistorique() {
  const D = window.DG;
  const wrap = document.getElementById('view-historique');
  const months = monthsAvailable();

  const txs = D.state.transactions
    .filter((t) => D.monthKey(t.date) === histMonth)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const caMoisTotal = D.caPourPeriode(histMonth + '-01', histMonth + '-31');
  const achatsMoisTotal = txs.filter((t) => t.type === 'achat').reduce((s, t) => s + t.montant, 0);

  wrap.innerHTML = `
    <div class="tabs" id="month-tabs">${months.map((m) => `<button data-m="${m}" class="${m === histMonth ? 'active' : ''}">${new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</button>`).join('')}</div>
    <div class="grid2">
      <div class="stat"><div class="l">CA du mois</div><div class="v num pos">${euro(caMoisTotal)}</div></div>
      <div class="stat"><div class="l">Achats du mois</div><div class="v num">${euro(achatsMoisTotal)}</div></div>
    </div>
    <div class="card" style="margin-top:14px">
      <h2>CA quotidien</h2>
      <canvas id="chart" width="600" height="160" style="width:100%;height:120px"></canvas>
    </div>
    <div class="card">
      <h2>Mouvements du mois</h2>
      <div id="tx-list">${txs.length ? '' : '<div class="empty">Aucun mouvement ce mois-ci</div>'}</div>
    </div>
  `;

  wrap.querySelectorAll('#month-tabs button').forEach((b) => { b.onclick = () => { histMonth = b.dataset.m; renderHistorique(); }; });

  const list = document.getElementById('tx-list');
  txs.forEach((t) => {
    const el = document.createElement('div');
    el.className = 'list-item';
    const negatif = ['achat', 'depense', 'retrait', 'paiement_charge'].includes(t.type);
    const sign = t.type === 'correction_solde' ? '' : (negatif ? '−' : '+');
    el.innerHTML = `
      <div class="txt"><div class="t">${typeLabel(t.type)}${t.fournisseur ? ' · ' + t.fournisseur : ''}</div>
      <div class="m">${fmtDate(t.date)}${t.categorie ? ' · ' + t.categorie : ''}${t.commentaire ? ' · ' + t.commentaire : ''}</div></div>
      <div class="amt num ${negatif ? 'neg' : 'pos'}">${sign}${euro(t.montant)}</div>
      <button class="iconbtn" data-edit="${t.id}">✏️</button>
      <button class="iconbtn" data-del="${t.id}">🗑</button>
    `;
    list.appendChild(el);
  });
  list.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => openEditTx(b.dataset.edit);
  });
  list.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => { if (confirm('Supprimer ce mouvement ?')) { D.deleteTransaction(b.dataset.del); renderHistorique(); } };
  });

  drawChart(txs);
}

function drawChart(txs) {
  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = 120;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const daysInMonth = new Date(parseInt(histMonth.slice(0, 4)), parseInt(histMonth.slice(5, 7)), 0).getDate();
  const perDay = new Array(daysInMonth + 1).fill(0);
  txs.filter((t) => t.type === 'ca').forEach((t) => { perDay[parseInt(t.date.slice(8, 10), 10)] += t.montant; });
  const max = Math.max(1, ...perDay);
  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue('--accent').trim();
  const barW = (w - 8) / daysInMonth;

  for (let d = 1; d <= daysInMonth; d++) {
    const val = perDay[d];
    const bh = (val / max) * (h - 20);
    ctx.fillStyle = accent;
    ctx.globalAlpha = val > 0 ? 0.9 : 0.12;
    ctx.fillRect(4 + (d - 1) * barW, h - bh - 14, Math.max(1, barW - 2), bh || 2);
  }
  ctx.globalAlpha = 1;
}

/* ---------------- RÉGLAGES ---------------- */

function renderReglages() {
  const D = window.DG;
  const s = D.state.settings;
  const wrap = document.getElementById('view-reglages');

  wrap.innerHTML = `
    <div class="card">
      <h2>Comptes</h2>
      <div class="field"><label>Solde compte courant</label><input id="r-courant" type="number" step="0.01" value="${s.soldeCompteCourant}"></div>
      <div class="field"><label>Solde compte de dépôt</label><input id="r-depot" type="number" step="0.01" value="${s.soldeCompteDepot}"></div>
      <div class="field"><label>Découvert autorisé (jamais compté comme disponible)</label><input id="r-decouvert" type="number" step="0.01" value="${s.decouvertAutorise}"></div>
    </div>
    <div class="card">
      <h2>Objectif &amp; URSSAF</h2>
      <div class="field"><label>Objectif de CA mensuel</label><input id="r-objectif" type="number" step="10" value="${s.objectifCA}"></div>
      <div class="field"><label>Taux URSSAF (% du CA)</label><input id="r-urssaf" type="number" step="0.1" value="${s.tauxUrssaf}"></div>
    </div>
    <div class="card">
      <h2>Carte à débit différé</h2>
      <div class="field"><label>Jour du mois du prélèvement</label><input id="r-prelevement" type="number" min="1" max="28" value="${s.datePrelevementDiffere}"></div>
      <div class="field"><label>Jour du mois de clôture (estimation)</label><input id="r-cloture" type="number" min="1" max="28" value="${s.dateClotureDifferee}"></div>
      <div class="field"><label>Délai d'encaissement SumUp (jours)</label><input id="r-delai" type="number" min="0" max="10" value="${s.delaiEncaissementJours}"></div>
    </div>
    <button class="btn" id="r-save">Enregistrer les réglages</button>

    <section class="subsection">
      <h3>Charges récurrentes (pro / perso)</h3>
      <div class="card" id="charges-list"></div>
      <button class="btn secondary" id="add-charge" style="margin-top:10px">+ Ajouter une charge</button>
    </section>

    <section class="subsection">
      <h3>Échéances annuelles / trimestrielles</h3>
      <div class="card" id="echeances-list"></div>
      <button class="btn secondary" id="add-echeance" style="margin-top:10px">+ Ajouter une échéance</button>
    </section>

    <section class="subsection">
      <h3>Réinitialisation</h3>
      <p style="color:var(--text-dim);font-size:.85rem;margin-top:-4px">Efface toutes les données de cet appareil (mouvements, charges modifiées, réglages) et recharge l'application avec ses valeurs de départ.</p>
      <button class="btn danger" id="r-reset">Réinitialiser aux valeurs de départ</button>
    </section>
  `;

  document.getElementById('r-reset').onclick = () => {
    if (confirm('Effacer toutes les données enregistrées sur cet appareil et repartir des valeurs de départ ?')) {
      try { localStorage.removeItem('dgriff_tresorerie_v1'); } catch (e) {}
      location.reload();
    }
  };

  document.getElementById('r-save').onclick = () => {
    s.soldeCompteCourant = parseFloat(document.getElementById('r-courant').value) || 0;
    s.soldeCompteDepot = parseFloat(document.getElementById('r-depot').value) || 0;
    s.decouvertAutorise = parseFloat(document.getElementById('r-decouvert').value) || 0;
    s.objectifCA = parseFloat(document.getElementById('r-objectif').value) || 0;
    s.tauxUrssaf = parseFloat(document.getElementById('r-urssaf').value) || 0;
    s.datePrelevementDiffere = parseInt(document.getElementById('r-prelevement').value) || 12;
    s.dateClotureDifferee = parseInt(document.getElementById('r-cloture').value) || 5;
    s.delaiEncaissementJours = parseInt(document.getElementById('r-delai').value) || 0;
    s.dateReferenceSolde = D.todayISO();
    D.state.premierLancement = false;
    D.saveState();
    toast('Réglages enregistrés ✓');
  };

  renderChargesList();
  renderEcheancesList();
  document.getElementById('add-charge').onclick = () => {
    D.state.charges.push({ id: D.uid(), label: 'Nouvelle charge', montant: 0, type: 'pro', actif: true });
    D.saveState(); renderChargesList();
  };
  document.getElementById('add-echeance').onclick = () => {
    D.state.echeancesAnnuelles.push({ id: D.uid(), label: 'Nouvelle échéance', montant: 0, type: 'pro', dateEcheance: D.todayISO(), estimee: true });
    D.saveState(); renderEcheancesList();
  };
}

function renderChargesList() {
  const D = window.DG;
  const box = document.getElementById('charges-list');
  box.innerHTML = '';
  if (!D.state.charges.length) { box.innerHTML = '<div class="empty">Aucune charge</div>'; return; }
  D.state.charges.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'charge-row';
    row.innerHTML = `
      <input class="cw" type="text" value="${c.label}" data-f="label">
      <input class="mw" type="number" step="0.01" value="${c.montant}" data-f="montant">
      <select data-f="type" style="width:90px;flex-shrink:0">
        <option value="pro" ${c.type === 'pro' ? 'selected' : ''}>Pro</option>
        <option value="perso" ${c.type === 'perso' ? 'selected' : ''}>Perso</option>
      </select>
      <button class="iconbtn" data-del>🗑</button>
    `;
    row.querySelectorAll('[data-f]').forEach((inp) => {
      const save = () => {
        const f = inp.dataset.f;
        c[f] = f === 'montant' ? parseFloat(inp.value) || 0 : inp.value;
        D.saveState();
      };
      inp.addEventListener('input', save);
      inp.addEventListener('change', save);
    });
    row.querySelector('[data-del]').onclick = () => {
      D.state.charges = D.state.charges.filter((x) => x.id !== c.id);
      D.saveState(); renderChargesList();
    };
    box.appendChild(row);
  });
}

function renderEcheancesList() {
  const D = window.DG;
  const box = document.getElementById('echeances-list');
  box.innerHTML = '';
  if (!D.state.echeancesAnnuelles.length) { box.innerHTML = '<div class="empty">Aucune échéance</div>'; return; }
  D.state.echeancesAnnuelles.forEach((e) => {
    const row = document.createElement('div');
    row.className = 'charge-row';
    row.innerHTML = `
      <input class="cw" type="text" value="${e.label}" data-f="label">
      <input class="mw" type="number" step="0.01" value="${e.montant}" data-f="montant">
      <input type="date" value="${e.dateEcheance}" data-f="dateEcheance" style="width:150px;flex-shrink:0">
      <button class="iconbtn" data-del>🗑</button>
    `;
    row.querySelectorAll('[data-f]').forEach((inp) => {
      const save = () => {
        const f = inp.dataset.f;
        e[f] = f === 'montant' ? parseFloat(inp.value) || 0 : inp.value;
        D.saveState();
      };
      inp.addEventListener('input', save);
      inp.addEventListener('change', save);
    });
    row.querySelector('[data-del]').onclick = () => {
      D.state.echeancesAnnuelles = D.state.echeancesAnnuelles.filter((x) => x.id !== e.id);
      D.saveState(); renderEcheancesList();
    };
    box.appendChild(row);
  });
}

/* ---------------- INIT ---------------- */

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('nav.bottomnav button').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.view === 'saisie') editingTxId = null;
      switchView(b.dataset.view);
    };
  });
  switchView('dashboard');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
});
