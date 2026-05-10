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
function desenharMonitor(doc, yInicio, d) {
  const x = 14;
  const w = 182;
  const alturaTotal = 95;

  // Fundo do monitor
  doc.setFillColor(10, 14, 20);
  doc.roundedRect(x, yInicio, w, alturaTotal, 3, 3, 'F');

  // Header do monitor
  doc.setFillColor(15, 30, 53);
  doc.rect(x, yInicio, w, 10, 'F');
  doc.setTextColor(120, 190, 32);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('ALTUSMED MONITOR', x + 3, yInicio + 6.5);

  // Paciente info no header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  const nomePac = (d.paciente_nome || '').substring(0, 25);
  const infoPac = (d.aeronave || '') + ' . ' + (d.origem || '') + '->' + (d.destino || '');
  doc.text(nomePac, x + w - 3, yInicio + 5, { align: 'right' });
  doc.text(infoPac.substring(0, 35), x + w - 3, yInicio + 9, { align: 'right' });

  // Linha separadora verde
  doc.setDrawColor(120, 190, 32);
  doc.setLineWidth(0.3);
  doc.line(x, yInicio + 10, x + w, yInicio + 10);

  // Curvas sinteticas
  const wCurvas = w - 32;
  const xCurvas = x + 2;
  const cores = {
    ecg:  [0, 255, 136],
    spo2: [0, 204, 255],
    resp: [255, 204, 0],
    pa:   [255, 102, 102],
  };

  function curvaECG(yBase) {
    doc.setDrawColor(...cores.ecg);
    doc.setLineWidth(0.4);
    const s = wCurvas / 4;
    doc.line(xCurvas, yBase, xCurvas + s * 0.6, yBase);
    doc.line(xCurvas + s * 0.6, yBase, xCurvas + s * 0.7, yBase - 4);
    doc.line(xCurvas + s * 0.7, yBase - 4, xCurvas + s * 0.75, yBase + 3);
    doc.line(xCurvas + s * 0.75, yBase + 3, xCurvas + s * 0.8, yBase);
    doc.line(xCurvas + s * 0.8, yBase, xCurvas + s * 1.6, yBase);
    doc.line(xCurvas + s * 1.6, yBase, xCurvas + s * 1.7, yBase - 4);
    doc.line(xCurvas + s * 1.7, yBase - 4, xCurvas + s * 1.75, yBase + 3);
    doc.line(xCurvas + s * 1.75, yBase + 3, xCurvas + s * 1.8, yBase);
    doc.line(xCurvas + s * 1.8, yBase, xCurvas + s * 2.6, yBase);
    doc.line(xCurvas + s * 2.6, yBase, xCurvas + s * 2.7, yBase - 4);
    doc.line(xCurvas + s * 2.7, yBase - 4, xCurvas + s * 2.75, yBase + 3);
    doc.line(xCurvas + s * 2.75, yBase + 3, xCurvas + s * 2.8, yBase);
    doc.line(xCurvas + s * 2.8, yBase, xCurvas + wCurvas, yBase);
  }

  function curvaSeno(yBase, amplitude, cor, freq) {
    doc.setDrawColor(...cor);
    doc.setLineWidth(0.4);
    const steps = 80;
    let prevX = xCurvas, prevY = yBase;
    for (let i = 1; i <= steps; i++) {
      const xp = xCurvas + (i / steps) * wCurvas;
      const yp = yBase - Math.sin((i / steps) * Math.PI * 2 * freq) * amplitude;
      doc.line(prevX, prevY, xp, yp);
      prevX = xp; prevY = yp;
    }
  }

  function curvaPA(yBase) {
    doc.setDrawColor(...cores.pa);
    doc.setLineWidth(0.4);
    const s = wCurvas / 5;
    for (let i = 0; i < 5; i++) {
      const ox = xCurvas + i * s;
      doc.line(ox, yBase, ox + s * 0.2, yBase);
      doc.line(ox + s * 0.2, yBase, ox + s * 0.3, yBase - 4);
      doc.line(ox + s * 0.3, yBase - 4, ox + s * 0.4, yBase - 1);
      doc.line(ox + s * 0.4, yBase - 1, ox + s * 0.5, yBase + 1.5);
      doc.line(ox + s * 0.5, yBase + 1.5, ox + s, yBase);
    }
  }

  const linhas = [
    { label: 'ECG . II',     cor: cores.ecg,  y: yInicio + 16 },
    { label: 'SpO2 . Pleth', cor: cores.spo2, y: yInicio + 23 },
    { label: 'Resp',         cor: cores.resp, y: yInicio + 30 },
    { label: 'PA invasiva',  cor: cores.pa,   y: yInicio + 37 },
  ];

  linhas.forEach((l, idx) => {
    doc.setTextColor(...l.cor.map(c => Math.min(c, 200)));
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(l.label, xCurvas, l.y - 2);
    if (idx < linhas.length - 1) {
      doc.setDrawColor(17, 26, 36);
      doc.setLineWidth(0.2);
      doc.line(xCurvas, l.y + 3, xCurvas + wCurvas, l.y + 3);
    }
  });

  curvaECG(linhas[0].y + 1);
  curvaSeno(linhas[1].y + 1, 2.5, cores.spo2, 3);
  curvaSeno(linhas[2].y + 1, 1.8, cores.resp, 1.5);
  curvaPA(linhas[3].y + 1);

  // Glasgow
  const yGCS = yInicio + 43;
  const gcsTotal = d.gcs_total || (
    (parseInt(d.gcs_o) || 0) +
    (parseInt(d.gcs_v) || 0) +
    (parseInt(d.gcs_m) || 0)
  );

  doc.setTextColor(180, 120, 255);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('GLASGOW', xCurvas, yGCS + 1);

  doc.setFontSize(14);
  doc.setTextColor(200, 136, 255);
  doc.text(String(gcsTotal || '-'), xCurvas + 18, yGCS + 6);

  doc.setDrawColor(150, 100, 220);
  doc.setLineWidth(0.3);
  doc.line(xCurvas + 27, yGCS - 1, xCurvas + 27, yGCS + 8);

  const comps = [
    { label: 'AO', val: d.gcs_o || '-' },
    { label: 'RV', val: d.gcs_v || '-' },
    { label: 'RM', val: d.gcs_m || '-' },
  ];
  comps.forEach((c, i) => {
    const xc = xCurvas + 31 + i * 18;
    doc.setFillColor(50, 30, 70);
    doc.roundedRect(xc, yGCS - 1, 16, 10, 1, 1, 'F');
    doc.setTextColor(170, 110, 230);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text(c.label, xc + 8, yGCS + 3, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(200, 136, 255);
    doc.text(String(c.val), xc + 8, yGCS + 8, { align: 'center' });
  });

  if (d.gcs_pupilar && d.gcs_pupilar !== 'ignorada') {
    const desconto = d.gcs_pupilar === '2' ? 1 : d.gcs_pupilar === '3' ? 2 : 0;
    const gcsp = (gcsTotal || 0) - desconto;
    const xp = xCurvas + 31 + 3 * 18 + 4;
    doc.setDrawColor(150, 100, 220);
    doc.setLineWidth(0.3);
    doc.line(xp - 2, yGCS - 1, xp - 2, yGCS + 9);
    doc.setFillColor(40, 25, 60);
    doc.roundedRect(xp, yGCS - 1, 18, 10, 1, 1, 'F');
    doc.setTextColor(160, 100, 210);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('GCS-P', xp + 9, yGCS + 3, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(180, 120, 240);
    doc.text(String(gcsp), xp + 9, yGCS + 8, { align: 'center' });
  }

  // Painel lateral de valores
  const xVal = x + wCurvas + 4;
  const largVal = w - wCurvas - 5;

  const vitais = [
    { label: 'HR.ECG', val: d.fc   ? String(d.fc)   : '-', unit: 'bpm', cor: [0, 220, 100] },
    { label: 'SpO2',   val: d.spo2 ? String(d.spo2) : '-', unit: '%',   cor: [0, 180, 230] },
    { label: 'Resp',   val: d.fr   ? String(d.fr)   : '-', unit: 'rpm', cor: [220, 180, 0] },
    { label: 'PA',
      val: (d.pa || (d.pa_sistolica && d.pa_diastolica ? d.pa_sistolica + '/' + d.pa_diastolica : '-')),
      unit: d.pam ? '(' + Math.round(d.pam) + ')' : '',
      cor: [230, 80, 80], grande: true },
    { label: 'Temp',   val: d.temp ? String(d.temp) : '-', unit: '°C',  cor: [230, 140, 50] },
  ];

  let yv = yInicio + 11;
  const altV = 83 / vitais.length;

  vitais.forEach(v => {
    const rgb = v.cor;
    doc.setFillColor(
      Math.floor(rgb[0] * 0.08 + 8),
      Math.floor(rgb[1] * 0.08 + 8),
      Math.floor(rgb[2] * 0.08 + 14)
    );
    doc.rect(xVal, yv, largVal, altV - 0.5, 'F');

    doc.setTextColor(...rgb.map(c => Math.min(Math.floor(c * 0.7), 255)));
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(v.label, xVal + 1, yv + 3);

    doc.setTextColor(...rgb);
    doc.setFontSize(v.grande ? 7.5 : 9);
    doc.setFont('helvetica', 'bold');
    doc.text(String(v.val).substring(0, 7), xVal + largVal / 2, yv + altV - 3.5, { align: 'center' });

    if (v.unit) {
      doc.setFontSize(5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...rgb.map(c => Math.floor(c * 0.6)));
      doc.text(v.unit, xVal + largVal / 2, yv + altV - 0.5, { align: 'center' });
    }

    yv += altV;
  });

  // Rodape do monitor
  const yBot = yInicio + alturaTotal - 6;
  doc.setFillColor(6, 10, 15);
  doc.rect(x, yBot, w, 6, 'F');

  if (d.recomendacao_altitude) {
    doc.setFillColor(180, 0, 0);
    doc.circle(x + 4, yBot + 3, 1.5, 'F');
    doc.setTextColor(255, 100, 100);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('ALTITUDE CABINE REDUZIDA', x + 7, yBot + 4);
  }

  if (d.o2_dispositivo && ['VMI', 'VNI', 'CPAP'].includes(d.o2_dispositivo)) {
    doc.setTextColor(230, 140, 50);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    const vmiTxt = String(d.o2_dispositivo || '') + (d.vm_fio2 ? ' · FiO2 ' + d.vm_fio2 + '%' : '') + (d.vm_peep ? ' · PEEP ' + d.vm_peep : '');
    doc.text(vmiTxt, x + w / 2, yBot + 4, { align: 'center' });
  }

  if (d.naca) {
    doc.setFillColor(180, 0, 0);
    doc.roundedRect(x + w - 20, yBot + 1, 18, 4, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(d.naca, x + w - 11, yBot + 4, { align: 'center' });
  }

  return yInicio + alturaTotal + 4;
}

function exportarPDF() {
  if (!regulacaoSalva) { toast('Salve a regulação antes de exportar.', true); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const d   = regulacaoSalva;
  const ml  = 20, pw = 210, cw = pw - ml * 2;
  let y     = 20;
  const now = new Date().toLocaleString('pt-BR');

  function checkPage() {
    if (y > 270) { doc.addPage(); y = 20; }
  }

  function secHeader(titulo) { y = secTitulo(doc, titulo, ml, y, pw - ml*2); }
  function secHeader_old(title) {
    checkPage(); y += 3;
    doc.setFillColor(26, 46, 74);
    doc.rect(ml, y, cw, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title, ml + 3, y + 5);
    y += 10;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.setTextColor(25, 25, 25);
  }

  function row(label, value) {
    if (value === null || value === undefined || value === '') return;
    checkPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
    doc.text(label, ml, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
    doc.text(String(value), ml + 52, y);
    y += 6;
  }

  function multiRow(label, text) {
    if (!text) return;
    checkPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
    doc.text(label, ml, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
    doc.splitTextToSize(text, cw - 4).forEach(l => { checkPage(); doc.text(l, ml + 2, y); y += 5; });
    y += 2;
  }

  // Cabeçalho
  doc.setFillColor(15, 30, 53); doc.rect(0, 0, pw, 28, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(120, 190, 32);
    doc.text('ALTUSMED', ml, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(180, 200, 220);
  doc.text('Regulação Aeromédica', ml, 21);
  doc.setFontSize(8); doc.setTextColor(120, 140, 160);
  doc.text('Gerado em: ' + now, pw - ml, 21, { align: 'right' });
  y = 36;

  // Código
  doc.setFillColor(235, 243, 255); doc.setDrawColor(26, 46, 74);
  doc.roundedRect(ml, y, cw, 10, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(26, 46, 74);
  doc.text('Missão: ' + d.codigo, pw / 2, y + 7, { align: 'center' });
  y += 16;

  // Logística
  secHeader('LOGÍSTICA');
  row('Origem', d.origem);
  if (d.hospital_origem && d.hospital_origem !== 'Ignorado') row('Hospital Origem', d.hospital_origem);
  if (d.leito_origem    && d.leito_origem    !== 'Ignorado') row('Leito Origem',    d.leito_origem);
  row('Destino', d.destino);
  if (d.hospital_destino && d.hospital_destino !== 'Ignorado') row('Hospital Destino', d.hospital_destino);
  if (d.leito_destino    && d.leito_destino    !== 'Ignorado') row('Leito Destino',    d.leito_destino);
  row('Aeronave', d.aeronave);
  if (d.tempo_voo_horas || d.tempo_voo_minutos)
    row('Tempo de voo', (d.tempo_voo_horas || 0) + 'h ' + (d.tempo_voo_minutos || 0) + 'min');
  if (d.tempo_total_missao) {
    const ht = Math.floor(d.tempo_total_missao / 60), mt = d.tempo_total_missao % 60;
    const nota = (d.tempo_voo_horas * 60 + d.tempo_voo_minutos) > 210 ? ' (incl. reabastecimento)' : '';
    row('Tempo total missão', ht + 'h ' + mt + 'min' + nota);
  }

  // Paciente
  secHeader('PACIENTE');
  row('Nome', d.paciente_nome);
  (() => {
    if (d.paciente_idade == null) return;
    let s = d.paciente_idade + ' anos';
    if (d.paciente_idade === 0 && d.paciente_idade_meses != null) {
      s = d.paciente_idade_meses + ' meses';
      if (d.paciente_idade_meses === 0 && d.paciente_idade_dias != null)
        s = d.paciente_idade_dias + ' dias';
    }
    row('Idade', s);
  })();
  if (d.paciente_peso) row('Peso', d.paciente_peso + ' kg');
  row('Sexo', d.paciente_sexo);
  row('NACA', d.naca);
  multiRow('Diagnóstico', d.diagnostico);

  // Sinais Vitais — monitor multiparametrico visual
  checkPage();
  y += 3;
  y = desenharMonitor(doc, y, d);

  // O2
  if (d.o2_ativo) {
    secHeader('OXIGÊNIO');
    row('Dispositivo', d.o2_dispositivo);
    row('Flow', d.o2_flow ? d.o2_flow + ' L/min' : null);
    if (d.o2_litros_necessarios)
      row('O2 necessario', d.o2_litros_necessarios + ' L (E=' + d.o2_cilindros_necessarios + ' cil.)');
    if (d.vm_modo)   row('Modo VM',         d.vm_modo);
    if (d.vm_fio2)   row('FiO2',            d.vm_fio2 + ' %');
    if (d.vm_peep)   row('PEEP',            d.vm_peep + ' cmH2O');
    if (d.vm_volume) row('Vol. corrente',   d.vm_volume + ' ml');
    if (d.vm_freq)   row('Freq. prog.',     d.vm_freq + ' rpm');
    if (d.vm_ps)     row('Pressao suporte', d.vm_ps + ' cmH2O');
    if (d.vm_ti)     row('Tempo insp.',     d.vm_ti + ' s');
    if (d.vm_fluxo)  row('Fluxo',          d.vm_fluxo + ' L/min');
    if (d.vm_obs)    row('Obs. VM',         d.vm_obs);
  }

  // Infusão Contínua
  const dvaList   = d.duas         ? JSON.parse(d.duas)         : [];
  const drogaList = d.outras_drogas ? JSON.parse(d.outras_drogas) : [];
  if (d.infusao_continua && (dvaList.length || drogaList.length)) {
    secHeader('MEDICAÇÕES EM INFUSÃO CONTÍNUA');
    if (dvaList.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
      doc.text('DVA:', ml, y); y += 5;
      dvaList.forEach(item => row('  ' + item.droga, (item.valor || '—') + ' ' + (item.unidade || '')));
    }
    if (drogaList.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
      doc.text('Outras drogas:', ml, y); y += 5;
      drogaList.forEach(item => row('  ' + item.droga, (item.valor || '—') + ' ' + (item.unidade || '')));
    }
  }

  // Observações
  if (d.observacoes) {
    secHeader('OBSERVAÇÕES E ANOTAÇÕES');
    multiRow('', d.observacoes);
  }

  // Restrições de altitude
  const restricoes = [];
  if (d.cirurgia_recente)         restricoes.push('Cirurgia recente < 7 dias');
  if (d.pneumo_nao_drenado)       restricoes.push('Pneumotorax / Pneumoencefalo / Pneumoperitonio nao drenado');
  if (d.obstrucao_intestinal)     restricoes.push('Obstrucao intestinal');
  if (d.outra_restricao_altitude) restricoes.push('Outra: ' + (d.outra_restricao_obs || 'ver observacoes'));

  if (d.recomendacao_altitude) {
    secHeader('RESTRIÇÕES DE ALTITUDE DE CABINE');
    restricoes.forEach(r => {
      checkPage();
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
      doc.text('  * ' + r, ml, y); y += 6;
    });

    checkPage(); y += 2;
    doc.setFillColor(253, 220, 220);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.6);
    doc.roundedRect(ml, y, cw, 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(180, 20, 20);
    doc.text('! RECOMENDACAO DE VOO COM ALTITUDE DE CABINE REDUZIDA', ml + 4, y + 5.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(160, 40, 40);
    doc.text('Altitude de cabine < 5.000 pés ou a critério médico — expansão de gases', ml + 4, y + 10.5);
    doc.setLineWidth(0.2);
    y += 18;
  }

  // Fluxo
  if (d.fluxo) {
    secHeader('FLUXO E DECISÃO MÉDICA');
    const fluxoLabels = {
      liberado:     'Liberado para Voo',
      reavaliacao:  'Reavaliacao',
      misericordia: 'Voo de Misericordia (Salvaguardar a Vida Humana)',
      negado:       'Voo Negado'
    };
    row('Decisão', fluxoLabels[d.fluxo] || d.fluxo);
    if (d.fluxo === 'reavaliacao' && d.fluxo_reavaliacao_horas)
      row('Reavaliar em', d.fluxo_reavaliacao_horas + ' horas');
  }

  // Equipe de voo
  if (d.medico_voo_nome || d.enfermeiro_voo_nome) {
    secHeader('EQUIPE DE VOO');
    if (d.medico_voo_nome)    row('Médico',         d.medico_voo_nome);
    if (d.enfermeiro_voo_nome) row('Enfermeiro(a)', d.enfermeiro_voo_nome);
  }

  // Rodapé
  const footY = Math.max(y + 15, 262);
  doc.setDrawColor(180, 180, 180); doc.line(ml, footY, pw - ml, footY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(60, 60, 60);
  const medicoNome = perfilAtual.nome || usuarioAtual?.email || '';
  const crm = perfilAtual.crm ? '  |  CRM-PA ' + perfilAtual.crm : '';
  doc.text('Médico Regulador: ' + medicoNome + crm, ml, footY + 5);
  doc.setDrawColor(100, 100, 100); doc.line(ml, footY + 14, ml + 72, footY + 14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 100, 100);
  doc.text('Assinatura do Médico Regulador', ml, footY + 18);

  doc.save('AltusMed-' + d.codigo + '.pdf');
}

// ── Start ─────────────────────────────────────────────────────────────
init();