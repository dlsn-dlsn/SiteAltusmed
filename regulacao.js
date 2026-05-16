const SUPA_URL = 'https://hdovkmuwofvwpcyfkiih.supabase.co';
const SUPA_KEY = 'sb_publishable_GetcnIgIEe6owbOQea2HOg_0MuxtLdP';
const { createClient } = supabase;
const db = createClient(SUPA_URL, SUPA_KEY);

const AEROPORTOS_BASE = [
  "Araguaína/TO — AUX","Aracaju/SE — AJU — Santa Maria",
  "Barreirinhas/MA — BRB","Belém/PA — BEL — Val-de-Cans",
  "Belo Horizonte/MG — CNF — Confins","Boa Vista/RR — BOA — Atlas Brasil Cantanhede",
  "Brasília/DF — BSB — Internacional","Campinas/SP — VCP — Viracopos",
  "Campo Grande/MS — CGR — Internacional","Campos dos Goytacazes/RJ — CAW",
  "Caxias do Sul/RS — CXJ — Hugo Cantergiani","Cuiabá/MT — CGB — Marechal Rondon",
  "Curitiba/PR — CWB — Afonso Pena","Florianópolis/SC — FLN — Hercílio Luz",
  "Barreiras/BA — BRA","Fortaleza/CE — FOR — Pinto Martins",
  "Goiânia/GO — GYN — Santa Genoveva","Gurupi/TO — GRP",
  "Imperatriz/MA — IMP — Prefeito Renato Moreira","João Pessoa/PB — JPA — Presidente Castro Pinto",
  "Joinville/SC — JOI — Lauro Carneiro de Loyola","Londrina/PR — LDB — Governador José Richa",
  "Macapá/AP — MCP — Alberto Alcolumbre","Maceió/AL — MCZ — Zumbi dos Palmares",
  "Manaus/AM — MAO — Eduardo Gomes","Manicoré/AM — MNX",
  "Marabá/PA — MAB — João Correa da Rocha","Monte Dourado/PA — MDD",
  "Natal/RN — NAT — Governador Aluízio Alves","Oiapoque/AP — OYK",
  "Palmas/TO — PMW — Internacional","Parnaíba/PI — PHB — Prefeito Dr. João Silva Filho",
  "Pinheiro/MA — PIN","Porto Alegre/RS — POA — Salgado Filho",
  "Porto Velho/RO — PVH — Governador Jorge Teixeira","Recife/PE — REC — Guararapes",
  "Rio Branco/AC — RBR — Plácido de Castro","Rio de Janeiro/RJ — GIG — Galeão",
  "Rio de Janeiro/RJ — SDU — Santos Dumont","Salvador/BA — SSA — Dep. Luís Eduardo Magalhães",
  "Santarém/PA — STM — Maestro Wilson Fonseca","São Luís/MA — SLZ — Marechal Cunha Machado",
  "São Paulo/SP — CGH — Congonhas","São Paulo/SP — GRU — Guarulhos",
  "Teresina/PI — THE — Senador Petrônio Portella","Timon/MA — TIM",
  "Uberlândia/MG — UDI","Vitória/ES — VIX — Eurico de Aguiar Salles"
];
let aeroportosCustom = [];
let dvaCont    = 0;
let drogaCont  = 0;

let usuarioAtual   = null;
let perfilAtual    = {};
let regulacaoSalva = null;

const toggleState = {
  cirurgia: false,
  pneumo: false,
  obstrucao: false,
  'outra-restricao': false
};
let fluxoSelecionado = '';

// ── Auth ──────────────────────────────────────────────────────────────
async function init() {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { window.location.href = 'restrito.html'; return; }
    usuarioAtual = session.user;
    await Promise.all([carregarPerfil(), carregarAeroportosCustom(), carregarEquipe()]);
    document.getElementById('app').style.display = 'block';
  } catch(e) {
    window.location.href = 'restrito.html';
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

function saudacaoCargo(tipo) {
  if (tipo === 'medico' || tipo === 'diretor') return 'Dr. ';
  if (tipo === 'enfermeiro') return 'ENF(a). ';
  return '';
}

async function carregarPerfil() {
  try {
    const { data } = await db.from('perfis').select('*').eq('id', usuarioAtual.id).single();
    perfilAtual = data || {};
    document.getElementById('topbar-saudacao').textContent = saudacaoCargo(perfilAtual.cargo_tipo);
    document.getElementById('topbar-nome').textContent = perfilAtual.nome || usuarioAtual.email;
  } catch(e) { console.error('carregarPerfil:', e); }
}

// ── Equipe de voo ─────────────────────────────────────────────────────
async function carregarEquipe() {
  try {
    const { data } = await db.from('perfis')
      .select('id, nome, cargo, cargo_tipo, crm')
      .in('cargo_tipo', ['medico', 'diretor', 'enfermeiro'])
      .order('nome');

    const medicos     = (data || []).filter(p => ['medico','diretor'].includes(p.cargo_tipo));
    const enfermeiros = (data || []).filter(p => p.cargo_tipo === 'enfermeiro');

    popularSelect('equipe-medico',     medicos);
    popularSelect('equipe-enfermeiro', enfermeiros);
  } catch(e) { console.error('carregarEquipe:', e); }
}

function popularSelect(id, lista) {
  const sel = document.getElementById(id);
  sel.innerHTML = '<option value="">Não designado</option>';
  lista.forEach(p => {
    const opt      = document.createElement('option');
    opt.value      = p.id;
    const fallback = p.cargo_tipo === 'enfermeiro' ? 'COREN' : 'CRM';
    const reg      = p.registro_tipo || fallback;
    const uf       = p.registro_uf   || '';
    const num      = p.crm           || '';
    const regStr   = num ? ` — ${reg}${uf ? '/'+uf : ''} ${num}` : '';
    opt.textContent = p.nome + regStr;
    sel.appendChild(opt);
  });
}

// ── Aeroportos custom ────────────────────────────────────────────────
async function carregarAeroportosCustom() {
  try {
    const { data } = await db.from('aeroportos_custom').select('nome');
    aeroportosCustom = (data || []).map(r => r.nome);
  } catch(e) { console.error('aeroportosCustom:', e); }
}

// ── Autocomplete de aeroportos ────────────────────────────────────────
function jaccard(a, b) {
  const tri = s => {
    const t = new Set(), p = '  ' + s.toLowerCase() + '  ';
    for (let i = 0; i < p.length - 2; i++) t.add(p.slice(i, i + 3));
    return t;
  };
  const ta = tri(a), tb = tri(b);
  const inter = [...ta].filter(x => tb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : inter / union;
}

function melhorSim(val) {
  return [...AEROPORTOS_BASE, ...aeroportosCustom]
    .reduce((max, item) => Math.max(max, jaccard(val, item)), 0);
}

function acInput(campo) {
  const input    = document.getElementById(campo);
  const val      = input.value.trim();
  const dropdown = document.getElementById('ac-' + campo);
  const btnAdd   = document.getElementById('add-' + campo);

  if (val.length < 2) {
    dropdown.innerHTML = ''; dropdown.style.display = 'none';
    btnAdd.style.display = 'none'; return;
  }

  const lista   = [...AEROPORTOS_BASE, ...aeroportosCustom];
  const valLow  = val.toLowerCase();
  const matches = lista.filter(a => a.toLowerCase().includes(valLow)).slice(0, 8);

  if (matches.length > 0) {
    dropdown._matches = matches;
    dropdown.innerHTML = matches.map((m, i) =>
      `<div class="autocomplete-item" onmousedown="acSelect('${campo}',${i})">${m}</div>`
    ).join('');
    dropdown.style.display = 'block';
    btnAdd.style.display = 'none';
  } else {
    dropdown.innerHTML = ''; dropdown.style.display = 'none';
    btnAdd.style.display = melhorSim(val) < 0.75 ? 'block' : 'none';
  }
}

function acSelect(campo, idx) {
  const dropdown = document.getElementById('ac-' + campo);
  document.getElementById(campo).value = dropdown._matches[idx];
  dropdown.style.display = 'none';
  document.getElementById('add-' + campo).style.display = 'none';
}

function acBlur(campo) {
  setTimeout(() => { document.getElementById('ac-' + campo).style.display = 'none'; }, 150);
}

async function addAirport(campo) {
  const val = document.getElementById(campo).value.trim();
  if (!val) return;
  try {
    await db.from('aeroportos_custom').insert({ nome: val, criado_por: usuarioAtual.id });
    aeroportosCustom.push(val);
    document.getElementById('add-' + campo).style.display = 'none';
    toast('Aeroporto adicionado à lista!');
  } catch(e) { toast('Erro ao salvar aeroporto.', true); }
}

// ── Tempo de missão ───────────────────────────────────────────────────
function calcularTempoMissao() {
  const h   = parseInt(document.getElementById('log-horas').value) || 0;
  const m   = parseInt(document.getElementById('log-min').value)   || 0;
  const voo = h * 60 + m;
  const res = document.getElementById('tempo-resultado');
  const hiddenTotal = document.getElementById('tempo-total-hidden');

  if (voo === 0) {
    res.style.display = 'none';
    hiddenTotal.value = '';
    return;
  }

  let total = voo + 60;
  if (voo > 210) total += 60;
  hiddenTotal.value = total;

  const hT = Math.floor(total / 60), mT = total % 60;
  res.innerHTML = 'Tempo estimado de missão: <strong>' + hT + 'h ' + mT + 'min</strong>' +
    (voo > 210 ? '<small>Inclui 1h de parada para reabastecimento</small>' : '');
  res.style.display = 'block';

  calcO2Necessario();
}

// ── Idade pediátrica ──────────────────────────────────────────────────
function toggleIdadeMeses() {
  const anos       = parseInt(document.getElementById('paciente_idade').value);
  const mesesInput = document.getElementById('pac-meses');
  const fieldMeses = document.getElementById('field-meses');
  const fieldDias  = document.getElementById('field-dias');

  if (isNaN(anos) || anos > 0) {
    fieldMeses.style.display = 'none'; fieldDias.style.display = 'none';
    mesesInput.value = ''; document.getElementById('pac-dias').value = '';
  } else {
    fieldMeses.style.display = 'flex';
    const meses = parseInt(mesesInput.value);
    fieldDias.style.display =
      (!isNaN(meses) && meses === 0 && mesesInput.value !== '') ? 'flex' : 'none';
  }
  togglePediatricoGCS();
}

// ── Seções colapsáveis ────────────────────────────────────────────────
function toggleSection(id) {
  const body   = document.getElementById('body-' + id);
  const toggle = document.getElementById('toggle-' + id);
  const hidden = body.classList.toggle('hidden');
  toggle.classList.toggle('open', !hidden);
}

// ── PAM ───────────────────────────────────────────────────────────────
function calcPAM() {
  const pas = parseFloat(document.getElementById('pas').value) || 0;
  const pad = parseFloat(document.getElementById('pad').value) || 0;
  const el  = document.getElementById('pam-resultado');
  if (pas && pad) {
    const pam = ((pas + 2 * pad) / 3).toFixed(1);
    el.textContent = 'PAM: ' + pam + ' mmHg';
    el.style.display = 'block';
    document.getElementById('pam-valor').value = pam;
  } else {
    el.style.display = 'none';
    document.getElementById('pam-valor').value = '';
  }
}

// ── GCS ───────────────────────────────────────────────────────────────
function calcGCS() {
  const o = parseInt(document.getElementById('gcs_o').value) || 0;
  const v = parseInt(document.getElementById('gcs_v').value) || 0;
  const m = parseInt(document.getElementById('gcs_m').value) || 0;
  const total = o + v + m;
  document.getElementById('gcs-total').textContent = total;
  calcGCSP();
}

function calcGCSP() {
  const gcsTot  = parseInt(document.getElementById('gcs-total').textContent) || 0;
  const pupilar = document.getElementById('gcs-pupilar').value;

  let desconto = 0;
  if (pupilar === '1') desconto = 0;
  if (pupilar === '2') desconto = 1;
  if (pupilar === '3') desconto = 2;

  if (pupilar === '' || pupilar === 'ignorada') {
    document.getElementById('gcs-p-resultado').style.display = 'none';
    return;
  }

  const gcsp = gcsTot - desconto;
  document.getElementById('gcs-p-resultado').textContent =
    'GCS-P: ' + gcsp +
    (desconto > 0 ? ' (desconto pupilar: −' + desconto + ')' : ' (sem desconto pupilar)');
  document.getElementById('gcs-p-resultado').style.display = 'block';
}

function togglePediatricoGCS() {
  const anos    = parseInt(document.getElementById('paciente_idade').value);
  const meses   = parseInt(document.getElementById('pac-meses').value) || 0;
  const ped     = (!isNaN(anos) && anos < 5) || (anos === 0 && meses >= 0 && document.getElementById('field-meses').style.display !== 'none');
  const badge   = document.getElementById('badge-pediatrico');
  badge.style.display = ped ? 'inline-flex' : 'none';

  const gcsV = document.getElementById('gcs_v');
  const gcsM = document.getElementById('gcs_m');
  const vCur = gcsV.value, mCur = gcsM.value;

  if (ped) {
    gcsV.innerHTML = `
      <option value="5">5 — Balbucia/palavras habituais</option>
      <option value="4">4 — Choro consolável</option>
      <option value="3">3 — Choro inconsolável</option>
      <option value="2">2 — Gemidos</option>
      <option value="1">1 — Ausente</option>`;
    gcsM.innerHTML = `
      <option value="6">6 — Movimentos espontâneos normais</option>
      <option value="5">5 — Localiza dor</option>
      <option value="4">4 — Retirada ao toque</option>
      <option value="3">3 — Flexão anormal</option>
      <option value="2">2 — Extensão anormal</option>
      <option value="1">1 — Ausente</option>`;
  } else {
    gcsV.innerHTML = `
      <option value="5">5 — Orientado</option>
      <option value="4">4 — Confuso</option>
      <option value="3">3 — Palavras</option>
      <option value="2">2 — Sons</option>
      <option value="1">1 — Ausente</option>`;
    gcsM.innerHTML = `
      <option value="6">6 — Obedece</option>
      <option value="5">5 — Localiza</option>
      <option value="4">4 — Retirada</option>
      <option value="3">3 — Flexão</option>
      <option value="2">2 — Extensão</option>
      <option value="1">1 — Ausente</option>`;
  }
  if ([...gcsV.options].some(o => o.value === vCur)) gcsV.value = vCur;
  if ([...gcsM.options].some(o => o.value === mCur)) gcsM.value = mCur;
  calcGCS();
}

// ── Altitude toggles ──────────────────────────────────────────────────
function setToggle(id, valor) {
  toggleState[id] = valor;
  const sim = document.getElementById('tog-' + id + '-sim');
  const nao = document.getElementById('tog-' + id + '-nao');
  sim.className = 'toggle-btn' + (valor  ? ' active-sim' : '');
  nao.className = 'toggle-btn' + (!valor ? ' active-nao' : '');

  if (id === 'outra-restricao') {
    document.getElementById('outra-restricao-obs-wrap').style.display = valor ? 'block' : 'none';
  }
  verificarAltitude();
}

function verificarAltitude() {
  const algumSim = Object.values(toggleState).some(v => v);
  document.getElementById('aviso-altitude').style.display = algumSim ? 'flex' : 'none';
}

// ── Fluxo e decisão ───────────────────────────────────────────────────
function selecionarFluxo(id) {
  fluxoSelecionado = id;
  document.querySelectorAll('.fluxo-card').forEach(c => c.className = 'fluxo-card');
  document.getElementById('fluxo-' + id).classList.add('selected-' + id);
  document.getElementById('reavaliacao-horas-wrap').style.display = id === 'reavaliacao' ? 'block' : 'none';
}

// ── O2 ────────────────────────────────────────────────────────────────
function toggleO2Fields() {
  const sim = document.getElementById('o2_uso').value === 'Sim';
  document.getElementById('o2-fields').style.display = sim ? 'block' : 'none';
  if (sim) toggleO2Dispositivo();
}

function toggleO2Dispositivo() {
  const disp      = document.getElementById('o2-dispositivo').value;
  const vmParams  = document.getElementById('vm-params');
  const cpapFlds  = document.getElementById('vm-cpap-fields');
  const ventFlds  = document.getElementById('vm-vent-fields');
  const volField  = document.getElementById('vm-volume-field');
  const usesVM    = ['CPAP', 'VMI', 'VNI'].includes(disp);

  vmParams.style.display  = usesVM ? 'block' : 'none';
  cpapFlds.style.display  = disp === 'CPAP' ? 'block' : 'none';
  ventFlds.style.display  = ['VMI', 'VNI'].includes(disp) ? 'block' : 'none';
  if (volField) volField.style.display = disp === 'VMI' ? 'flex' : 'none';

  calcO2Necessario();
}

function calcO2Necessario() {
  const flow     = parseFloat(document.getElementById('o2-flow').value) || 0;
  const tempoMin = parseInt(document.getElementById('tempo-total-hidden').value) || 0;
  const resultado = document.getElementById('o2-calc-resultado');

  if (!flow || !tempoMin) { resultado.style.display = 'none'; return; }

  const litros = flow * tempoMin * 1.3;
  const cil = {
    C: Math.ceil(litros / 170 * 10) / 10,
    D: Math.ceil(litros / 415 * 10) / 10,
    E: Math.ceil(litros / 680 * 10) / 10,
    H: Math.ceil(litros / 6900 * 10) / 10
  };

  resultado.innerHTML = '<strong>O2 necessário: ' + litros.toFixed(0) + ' L</strong><br>' +
    'Cilindros: C=' + cil.C + ' | D=' + cil.D + ' | E=' + cil.E + ' | H=' + cil.H;
  resultado.style.display = 'block';

  document.getElementById('o2-litros-hidden').value    = litros.toFixed(1);
  document.getElementById('o2-cilindros-hidden').value = cil.E;
}

// ── Infusão Contínua ──────────────────────────────────────────────────
function toggleInfusaoFields() {
  const sim = document.getElementById('infusao-ativo').value === 'Sim';
  document.getElementById('infusao-fields').style.display = sim ? 'block' : 'none';
}

function toggleOutra(tipo, n) {
  const selId   = tipo === 'dva' ? 'dva-droga-' + n : 'droga-nome-' + n;
  const outraId = tipo === 'dva' ? 'dva-outra-'  + n : 'droga-outra-' + n;
  const sel     = document.getElementById(selId);
  const outra   = document.getElementById(outraId);
  if (outra) outra.style.display = sel?.value === 'Outra' || sel?.value === 'Outra hidratação' ? 'block' : 'none';
}

function addDVA() {
  dvaCont++;
  const n = dvaCont;
  const div = document.createElement('div');
  div.className = 'infusao-linha';
  div.id = 'dva-linha-' + n;
  div.setAttribute('data-dva-id', n);
  div.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:.3rem;">
      <select class="infusao-select" id="dva-droga-${n}" onchange="toggleOutra('dva',${n})">
        <option value="">Selecione...</option>
        <option>Norepinefrina</option><option>Epinefrina</option>
        <option>Dopamina</option><option>Dobutamina</option>
        <option>Vasopressina</option><option>Fenilefrina</option>
        <option>Milrinona</option><option>Levosimendan</option>
        <option>Prostaglandina E1</option><option>Terlipressina</option>
        <option>Angiotensina II</option><option value="Outra">Outra</option>
      </select>
      <input type="text" class="infusao-input" id="dva-outra-${n}"
             placeholder="Nome da droga" style="display:none;">
    </div>
    <input type="number" class="infusao-input" id="dva-valor-${n}"
           placeholder="Dose" min="0" step="0.001">
    <select class="infusao-select" id="dva-unidade-${n}">
      <option>mcg/kg/min</option><option>mcg/min</option>
      <option>mg/kg/min</option><option>mg/min</option>
      <option>UI/min</option><option>UI/h</option>
      <option>ng/kg/min</option><option>ml/h</option>
    </select>
    <button class="btn-remove-linha" onclick="removerLinha('dva-linha-${n}')">✕</button>`;
  document.getElementById('dva-lista').appendChild(div);
}

function addDroga() {
  drogaCont++;
  const n = drogaCont;
  const div = document.createElement('div');
  div.className = 'infusao-linha';
  div.id = 'droga-linha-' + n;
  div.setAttribute('data-droga-id', n);
  div.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:.3rem;">
      <select class="infusao-select" id="droga-nome-${n}" onchange="toggleOutra('droga',${n})">
        <option value="">Selecione...</option>
        <optgroup label="Sedoanalgesia">
          <option>Midazolam</option><option>Propofol</option><option>Ketamina</option>
          <option>Fentanil</option><option>Sufentanil</option><option>Remifentanil</option>
          <option>Morfina</option><option>Dexmedetomidina</option>
          <option>Precedex</option><option>Clonidina</option>
        </optgroup>
        <optgroup label="Bloqueio Neuromuscular">
          <option>Rocurônio</option><option>Vecurônio</option>
          <option>Cisatracúrio</option><option>Pancurônio</option>
        </optgroup>
        <optgroup label="Outras Infusões">
          <option>Sulfato de Magnésio</option><option>Terbutalina</option>
          <option>Nitroglicerina</option><option>Nitroprussiato</option>
          <option>Amiodarona</option><option>Lidocaína</option>
          <option>Insulina</option><option>Heparina</option>
          <option>Ocitocina</option><option>Furosemida</option>
          <option>Aminofilina</option><option>N-Acetilcisteína</option>
          <option>Labetalol</option><option>Nicardipina</option>
          <option value="Outra">Outra</option>
        </optgroup>
        <optgroup label="Aporte Calórico / Hidratação">
          <option>Nutrição Parenteral Total (NPT)</option>
          <option>Lipídeos EV</option>
          <option>Albumina 20%</option>
          <option>Albumina 4%</option>
          <option>Dextrose 50%</option>
          <option>Solução Glicosada 10%</option>
          <option>Solução Glicosada 5%</option>
          <option>Solução Fisiológica 0,9%</option>
          <option>Ringer Lactato</option>
          <option>Solução de Manitol 20%</option>
          <option>Bicarbonato de Sódio 8,4%</option>
          <option value="Outra hidratação">Outra hidratação (campo livre)</option>
        </optgroup>
      </select>
      <input type="text" class="infusao-input" id="droga-outra-${n}"
             placeholder="Nome da droga" style="display:none;">
    </div>
    <input type="number" class="infusao-input" id="droga-valor-${n}"
           placeholder="Dose" min="0" step="0.001">
    <select class="infusao-select" id="droga-unidade-${n}">
      <option>ml/h</option><option>mcg/kg/min</option><option>mcg/min</option>
      <option>mg/h</option><option>mg/kg/h</option>
      <option>UI/h</option><option>UI/min</option><option>mEq/h</option><option>mg/min</option>
    </select>
    <button class="btn-remove-linha" onclick="removerLinha('droga-linha-${n}')">✕</button>`;
  document.getElementById('droga-lista').appendChild(div);
}

function removerLinha(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function coletarDVAs() {
  return [...document.querySelectorAll('[data-dva-id]')]
    .filter(l => l.style.display !== 'none')
    .map(l => {
      const id = l.dataset.dvaId;
      const drogaEl = document.getElementById('dva-droga-' + id);
      let droga = drogaEl?.value;
      if (droga === 'Outra') droga = document.getElementById('dva-outra-' + id)?.value.trim() || 'Outra';
      return {
        droga,
        valor:   parseFloat(document.getElementById('dva-valor-'   + id)?.value) || null,
        unidade: document.getElementById('dva-unidade-' + id)?.value
      };
    }).filter(d => d.droga && d.droga !== '');
}

function coletarDrogas() {
  return [...document.querySelectorAll('[data-droga-id]')]
    .filter(l => l.style.display !== 'none')
    .map(l => {
      const id = l.dataset.drogaId;
      const drogaEl = document.getElementById('droga-nome-' + id);
      let droga = drogaEl?.value;
      if (droga === 'Outra' || droga === 'Outra hidratação')
        droga = document.getElementById('droga-outra-' + id)?.value.trim() || droga;
      return {
        droga,
        valor:   parseFloat(document.getElementById('droga-valor-'   + id)?.value) || null,
        unidade: document.getElementById('droga-unidade-' + id)?.value
      };
    }).filter(d => d.droga && d.droga !== '');
}

// ── Trechos de Voo ────────────────────────────────────────────────────
const AEROPORTOS_COORDS = {
  'AUX':{nome:'Araguaína/TO',lat:-7.2283,lng:-48.2406},
  'AJU':{nome:'Aracaju/SE',lat:-10.9840,lng:-37.0703},
  'BRB':{nome:'Barreirinhas/MA',lat:-2.7456,lng:-42.8156},
  'BEL':{nome:'Belém/PA',lat:-1.3792,lng:-48.4761},
  'CNF':{nome:'Belo Horizonte/MG',lat:-19.6244,lng:-43.9719},
  'BOA':{nome:'Boa Vista/RR',lat:2.8414,lng:-60.6922},
  'BSB':{nome:'Brasília/DF',lat:-15.8711,lng:-47.9186},
  'VCP':{nome:'Campinas/SP',lat:-23.0074,lng:-47.1345},
  'CGR':{nome:'Campo Grande/MS',lat:-20.4687,lng:-54.6725},
  'CAW':{nome:'Campos dos Goytacazes/RJ',lat:-21.6983,lng:-41.3017},
  'CXJ':{nome:'Caxias do Sul/RS',lat:-29.1971,lng:-51.1875},
  'CGB':{nome:'Cuiabá/MT',lat:-15.6531,lng:-56.1167},
  'CWB':{nome:'Curitiba/PR',lat:-25.5285,lng:-49.1758},
  'FLN':{nome:'Florianópolis/SC',lat:-27.6703,lng:-48.5525},
  'FOR':{nome:'Fortaleza/CE',lat:-3.7762,lng:-38.5326},
  'GYN':{nome:'Goiânia/GO',lat:-16.6320,lng:-49.2207},
  'GRP':{nome:'Gurupi/TO',lat:-11.738991,lng:-49.135820},
  'BRA':{nome:'Barreiras/BA',lat:-12.080365,lng:-45.007491},
  'IMP':{nome:'Imperatriz/MA',lat:-5.5299,lng:-47.4600},
  'JPA':{nome:'João Pessoa/PB',lat:-7.1458,lng:-34.9508},
  'JOI':{nome:'Joinville/SC',lat:-26.2245,lng:-48.7975},
  'LDB':{nome:'Londrina/PR',lat:-23.3336,lng:-51.1301},
  'MCP':{nome:'Macapá/AP',lat:0.0507,lng:-51.0722},
  'MCZ':{nome:'Maceió/AL',lat:-9.5108,lng:-35.7917},
  'MAO':{nome:'Manaus/AM',lat:-3.0386,lng:-60.0497},
  'MNX':{nome:'Manicoré/AM',lat:-5.8113,lng:-61.2783},
  'MAB':{nome:'Marabá/PA',lat:-5.3686,lng:-49.1380},
  'MDD':{nome:'Monte Dourado/PA',lat:-0.8978,lng:-52.6014},
  'NAT':{nome:'Natal/RN',lat:-5.9114,lng:-35.2477},
  'OYK':{nome:'Oiapoque/AP',lat:3.8547,lng:-51.7969},
  'PMW':{nome:'Palmas/TO',lat:-10.2913,lng:-48.3569},
  'PHB':{nome:'Parnaíba/PI',lat:-2.8944,lng:-41.7320},
  'PIN':{nome:'Pinheiro/MA',lat:-2.5228,lng:-45.0828},
  'POA':{nome:'Porto Alegre/RS',lat:-29.9944,lng:-51.1714},
  'PVH':{nome:'Porto Velho/RO',lat:-8.7093,lng:-63.9023},
  'REC':{nome:'Recife/PE',lat:-8.1264,lng:-34.9236},
  'RBR':{nome:'Rio Branco/AC',lat:-9.8689,lng:-67.8981},
  'GIG':{nome:'Rio de Janeiro/Galeão',lat:-22.8099,lng:-43.2506},
  'SDU':{nome:'Rio de Janeiro/Santos Dumont',lat:-22.9105,lng:-43.1631},
  'SSA':{nome:'Salvador/BA',lat:-12.9086,lng:-38.3225},
  'STM':{nome:'Santarém/PA',lat:-2.4247,lng:-54.7858},
  'SLZ':{nome:'São Luís/MA',lat:-2.5836,lng:-44.2341},
  'CGH':{nome:'São Paulo/Congonhas',lat:-23.6261,lng:-46.6564},
  'GRU':{nome:'São Paulo/Guarulhos',lat:-23.4356,lng:-46.4731},
  'THE':{nome:'Teresina/PI',lat:-5.0599,lng:-42.8235},
  'TIM':{nome:'Timon/MA',lat:-5.1942,lng:-42.8675},
  'UDI':{nome:'Uberlândia/MG',lat:-18.8836,lng:-48.2253},
  'VIX':{nome:'Vitória/ES',lat:-20.2581,lng:-40.2861}
};

function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLng = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
    Math.sin(dLng/2)*Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

let trechoCont = 0;

function addTrecho(orig='', dest='') {
  const i = ++trechoCont;
  const div = document.createElement('div');
  div.id = 'trecho-' + i;
  div.style.cssText = 'display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem;';
  div.innerHTML = `
    <input type="text" id="tr-orig-${i}" value="${orig}"
      placeholder="Origem (ex: BEL)"
      style="flex:1;background:rgba(255,255,255,.05);
      border:1px solid var(--border);border-radius:6px;
      padding:.5rem .75rem;color:var(--text);
      font-family:var(--ff);font-size:.85rem;outline:none;
      text-transform:uppercase;"
      oninput="this.value=this.value.toUpperCase();calcTrechos()">
    <span style="color:var(--text-m);font-weight:700;">→</span>
    <input type="text" id="tr-dest-${i}" value="${dest}"
      placeholder="Destino (ex: CGH)"
      style="flex:1;background:rgba(255,255,255,.05);
      border:1px solid var(--border);border-radius:6px;
      padding:.5rem .75rem;color:var(--text);
      font-family:var(--ff);font-size:.85rem;outline:none;
      text-transform:uppercase;"
      oninput="this.value=this.value.toUpperCase();calcTrechos()">
    <span id="tr-km-${i}" style="font-size:.78rem;
      color:var(--green);min-width:60px;text-align:right;"></span>
    <button onclick="document.getElementById('trecho-${i}').remove();calcTrechos()"
      style="background:none;border:none;color:var(--text-m);
      cursor:pointer;font-size:1rem;padding:2px 6px;">✕</button>`;
  document.getElementById('trechos-container').appendChild(div);
}

function calcTrechos() {
  let total = 0, validos = 0;
  document.querySelectorAll('[id^="tr-orig-"]').forEach(el => {
    const i    = el.id.replace('tr-orig-','');
    const orig = el.value.toUpperCase().trim();
    const dest = document.getElementById('tr-dest-'+i)?.value.toUpperCase().trim();
    const kmEl = document.getElementById('tr-km-'+i);
    if (orig && dest && AEROPORTOS_COORDS[orig] && AEROPORTOS_COORDS[dest]) {
      const km = distanciaKm(
        AEROPORTOS_COORDS[orig].lat, AEROPORTOS_COORDS[orig].lng,
        AEROPORTOS_COORDS[dest].lat, AEROPORTOS_COORDS[dest].lng
      );
      if (kmEl) kmEl.textContent = km.toFixed(0) + ' km';
      total += km; validos++;
    } else {
      if (kmEl) kmEl.textContent = orig && dest ? '⚠️' : '';
    }
  });
  const res = document.getElementById('km-total-resultado');
  if (total > 0) {
    res.innerHTML = '<strong>Total: ' + total.toFixed(0) + ' km</strong> em ' + validos + ' trecho(s)';
    res.style.display = 'block';
    document.getElementById('km-total-hidden').value = total.toFixed(2);
  } else {
    res.style.display = 'none';
    document.getElementById('km-total-hidden').value = '0';
  }
}

async function salvarTrechos(missaoId, regulacaoId) {
  const trechos = [];
  let ordem = 1;
  document.querySelectorAll('[id^="tr-orig-"]').forEach(el => {
    const i    = el.id.replace('tr-orig-','');
    const orig = el.value.toUpperCase().trim();
    const dest = document.getElementById('tr-dest-'+i)?.value.toUpperCase().trim();
    if (orig && dest && AEROPORTOS_COORDS[orig] && AEROPORTOS_COORDS[dest]) {
      const km = distanciaKm(
        AEROPORTOS_COORDS[orig].lat, AEROPORTOS_COORDS[orig].lng,
        AEROPORTOS_COORDS[dest].lat, AEROPORTOS_COORDS[dest].lng
      );
      trechos.push({
        missao_id:       missaoId,
        regulacao_id:    regulacaoId,
        ordem:           ordem++,
        origem_codigo:   orig,
        origem_nome:     AEROPORTOS_COORDS[orig].nome,
        origem_lat:      AEROPORTOS_COORDS[orig].lat,
        origem_lng:      AEROPORTOS_COORDS[orig].lng,
        destino_codigo:  dest,
        destino_nome:    AEROPORTOS_COORDS[dest].nome,
        destino_lat:     AEROPORTOS_COORDS[dest].lat,
        destino_lng:     AEROPORTOS_COORDS[dest].lng,
        distancia_km:    km.toFixed(2)
      });
    }
  });
  if (trechos.length > 0) {
    await db.from('trechos_missao').insert(trechos);
  }
}

// ── Toast ─────────────────────────────────────────────────────────────
function toast(msg, erro = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (erro ? ' erro' : '');
  setTimeout(() => t.className = 'toast', 3500);
}

// ── Finalizar ─────────────────────────────────────────────────────────
async function finalizarRegulacao() {
  const origem        = document.getElementById('origem').value.trim();
  const destino       = document.getElementById('destino').value.trim();
  const paciente_nome = document.getElementById('paciente_nome').value.trim();
  const naca          = document.getElementById('naca').value;

  if (!origem || !destino) { toast('Informe origem e destino.', true); return; }
  if (!paciente_nome)      { toast('Informe o nome do paciente.', true); return; }
  if (!naca)               { toast('Selecione a classificação NACA.', true); return; }

  const btn = document.getElementById('btn-finalizar');
  btn.disabled = true; btn.textContent = 'Salvando...';

  const codigo = 'AM-' + String(Date.now()).slice(-6);

  // Logística
  const hVoo   = parseInt(document.getElementById('log-horas').value) || 0;
  const mVoo   = parseInt(document.getElementById('log-min').value)   || 0;
  const vooMin = hVoo * 60 + mVoo;
  let totalMin = vooMin + 60;
  if (vooMin > 210) totalMin += 60;

  // PA / PAM
  const pas = document.getElementById('pas').value;
  const pad = document.getElementById('pad').value;
  const pa  = (pas && pad) ? `${pas}/${pad}` : null;
  const pam = parseFloat(document.getElementById('pam-valor').value) || null;

  // GCS
  const gcsTotal      = parseInt(document.getElementById('gcs-total').textContent) || null;
  const pupilarVal    = document.getElementById('gcs-pupilar').value;
  const gcsPupilar    = pupilarVal ? parseInt(pupilarVal) : null;
  const gcsPediatrico = document.getElementById('badge-pediatrico').style.display !== 'none';

  // O2
  const o2Ativo     = document.getElementById('o2_uso').value === 'Sim';
  const o2Disp      = o2Ativo ? document.getElementById('o2-dispositivo').value : null;
  const o2Flow      = o2Ativo ? parseFloat(document.getElementById('o2-flow').value) || null : null;
  const o2Litros    = parseFloat(document.getElementById('o2-litros-hidden').value)    || null;
  const o2Cilindros = parseFloat(document.getElementById('o2-cilindros-hidden').value) || null;
  const hasVM       = o2Ativo && ['CPAP', 'VMI', 'VNI'].includes(o2Disp);
  const isCPAP      = o2Disp === 'CPAP';
  const isVMI       = o2Disp === 'VMI';

  // Infusão
  const infusaoContinua = document.getElementById('infusao-ativo').value === 'Sim';
  const duas            = infusaoContinua ? coletarDVAs()   : [];
  const outrasDrogas    = infusaoContinua ? coletarDrogas() : [];

  // Restrições de altitude
  const recomendacaoAltitude = Object.values(toggleState).some(v => v);

  // Equipe
  const selMedico       = document.getElementById('equipe-medico');
  const selEnfermeiro   = document.getElementById('equipe-enfermeiro');
  const medicoVooId     = selMedico.value     || null;
  const enfermeiroVooId = selEnfermeiro.value || null;
  const medicoVooNome   = medicoVooId     ? selMedico.options[selMedico.selectedIndex].text         : null;
  const enfermeiroNome  = enfermeiroVooId ? selEnfermeiro.options[selEnfermeiro.selectedIndex].text : null;

  const regulacaoData = {
    codigo,
    medico_id:             usuarioAtual.id,
    origem,
    destino,
    hospital_origem:       document.getElementById('log-hospital-origem').value.trim()  || 'Ignorado',
    leito_origem:          document.getElementById('log-leito-origem').value.trim()     || 'Ignorado',
    hospital_destino:      document.getElementById('log-hospital-destino').value.trim() || 'Ignorado',
    leito_destino:         document.getElementById('log-leito-destino').value.trim()    || 'Ignorado',
    aeronave:              document.getElementById('aeronave').value,
    tempo_voo_horas:       hVoo,
    tempo_voo_minutos:     mVoo,
    tempo_total_missao:    vooMin > 0 ? totalMin : null,
    paciente_nome,
    paciente_idade:        parseInt(document.getElementById('paciente_idade').value)   || null,
    paciente_idade_meses:  parseInt(document.getElementById('pac-meses').value)        || null,
    paciente_idade_dias:   parseInt(document.getElementById('pac-dias').value)         || null,
    paciente_peso:         parseFloat(document.getElementById('pac-peso').value)       || null,
    paciente_sexo:         document.getElementById('paciente_sexo').value,
    diagnostico:           document.getElementById('diagnostico').value.trim(),
    naca,
    pa,
    pam,
    fc:                    parseInt(document.getElementById('fc').value)     || null,
    fr:                    parseInt(document.getElementById('fr').value)     || null,
    spo2:                  parseInt(document.getElementById('spo2').value)   || null,
    temp:                  parseFloat(document.getElementById('temp').value) || null,
    gcs_o:                 parseInt(document.getElementById('gcs_o').value)  || null,
    gcs_v:                 parseInt(document.getElementById('gcs_v').value)  || null,
    gcs_m:                 parseInt(document.getElementById('gcs_m').value)  || null,
    gcs_total:             gcsTotal,
    gcs_pupilar:           gcsPupilar,
    gcs_pediatrico:        gcsPediatrico,
    o2_ativo:              o2Ativo,
    o2_dispositivo:        o2Disp,
    o2_flow:               o2Flow,
    vm_modo:               hasVM && !isCPAP ? document.getElementById('vm-modo')?.value    || null : null,
    vm_fio2:               hasVM ? parseInt(isCPAP ? document.getElementById('vm-cpap-fio2')?.value : document.getElementById('vm-fio2')?.value) || null : null,
    vm_peep:               hasVM && !isCPAP ? parseInt(document.getElementById('vm-peep')?.value)    || null : null,
    vm_volume:             isVMI ? parseInt(document.getElementById('vm-volume')?.value)    || null : null,
    vm_freq:               hasVM && !isCPAP ? parseInt(document.getElementById('vm-freq')?.value)    || null : null,
    vm_ps:                 hasVM && !isCPAP ? parseFloat(document.getElementById('vm-ps')?.value)    || null : null,
    vm_ti:                 hasVM && !isCPAP ? parseFloat(document.getElementById('vm-ti')?.value)    || null : null,
    vm_fluxo:              hasVM && !isCPAP ? parseFloat(document.getElementById('vm-fluxo')?.value) || null : null,
    vm_obs:                hasVM ? (isCPAP ? document.getElementById('vm-cpap-obs')?.value.trim() || null : document.getElementById('vm-obs')?.value.trim() || null) : null,
    o2_litros_necessarios:    o2Litros,
    o2_cilindros_necessarios: o2Cilindros,
    infusao_continua:      infusaoContinua,
    duas:                  duas.length         ? JSON.stringify(duas)         : null,
    outras_drogas:         outrasDrogas.length ? JSON.stringify(outrasDrogas) : null,
    observacoes:           document.getElementById('obs-anotacoes').value.trim() || null,
    cirurgia_recente:      toggleState.cirurgia,
    pneumo_nao_drenado:    toggleState.pneumo,
    obstrucao_intestinal:  toggleState.obstrucao,
    outra_restricao_altitude: toggleState['outra-restricao'],
    outra_restricao_obs:   toggleState['outra-restricao']
      ? document.getElementById('outra-restricao-obs').value.trim() || null
      : null,
    recomendacao_altitude: recomendacaoAltitude,
    fluxo:                 fluxoSelecionado || null,
    fluxo_reavaliacao_horas: fluxoSelecionado === 'reavaliacao'
      ? parseInt(document.getElementById('fluxo-horas').value) || null
      : null,
    medico_voo_id:         medicoVooId,
    enfermeiro_voo_id:     enfermeiroVooId,
    medico_voo_nome:       medicoVooNome,
    enfermeiro_voo_nome:   enfermeiroNome,
    status:                'Em andamento',
    created_at:            new Date().toISOString(),
  };

  try {
    const { data: reg, error: regErr } = await db.from('regulacoes')
      .insert(regulacaoData).select('id').single();
    if (regErr) throw regErr;

    const kmTotal = parseFloat(document.getElementById('km-total-hidden').value) || 0;

    const { data: missao, error: missErr } = await db.from('missoes').insert({
      codigo,
      medico_id:      usuarioAtual.id,
      paciente_nome,
      paciente_idade: regulacaoData.paciente_idade,
      origem,
      destino,
      tipo:           regulacaoData.aeronave,
      equipe:         perfilAtual.nome || '',
      status:         'Em andamento',
      naca,
      diagnostico:    regulacaoData.diagnostico,
      hora_pouso:     null,
      hora_transferencia: null,
      desfecho:       null,
      km_total:       kmTotal > 0 ? kmTotal : null,
      medico_voo_id:  medicoVooId,
      medico_voo_nome: medicoVooNome,
      enfermeiro_voo_id: enfermeiroVooId,
      enfermeiro_voo_nome: enfermeiroNome,
    }).select('id').single();
    if (missErr) throw missErr;

    if (reg?.id && missao?.id) {
      await db.from('regulacoes').update({ missao_id: missao.id }).eq('id', reg.id);
      await salvarTrechos(missao.id, reg.id);
    }

    regulacaoSalva = regulacaoData;
    toast('✓ Regulação e missão criadas com sucesso!');
    btn.textContent = '✓ Salvo — volte ao painel ou exporte o PDF';
    document.getElementById('btn-pdf').style.display = 'inline-flex';
  } catch(e) {
    toast('Erro ao salvar: ' + (e.message || 'verifique os dados e tente novamente.'), true);
    btn.disabled = false; btn.textContent = '✓ Finalizar e Criar Missão';
  }
}

// ── Exportar PDF ──────────────────────────────────────────────────────
function exportarPDF() {
  if (!regulacaoSalva) { toast('Salve a regulação antes de exportar.', true); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const d   = regulacaoSalva;
  const ML  = 14, PW = 210, CW = 182;
  let y     = 0;

  const C = {
    navy:   [15, 30, 53],
    navy2:  [10, 14, 20],
    green:  [120, 190, 32],
    white:  [255, 255, 255],
    red:    [220, 38, 38],
    amber:  [212, 168, 32],
    text:   [31, 41, 55],
    bg:     [255, 255, 255],
    border: [210, 218, 228],
    secBg:  [240, 247, 232],
    pageBg: [240, 244, 248],
  };

  const sf = (r) => doc.setFillColor(...r);
  const sd = (r) => doc.setDrawColor(...r);
  const st = (r) => doc.setTextColor(...r);
  const ff = (s, sz) => { doc.setFont('helvetica', s); doc.setFontSize(sz); };
  const ln = (x1,y1,x2,y2) => doc.line(x1,y1,x2,y2);

  function seg(pts) {
    pts.reduce((p, c) => { if (p) ln(p[0], p[1], c[0], c[1]); return c; });
  }

  function bgPage() {
    doc.setFillColor(...C.pageBg);
    doc.rect(0, 0, PW, 297, 'F');
  }

  function miniHeader() {
    bgPage();
    sf(C.navy); doc.rect(0, 0, PW, 8, 'F');
    st(C.green); ff('bold', 7);
    doc.text('ALTUSMED', ML, 5.5);
    st(C.white); ff('normal', 6);
    doc.text('Ficha de Regulação Aeromédica — continuação', PW / 2, 5.5, { align: 'center' });
    st(C.green); ff('bold', 6);
    if (d.codigo) doc.text(d.codigo, PW - ML, 5.5, { align: 'right' });
    sf(C.green); doc.rect(0, 8, PW, 0.8, 'F');
    y = 14;
  }

  function checkPage(need) {
    need = need || 20;
    if (y > 279 - need) { doc.addPage(); miniHeader(); }
  }

  // ─── CABEÇALHO ────────────────────────────────────────────────────────
  bgPage();
  const HDR_H = 22;
  sf(C.navy); doc.rect(0, 0, PW, HDR_H, 'F');

  // Ícone ECG no header
  sf([30, 55, 15]); doc.roundedRect(ML, 3.5, 8, 8, 1.5, 1.5, 'F');
  sd(C.green); doc.setLineWidth(0.6);
  (() => {
    const ix = ML + 0.8, iy = 7.5;
    seg([[ix,iy],[ix+1.2,iy],[ix+1.8,iy-2],[ix+2.3,iy+2.2],[ix+2.8,iy],[ix+4,iy],
         [ix+4.8,iy],[ix+5.4,iy-2],[ix+5.9,iy+2.2],[ix+6.4,iy],[ix+7.2,iy]]);
  })();

  // ALTUSMED e subtexto
  st(C.green); ff('bold', 10);
  doc.text('ALTUSMED', ML + 10.5, 8.5);
  doc.setTextColor(200, 215, 230); ff('normal', 5.5);
  doc.text('TRANSPORTE AEROMÉDICO', ML + 10.5, 12);

  // Título central
  st(C.white); ff('bold', 8);
  doc.text('Ficha de Regulação Aeromédica', PW / 2, 8.5, { align: 'center' });

  // Código AM à direita em verde
  st(C.green); ff('bold', 10);
  doc.text(d.codigo || '', PW - ML, 9, { align: 'right' });

  // Linha separadora inferior do header
  const yBot = HDR_H - 4.5;
  sd(C.green); doc.setLineWidth(0.2);
  ln(ML, yBot - 1, PW - ML, yBot - 1);

  const now = new Date();
  const dataHora = now.toLocaleDateString('pt-BR') + ' · ' +
    now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const medicoSaud = (() => {
    const tipo = perfilAtual.cargo_tipo || '';
    const nome = perfilAtual.nome || '';
    const pref = (tipo === 'medico' || tipo === 'diretor') ? 'Dr. ' :
                 (tipo === 'enfermeiro' ? 'ENF(a). ' : '');
    const reg  = perfilAtual.crm
      ? (perfilAtual.registro_tipo || 'CRM') + '/' + (perfilAtual.registro_uf || 'PA') + ' ' + perfilAtual.crm
      : '';
    return (pref + nome + (reg ? ' · ' + reg : '')).trim();
  })();

  doc.setTextColor(180, 200, 220); ff('normal', 5.5);
  doc.text(dataHora, ML, yBot + 0.8);
  st(C.green); ff('italic', 5.5);
  doc.text('Cuidados sem fronteiras, dedicação sem limites', PW / 2, yBot + 0.8, { align: 'center' });
  doc.setTextColor(180, 200, 220); ff('normal', 5.5);
  if (medicoSaud) doc.text(medicoSaud, PW - ML, yBot + 0.8, { align: 'right' });

  // Faixa verde 3px na base
  sf(C.green); doc.rect(0, HDR_H, PW, 1.2, 'F');
  y = HDR_H + 1.2 + 4;

  // ─── HELPERS ──────────────────────────────────────────────────────────

  function secTitle(titulo) {
    checkPage(10);
    y += 2;
    sf(C.secBg); doc.rect(ML, y, CW, 6, 'F');
    sf(C.green); doc.rect(ML, y, 1.5, 6, 'F');
    st(C.navy); ff('bold', 6.5);
    doc.text(titulo.toUpperCase(), ML + 4, y + 4.2);
    y += 8;
    ff('normal', 8); st(C.text);
  }

  function drawField(label, value, fx, fy, fw, fh) {
    if (value === null || value === undefined || value === '') return;
    fh = fh || 10;
    sf(C.bg); sd(C.border); doc.setLineWidth(0.2);
    doc.roundedRect(fx, fy, fw, fh, 1, 1, 'FD');
    doc.setTextColor(170, 170, 170); ff('normal', 5);
    doc.text(label.toUpperCase(), fx + 2.5, fy + 3.5);
    st(C.text); ff('bold', 7);
    const fit = doc.splitTextToSize(String(value), fw - 5);
    doc.text(fit[0], fx + 2.5, fy + 8);
  }

  function fieldRow(cols, rowH) {
    rowH = rowH || 10;
    checkPage(rowH + 2);
    const totalSpan = cols.reduce((s, c) => s + (c.span || 1), 0);
    const gap = 2, totalGap = gap * (cols.length - 1);
    let cx = ML;
    cols.forEach(c => {
      const fw = ((c.span || 1) / totalSpan) * (CW - totalGap);
      drawField(c.label, c.value, cx, y, fw, rowH);
      cx += fw + gap;
    });
    y += rowH + 2;
  }

  // ─── ALERTA ALTITUDE (topo) ────────────────────────────────────────────
  if (d.recomendacao_altitude) {
    checkPage(14);
    sf([254, 242, 242]); sd(C.red); doc.setLineWidth(0.4);
    doc.roundedRect(ML, y, CW, 11, 2, 2, 'FD');
    st(C.red); ff('bold', 7.5);
    doc.text('! RECOMENDAÇÃO DE VOO COM ALTITUDE DE CABINE REDUZIDA', ML + 4, y + 5);
    const lista = [];
    if (d.cirurgia_recente)         lista.push('Cirurgia recente < 7 dias');
    if (d.pneumo_nao_drenado)       lista.push('Pneumotórax / Pneumoencéfalo não drenado');
    if (d.obstrucao_intestinal)     lista.push('Obstrução intestinal');
    if (d.outra_restricao_altitude && d.outra_restricao_obs) lista.push(d.outra_restricao_obs);
    if (lista.length) {
      doc.setTextColor(153, 27, 27); ff('normal', 5.5);
      const alertTxt = doc.splitTextToSize(lista.join(' · '), CW - 8);
      doc.text(alertTxt[0], ML + 4, y + 9);
    }
    y += 14;
  }

  // ─── LOGÍSTICA ────────────────────────────────────────────────────────
  checkPage(25);
  secTitle('Logística');

  const origemText  = document.getElementById('origem-input')?.value
                    || document.getElementById('log-origem')?.value
                    || d.origem || '';
  const destinoText = document.getElementById('destino-input')?.value
                    || document.getElementById('log-destino')?.value
                    || d.destino || '';
  if (origemText || destinoText) {
    fieldRow([
      { label: 'Origem',  value: origemText  || null, span: 2 },
      { label: 'Destino', value: destinoText || null, span: 2 },
    ]);
  }

  // Trechos visuais com setas
  (() => {
    const trechos = [];
    document.querySelectorAll('[id^="tr-orig-"]').forEach(el => {
      const i    = el.id.replace('tr-orig-', '');
      const orig = el.value.toUpperCase().trim();
      const dest = (document.getElementById('tr-dest-' + i)?.value || '').toUpperCase().trim();
      if (orig && dest) {
        const km = (AEROPORTOS_COORDS[orig] && AEROPORTOS_COORDS[dest])
          ? distanciaKm(AEROPORTOS_COORDS[orig].lat, AEROPORTOS_COORDS[orig].lng,
                        AEROPORTOS_COORDS[dest].lat, AEROPORTOS_COORDS[dest].lng).toFixed(0)
          : null;
        trechos.push({ orig, dest, km });
      }
    });
    if (!trechos.length) return;

    checkPage(14);
    const pontos = [];
    trechos.forEach((t, i) => {
      if (i === 0) pontos.push({ code: t.orig, km: null });
      pontos.push({ code: t.dest, km: t.km });
    });

    let cx = ML;
    pontos.forEach((p, i) => {
      const bw = p.km ? 22 : 16;
      sf(C.secBg); sd(C.green); doc.setLineWidth(0.3);
      doc.roundedRect(cx, y, bw, 9, 1.5, 1.5, 'FD');
      st([39, 80, 10]); ff('bold', 7);
      doc.text(p.code, cx + bw / 2, y + 4.8, { align: 'center' });
      if (p.km) {
        doc.setTextColor(136, 136, 136); ff('normal', 4.5);
        doc.text(p.km + 'km', cx + bw / 2, y + 8.2, { align: 'center' });
      }
      cx += bw;
      if (i < pontos.length - 1) {
        st(C.green); ff('normal', 10);
        doc.text('>', cx + 1.5, y + 6.2);
        cx += 8;
      }
    });

    const kmTotal = parseFloat(document.getElementById('km-total-hidden')?.value) || 0;
    if (kmTotal > 0 && cx + 26 < ML + CW) {
      cx += 4;
      sf(C.secBg); sd(C.green); doc.setLineWidth(0.3);
      doc.roundedRect(cx, y, 24, 9, 1.5, 1.5, 'FD');
      st(C.green); ff('bold', 7);
      doc.text(kmTotal.toFixed(0) + ' km', cx + 12, y + 5.5, { align: 'center' });
    }
    y += 13;
  })();

  const hVoo = (d.tempo_voo_horas || 0) + 'h ' + (d.tempo_voo_minutos || 0) + 'min';
  let tempoTotal = null;
  if (d.tempo_total_missao) {
    const ht = Math.floor(d.tempo_total_missao / 60), mt = d.tempo_total_missao % 60;
    tempoTotal = ht + 'h ' + mt + 'min';
  }
  fieldRow([
    { label: 'Aeronave',           value: d.aeronave,   span: 1 },
    { label: 'Tempo de voo',       value: hVoo,         span: 1 },
    { label: 'Tempo total missão', value: tempoTotal,   span: 1 },
  ]);

  const origH = (d.hospital_origem  && d.hospital_origem  !== 'Ignorado') ? d.hospital_origem  : null;
  const origL = (origH && d.leito_origem    && d.leito_origem    !== 'Ignorado') ? d.leito_origem    : null;
  const destH = (d.hospital_destino && d.hospital_destino !== 'Ignorado') ? d.hospital_destino : null;
  const destL = (destH && d.leito_destino   && d.leito_destino   !== 'Ignorado') ? d.leito_destino   : null;
  if (origH || destH) {
    fieldRow([
      { label: 'Hospital origem',  value: origH ? origH + (origL ? ' · ' + origL : '') : null, span: 1 },
      { label: 'Hospital destino', value: destH ? destH + (destL ? ' · ' + destL : '') : null, span: 1 },
    ]);
  }

  // ─── PACIENTE ────────────────────────────────────────────────────────
  checkPage(25);
  secTitle('Paciente');

  let idadeStr = null;
  if (d.paciente_idade != null) {
    idadeStr = d.paciente_idade > 0 ? d.paciente_idade + ' anos' : '< 1 ano';
    if (d.paciente_idade === 0 && d.paciente_idade_meses)
      idadeStr = d.paciente_idade_meses + ' meses';
  }
  const idadePeso = [idadeStr, d.paciente_peso ? d.paciente_peso + ' kg' : null].filter(Boolean).join(' · ');

  fieldRow([
    { label: 'Nome',          value: d.paciente_nome, span: 2 },
    { label: 'Idade / Peso',  value: idadePeso || null, span: 1 },
    { label: 'NACA',          value: d.naca, span: 1 },
  ]);
  if (d.diagnostico) {
    fieldRow([
      { label: 'Diagnóstico',     value: d.diagnostico, span: 3 },
      { label: 'Sexo',            value: d.paciente_sexo, span: 1 },
    ]);
  }

  // ─── MONITOR ────────────────────────────────────────────────────────
  checkPage(95);
  secTitle('Sinais Vitais — Monitor AltusMed');
  checkPage(85);

  (() => {
    const mX = ML, mW = CW, mH = 95;
    const xV = mX + mW - 34, wV = 34, wC = mW - wV - 1;
    const yM = y;

    // Fundo escuro
    sf(C.navy2); sd([26, 42, 58]); doc.setLineWidth(0.4);
    doc.roundedRect(mX, yM, mW, mH, 2, 2, 'FD');

    // Header do monitor
    sf(C.navy); doc.rect(mX, yM, mW, 9, 'F');
    sd(C.green); doc.setLineWidth(0.3);
    ln(mX, yM + 9, mX + mW, yM + 9);

    // Mini ECG no header
    doc.setLineWidth(0.5);
    (() => {
      const hix = mX + 3, hiy = yM + 5.5;
      seg([[hix,hiy],[hix+1,hiy],[hix+1.5,hiy-2],[hix+2,hiy+1.5],[hix+2.5,hiy],[hix+4,hiy]]);
    })();

    st(C.green); ff('bold', 7);
    doc.text('ALTUSMED MONITOR', mX + 7.5, yM + 6.2);

    st(C.white); ff('normal', 5.5);
    doc.text((d.paciente_nome || '').substring(0, 30), xV - 1, yM + 4.5, { align: 'right' });
    doc.setTextColor(160, 180, 200); ff('normal', 4.5);
    doc.text((d.diagnostico || '').substring(0, 38), xV - 1, yM + 8, { align: 'right' });

    // Separador curvas | painel lateral
    sd([26, 42, 58]); doc.setLineWidth(0.2);
    ln(xV, yM + 9, xV, yM + mH - 7);

    // Curvas
    const coresW = {
      ecg:  [0, 255, 136],
      spo2: [0, 204, 255],
      resp: [255, 204, 0],
      pa:   [255, 102, 102],
    };
    const rowH = 12;
    const lbls = ['ECG · II · 25mm/s', 'SpO2 · Pleth', 'Resp · II', 'Pressão Arterial'];
    const lblC = [[0,180,80],[0,150,180],[180,150,0],[180,60,60]];
    const yC0  = yM + 10;
    const xW   = mX + 2, wW = wC - 3;

    lbls.forEach((lb, idx) => {
      const yr = yC0 + idx * rowH;
      doc.setTextColor(...lblC[idx]); ff('normal', 4.5);
      doc.text(lb, xW, yr + 3);
      if (idx < 3) {
        sd([17, 26, 36]); doc.setLineWidth(0.15);
        ln(xW, yr + rowH - 0.3, xV - 1, yr + rowH - 0.3);
      }
    });

    function drawECG(yBase) {
      sd(coresW.ecg); doc.setLineWidth(0.5);
      const s = wW / 4;
      for (let rep = 0; rep < 4; rep++) {
        const ox = xW + rep * s;
        seg([[ox,yBase],[ox+s*.55,yBase],[ox+s*.63,yBase-3.5],
             [ox+s*.68,yBase+2.5],[ox+s*.73,yBase],[ox+s,yBase]]);
      }
    }

    function drawSine(yBase, amp, cor, freq) {
      sd(cor); doc.setLineWidth(0.5);
      let px = xW, py = yBase;
      for (let i = 1; i <= 60; i++) {
        const nx = xW + (i/60)*wW, ny = yBase - Math.sin((i/60)*Math.PI*2*freq)*amp;
        ln(px, py, nx, ny); px = nx; py = ny;
      }
    }

    function drawPA(yBase) {
      sd(coresW.pa); doc.setLineWidth(0.5);
      const s = wW / 6;
      for (let rep = 0; rep < 6; rep++) {
        const ox = xW + rep * s;
        seg([[ox,yBase],[ox+s*.2,yBase],[ox+s*.3,yBase-3.5],
             [ox+s*.4,yBase-1],[ox+s*.5,yBase+1.5],[ox+s,yBase]]);
      }
    }

    drawECG(yC0 + 8);
    drawSine(yC0 + rowH + 8, 2.5, coresW.spo2, 3);
    drawSine(yC0 + 2*rowH + 8, 2, coresW.resp, 1.5);
    drawPA(yC0 + 3*rowH + 8);

    // Glasgow
    const yGCS = yC0 + 4*rowH + 2;
    const gcsO = parseInt(d.gcs_o) || 0;
    const gcsVv = parseInt(d.gcs_v) || 0;
    const gcsM = parseInt(d.gcs_m) || 0;
    const gcsTot = d.gcs_total || (gcsO + gcsVv + gcsM);

    st([180, 120, 255]); ff('bold', 5);
    doc.text('GLASGOW', xW, yGCS + 3);
    st([200, 136, 255]); ff('bold', 11);
    doc.text(String(gcsTot || '-'), xW + 17, yGCS + 8, { align: 'center' });
    sd([150, 100, 220]); doc.setLineWidth(0.3);
    ln(xW + 25, yGCS - 0.5, xW + 25, yGCS + 9.5);

    const comps = [{ lbl:'AO', val:d.gcs_o||'-' },{ lbl:'RV', val:d.gcs_v||'-' },{ lbl:'RM', val:d.gcs_m||'-' }];
    comps.forEach((c, i) => {
      const cx2 = xW + 28 + i * 16;
      sf([50, 30, 70]); doc.rect(cx2, yGCS - 0.5, 14, 10, 'F');
      st([170,110,230]); ff('bold', 5.5);
      doc.text(c.lbl, cx2 + 7, yGCS + 4, { align: 'center' });
      st([200,136,255]); ff('bold', 8);
      doc.text(String(c.val), cx2 + 7, yGCS + 9, { align: 'center' });
    });

    if (d.gcs_pupilar) {
      const desc = d.gcs_pupilar == 2 ? 1 : d.gcs_pupilar == 3 ? 2 : 0;
      const gcsp = gcsTot - desc;
      const cx2  = xW + 28 + 3*16;
      sd([150,100,220]); doc.setLineWidth(0.3);
      ln(cx2 - 2, yGCS - 0.5, cx2 - 2, yGCS + 9.5);
      sf([40, 25, 60]); doc.rect(cx2, yGCS - 0.5, 18, 10, 'F');
      st([160,100,210]); ff('bold', 5.5);
      doc.text('GCS-P', cx2 + 9, yGCS + 4, { align: 'center' });
      st([180,120,240]); ff('bold', 8);
      doc.text(String(gcsp), cx2 + 9, yGCS + 9, { align: 'center' });
    }

    // Painel lateral de valores
    const vitais = [
      { lbl:'HR·ECG',     val:d.fc   ? String(d.fc)   : '-', unit:'bpm', cor:[0,220,100],  fs:20 },
      { lbl:'SpO2',       val:d.spo2 ? String(d.spo2) : '-', unit:'%',   cor:[0,180,230],  fs:20 },
      { lbl:'Resp',       val:d.fr   ? String(d.fr)   : '-', unit:'rpm', cor:[220,180,0],  fs:18 },
      { lbl:'P.Arterial', val:d.pa   ? String(d.pa)   : '-', unit:'',    cor:[230,80,80],  fs:14, pam:true },
      { lbl:'Temp',       val:d.temp ? String(d.temp) : '-', unit:'C',   cor:[230,140,50], fs:16 },
    ];
    const altV = (mH - 16) / vitais.length;
    let yv = yM + 9;
    vitais.forEach(v => {
      const [r,g,b] = v.cor;
      sf([Math.floor(r*.07)+8, Math.floor(g*.07)+8, Math.floor(b*.07)+14]);
      doc.rect(xV, yv, wV, altV - 0.3, 'F');
      sd([Math.floor(r*.15)+10, Math.floor(g*.15)+10, Math.floor(b*.15)+14]);
      doc.setLineWidth(0.15); doc.rect(xV, yv, wV, altV - 0.3, 'S');

      const mid = yv + altV / 2;

      // Label (pequeno, acima do centro)
      st([Math.floor(r*.55), Math.floor(g*.55), Math.floor(b*.55)]);
      ff('normal', 6); doc.text(v.lbl, xV + wV/2, mid - 4, { align: 'center' });

      // Valor (centrado no bloco)
      st(v.cor); ff('bold', v.fs);
      if (v.pam) {
        // PA: sistólica/diastólica centrada, PAM abaixo sem rótulo extra
        doc.text(v.val.substring(0, 7), xV + wV/2, mid + 1, { align: 'center' });
        if (d.pam) {
          st([Math.floor(r*.7), Math.floor(g*.7), Math.floor(b*.7)]);
          ff('bold', 9);
          doc.text('(' + Math.round(d.pam) + ')', xV + wV/2, mid + 5.5, { align: 'center' });
        }
      } else {
        doc.text(v.val.substring(0, 6), xV + wV/2, mid + 2, { align: 'center' });
        // Unidade (pequena, abaixo do valor)
        st([Math.floor(r*.45), Math.floor(g*.45), Math.floor(b*.45)]);
        ff('normal', 7);
        doc.text(v.unit, xV + wV/2, mid + 5.5, { align: 'center' });
      }
      yv += altV;
    });

    // Rodapé do monitor
    const yBotM = yM + mH - 6.5;
    sf([6, 10, 15]); doc.rect(mX, yBotM, mW, 6.5, 'F');
    sd(C.navy2); doc.setLineWidth(0.15);
    ln(mX, yBotM, mX + mW, yBotM);

    // Alerta altitude (esquerda)
    if (d.recomendacao_altitude) {
      sf([180, 0, 0]); doc.circle(mX + 4, yBotM + 3.2, 1.5, 'F');
      st([255,100,100]); ff('bold', 5.5);
      doc.text('ALTITUDE CABINE REDUZIDA', mX + 7.5, yBotM + 4.5);
    }

    // Dispositivo O2 (centro) — separado do NACA
    if (d.o2_dispositivo && ['VMI','VNI','CPAP'].includes(d.o2_dispositivo)) {
      let otxt = String(d.o2_dispositivo);
      if (d.vm_fio2) otxt += ' FiO2 ' + d.vm_fio2 + '%';
      if (d.vm_peep) otxt += ' PEEP ' + d.vm_peep;
      st([230,140,50]); ff('normal', 5.5);
      doc.text(otxt, mX + mW/2, yBotM + 4.5, { align: 'center' });
    }

    // NACA (direita) — sem °C grudado
    if (d.naca) {
      sf(C.red); doc.roundedRect(mX + mW - 20, yBotM + 1.2, 18, 4.5, 1, 1, 'F');
      st(C.white); ff('bold', 5.5);
      doc.text(d.naca, mX + mW - 11, yBotM + 4.5, { align: 'center' });
    }

    y = yM + mH + 4;
  })();

  // ─── O2 / VENTILAÇÃO ────────────────────────────────────────────────
  if (d.o2_ativo) {
    checkPage(25);
    secTitle('O2 e Ventilação Mecânica');
    fieldRow([
      { label: 'Dispositivo', value: d.o2_dispositivo || null, span: 1 },
      { label: 'Fluxo',       value: d.o2_flow ? d.o2_flow + ' L/min' : null, span: 1 },
    ]);
    if (d.o2_dispositivo && ['VMI','VNI','CPAP'].includes(d.o2_dispositivo)) {
      fieldRow([
        { label: 'Modo',  value: d.vm_modo  || null, span: 1 },
        { label: 'FiO2',  value: d.vm_fio2  ? d.vm_fio2  + '%'      : null, span: 1 },
        { label: 'PEEP',  value: d.vm_peep  ? d.vm_peep  + ' cmH2O' : null, span: 1 },
      ]);
      if (d.vm_volume || d.vm_freq || d.vm_ps) {
        fieldRow([
          { label: 'Vol. corrente',    value: d.vm_volume ? d.vm_volume + ' ml'    : null, span: 1 },
          { label: 'Freq. programada', value: d.vm_freq   ? d.vm_freq   + ' rpm'   : null, span: 1 },
          { label: 'Pressão suporte',  value: d.vm_ps     ? d.vm_ps     + ' cmH2O' : null, span: 1 },
          { label: 'Tempo insp.',      value: d.vm_ti     ? d.vm_ti     + ' s'     : null, span: 1 },
        ]);
      }
    }
    if (d.o2_litros_necessarios) {
      checkPage(10);
      sf(C.secBg); sd(C.green); doc.setLineWidth(0.25);
      doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, 'FD');
      st([59, 109, 17]); ff('normal', 8);
      const cils = d.o2_cilindros_necessarios;
      doc.text(
        'O2 necessario: ' + d.o2_litros_necessarios + ' L' + (cils ? ' · Cilindro E = ' + cils : ''),
        ML + 4, y + 5.5
      );
      y += 10;
    }
  }

  // ─── MEDICAÇÕES ──────────────────────────────────────────────────────
  const dvaList   = (() => { try { return d.duas         ? (typeof d.duas         === 'string' ? JSON.parse(d.duas)         : d.duas)         : []; } catch(e) { return []; } })();
  const drogaList = (() => { try { return d.outras_drogas ? (typeof d.outras_drogas === 'string' ? JSON.parse(d.outras_drogas) : d.outras_drogas) : []; } catch(e) { return []; } })();

  if (d.infusao_continua && (dvaList.length || drogaList.length)) {
    const DVA_NOMES = ['Norepinefrina','Epinefrina','Dopamina','Dobutamina','Vasopressina',
      'Fenilefrina','Milrinona','Levosimendan','Prostaglandina','Terlipressina','Angiotensina'];
    const isDVA = nome => DVA_NOMES.some(n => nome.toLowerCase().includes(n.toLowerCase()));
    const todasDrogas  = [...dvaList, ...drogaList].filter(item => item.droga);
    const dvasRender   = todasDrogas.filter(item =>  isDVA(item.droga));
    const outrasRender = todasDrogas.filter(item => !isDVA(item.droga));

    const renderDrug = item => {
      checkPage(10);
      sf([255,248,240]); sd([240,160,64]); doc.setLineWidth(0.2);
      doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, 'FD');
      st(C.text); ff('bold', 8);
      doc.text(item.droga, ML + 4, y + 5.5);
      const doseStr = item.valor ? String(item.valor) + ' ' + (item.unidade || '') : '-';
      st([133, 79, 11]); ff('normal', 8);
      doc.text(doseStr, ML + CW - 4, y + 5.5, { align: 'right' });
      y += 10;
    };

    if (dvasRender.length) {
      checkPage(25);
      secTitle('Drogas Vasoativas em Infusao');
      dvasRender.forEach(renderDrug);
    }
    if (outrasRender.length) {
      checkPage(25);
      secTitle('Outras Drogas em Infusao Continua');
      outrasRender.forEach(renderDrug);
    }
  }

  // ─── ALTITUDE DETALHES ──────────────────────────────────────────────
  if (d.recomendacao_altitude) {
    checkPage(25);
    secTitle('Recomendações de Altitude de Cabine');
    checkPage(15);
    sf([254,242,242]); sd(C.red); doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, 'FD');
    st([153, 27, 27]); ff('bold', 7);
    doc.text('! ALTITUDE DE CABINE REDUZIDA — <5.000 pés ou a critério médico', ML + 4, y + 5.5);
    y += 10;

    const toggleItems = [
      { label: 'Cirurgia recente < 7 dias',                  val: d.cirurgia_recente },
      { label: 'Pneumotórax / Pneumoencéfalo não drenado',    val: d.pneumo_nao_drenado },
      { label: 'Obstrução intestinal',                         val: d.obstrucao_intestinal },
      { label: d.outra_restricao_obs || 'Outra restrição',    val: d.outra_restricao_altitude },
    ];
    toggleItems.forEach(item => {
      checkPage(8);
      st([68, 68, 68]); ff('normal', 7.5);
      doc.text(item.label, ML + 2, y + 4.5);
      if (item.val) {
        sf(C.red); doc.roundedRect(ML + CW - 15, y + 0.5, 13, 6, 1.5, 1.5, 'F');
        st(C.white); ff('bold', 6);
        doc.text('SIM', ML + CW - 8.5, y + 4.8, { align: 'center' });
      } else {
        sf([240,240,240]); doc.roundedRect(ML + CW - 15, y + 0.5, 13, 6, 1.5, 1.5, 'F');
        st([136,136,136]); ff('normal', 6);
        doc.text('NÃO', ML + CW - 8.5, y + 4.8, { align: 'center' });
      }
      sd([240,240,240]); doc.setLineWidth(0.2);
      ln(ML, y + 7.5, ML + CW, y + 7.5);
      y += 8;
    });
  }

  // ─── OBSERVAÇÕES ────────────────────────────────────────────────────
  if (d.observacoes) {
    checkPage(25);
    secTitle('Observações e Anotações');
    const obsLines = doc.splitTextToSize(d.observacoes, CW - 8);
    const obsH     = Math.max(12, obsLines.length * 5 + 6);
    checkPage(obsH + 4);
    sf(C.bg); sd(C.border); doc.setLineWidth(0.2);
    doc.roundedRect(ML, y, CW, obsH, 1.5, 1.5, 'FD');
    st([68, 68, 68]); ff('normal', 8);
    obsLines.forEach((l, i) => doc.text(l, ML + 4, y + 5 + i * 5));
    y += obsH + 3;
  }

  // ─── FLUXO E EQUIPE ──────────────────────────────────────────────────
  if (d.fluxo || d.medico_voo_nome || d.enfermeiro_voo_nome) {
    checkPage(25);
    const yG = y, half = (CW - 3) / 2;

    if (d.fluxo) {
      sf(C.secBg); doc.rect(ML, yG, half, 6, 'F');
      sf(C.green); doc.rect(ML, yG, 1.5, 6, 'F');
      st(C.navy); ff('bold', 6.5);
      doc.text('DECISÃO MÉDICA', ML + 4, yG + 4.2);

      const fluxoLabel = {
        liberado:     'Liberado para Voo',
        reavaliacao:  'Reavaliação em ' + (d.fluxo_reavaliacao_horas || '?') + 'h',
        misericordia: 'Voo de Misericórdia',
        negado:       'Voo Negado',
      }[d.fluxo] || d.fluxo;

      sf([232,244,212]); sd(C.green); doc.setLineWidth(0.3);
      doc.roundedRect(ML, yG + 7, half, 10, 2, 2, 'FD');
      st([22, 163, 74]); ff('bold', 8);
      doc.text(fluxoLabel, ML + half / 2, yG + 13.5, { align: 'center' });
    }

    if (d.medico_voo_nome || d.enfermeiro_voo_nome) {
      const ex = ML + half + 3;
      sf(C.secBg); doc.rect(ex, yG, half, 6, 'F');
      sf(C.green); doc.rect(ex, yG, 1.5, 6, 'F');
      st(C.navy); ff('bold', 6.5);
      doc.text('EQUIPE DE VOO', ex + 4, yG + 4.2);
      let ey = yG + 7;
      if (d.medico_voo_nome)     { drawField('Médico',        d.medico_voo_nome,     ex, ey, half, 9); ey += 10; }
      if (d.enfermeiro_voo_nome) { drawField('Enfermeiro(a)', d.enfermeiro_voo_nome, ex, ey, half, 9); }
    }

    y = yG + 22;
  }

  // ─── ASSINATURA ─────────────────────────────────────────────────────
  checkPage(32);
  y += 15;
  // Linha dourada
  sd(C.amber); doc.setLineWidth(0.7);
  ln(ML, y, ML + CW, y);
  y += 5;

  // Linha de assinatura do médico
  sd([120, 120, 120]); doc.setLineWidth(0.3);
  ln(ML, y + 14, ML + 58, y + 14);
  st([100, 100, 100]); ff('normal', 7);
  doc.text('Médico Regulador', ML + 29, y + 18, { align: 'center' });

  const mNome = perfilAtual.nome || '';
  const mReg  = (() => {
    const tipo = perfilAtual.registro_tipo || 'CRM';
    const uf   = perfilAtual.registro_uf   || 'PA';
    const num  = perfilAtual.crm           || '';
    return num ? tipo + '/' + uf + ' ' + num : '';
  })();
  st(C.amber); ff('bold', 7);
  doc.text(mNome + (mReg ? ' · ' + mReg : ''), ML + 29, y + 22, { align: 'center' });

  doc.setTextColor(180, 180, 180); ff('normal', 5.5);
  doc.text('Documento gerado eletronicamente', ML + CW, y + 14, { align: 'right' });
  st(C.amber); ff('bold', 6);
  doc.text((d.codigo || '') + ' · AltusMed v0.01b', ML + CW, y + 19, { align: 'right' });
  y += 26;

  // ─── RODAPÉ DO PDF ──────────────────────────────────────────────────
  const fY = 289;
  sf([245,245,245]); doc.rect(0, fY, PW, 9, 'F');
  sd([224,224,224]); doc.setLineWidth(0.3);
  ln(0, fY, PW, fY);
  doc.setTextColor(180, 180, 180); ff('normal', 5.5);
  doc.text('AltusMed Transporte Aeromédico · CNPJ 58.633.654/0001-32', ML, fY + 5.5);
  doc.text('ngmmedicos@gmail.com · (91) 9117-0682 · altusmed.med.br', ML + CW, fY + 5.5, { align: 'right' });

  doc.save('AltusMed-' + (d.codigo || 'regulacao') + '.pdf');
}

// ── Start ─────────────────────────────────────────────────────────────
init();