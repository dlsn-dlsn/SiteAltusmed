# AltusMed — Guia para Claude Code

## Visão geral do projeto

Site institucional + sistema interno para a empresa de transporte aeromédico **AltusMed**, sediada em Belém/PA.

- **Stack**: HTML/CSS/JS puro (vanilla). Sem framework JS.
- **Backend**: Supabase JS v2 (auth + banco de dados PostgreSQL).
- **Hospedagem**: Vercel (`vercel.json` configurado).
- **PDF**: jsPDF 2.5.1 via CDN (`window.jspdf.jsPDF`).
- **Fontes**: DM Sans via Google Fonts.

---

## Arquivos principais

| Arquivo | Função |
|---|---|
| `index.html` | Site público institucional (PT) |
| `AltusMedENG.html` | Versão EN do site público |
| `restrito.html` | Área interna autenticada (painel principal) |
| `regulacao.html` | Formulário standalone de regulação aeromédica |
| `regulacao-uti-aerea-v3.html` | Versão legada (não usar) |
| `vercel.json` | Configuração de rotas Vercel |

---

## Supabase

```js
const SUPA_URL = 'https://hdovkmuwofvwpcyfkiih.supabase.co';
const SUPA_KEY = 'sb_publishable_GetcnIgIEe6owbOQea2HOg_0MuxtLdP';
```

### Tabelas relevantes

| Tabela | Uso |
|---|---|
| `perfis` | Dados dos usuários (nome, cargo, cargo_tipo, crm, is_admin) |
| `missoes` | Missões de transporte criadas |
| `regulacoes` | Fichas de regulação aeromédica |
| `aeroportos_custom` | Aeroportos adicionados manualmente pelos usuários |

### Colunas confirmadas em `regulacoes`

- `pa` — texto (`"120/80"`)
- `o2_ativo` — boolean
- `o2_flow` — numérico
- `o2_duracao` — integer
- `temp` — numérico (NÃO `temperatura`)
- `gcs_total` — integer
- `gcs_pupilar` — integer (1=ambas reativas, 2=uma não reativa, 3=ambas não reativas)
- `gcs_pediatrico` — boolean
- `pam` — numérico
- `dois` (DVAs) — JSONB (JSON.stringify de array)
- `outras_drogas` — JSONB
- `observacoes`, `cirurgia_recente`, `pneumo_nao_drenado`, `obstrucao_intestinal`
- `outra_restricao_altitude`, `outra_restricao_obs`, `recomendacao_altitude`
- `fluxo`, `fluxo_reavaliacao_horas`
- `medico_voo_id`, `medico_voo_nome`, `enfermeiro_voo_id`, `enfermeiro_voo_nome`

---

## Decisões de arquitetura

### regulacao.html — standalone com própria autenticação
`regulacao.html` tem seu próprio fluxo de auth Supabase e redireciona para `restrito.html` se não autenticado. **Não usar iframe** — conflito de autenticação. Navegação feita por `window.location.href = 'regulacao.html'`.

### Hash-based navigation em restrito.html
`restrito.html` detecta `#missoes` e `#regulacao` na URL ao carregar para abrir a aba correta automaticamente. O hash é limpo após leitura com `window.history.replaceState`.

### Saudação por cargo
```js
function saudacaoCargo(tipo) {
  if (tipo === 'medico' || tipo === 'diretor') return 'Dr. ';
  if (tipo === 'enfermeiro') return 'ENF(a). ';
  return '';
}
```

### CRM vs COREN
O label do campo de registro no perfil muda dinamicamente: `CRM` para médico/diretor, `COREN` para enfermeiro.

### GCS-P (Glasgow Pupilar Score) — cálculo correto
```
pupilar=1 (ambas reativas)   → desconto = 0
pupilar=2 (uma não reativa)  → desconto = 1
pupilar=3 (ambas não reativas) → desconto = 2
GCS-P = GCS_total − desconto
```
Pupilar ignorada → GCS-P não exibido.

### GCS pediátrico
Ativa automaticamente quando `paciente_idade < 5` anos. Substitui opções de Verbal e Motor. Badge âmbar exibido.

### PAM
`PAM = (PAS + 2 × PAD) / 3` — exibida como badge verde abaixo dos campos de PA.

### Cálculo de O2
`litros = flow_Lmin × tempo_total_missao_min × 1.3` (30% de margem de segurança).
Mostra equivalência em cilindros C / D / E / H.

### Tempo total de missão
`tempo_total = tempo_voo + 60 min`. Se `tempo_voo > 210 min`, adiciona mais 60 min (parada para reabastecimento).

### Autocomplete de aeroportos
Busca por substring primeiro (≤ 8 resultados). Se nenhum encontrado, calcula similaridade Jaccard trigrama; se melhor score < 0.75, exibe botão para salvar o aeroporto como custom em `aeroportos_custom`.
Usa `onmousedown` + `setTimeout(150ms)` no blur para evitar conflito click/blur no dropdown.

### Infusão contínua — coleta dinâmica
Linhas de DVA/drogas criadas dinamicamente com `data-dva-id` / `data-droga-id`. Coleta via `querySelectorAll` filtrando `style.display !== 'none'` (linhas removidas ficam hidden, não deletadas).

### Toggles de altitude de cabine
Estado em `const toggleState = { cirurgia, pneumo, obstrucao, 'outra-restricao' }`.
NÃO é o estado padrão (botão NÃO ativo em âmbar). SIM fica vermelho.
Aviso vermelho aparece se qualquer toggle for SIM.

### Fluxo e decisão médica
4 opções como cards clicáveis: `liberado`, `reavaliacao`, `misericordia`, `negado`.
Se `reavaliacao`, exibe campo de horas.

### Equipe de voo
Carregada do Supabase (`cargo_tipo IN ('medico','diretor','enfermeiro')`) ao iniciar a página. Dois selects independentes (médico e enfermeiro).

---

## Tasks concluídas ✅

- [x] Site público PT + EN
- [x] Área restrita com autenticação Supabase
- [x] Identidade visual / brand identity HTML
- [x] Modal de solicitação de acesso integrado ao Supabase
- [x] Perfis de usuário com cargo, CRM/COREN, is_admin
- [x] Aba Missões com tabela, status, filtros
- [x] Modal de encerramento de missão (hora pouso, transferência, desfecho) com dark theme
- [x] Navegação por hash (#missoes, #regulacao)
- [x] Botão "Nova Regulação" na aba de Missões
- [x] Regulação standalone (regulacao.html) com auth própria
- [x] Saudação por cargo (Dr. / ENF(a).)
- [x] Label CRM/COREN dinâmico por tipo de cargo
- [x] Autocomplete de aeroportos com Jaccard trigrama + aeroportos custom
- [x] Hospital/leito de origem e destino
- [x] Tempo de voo em horas/min + cálculo de tempo total de missão
- [x] Idade pediátrica (anos/meses/dias)
- [x] Campo peso do paciente
- [x] PAM automática com badge verde
- [x] Remoção de spinners em inputs number
- [x] FC / FR / Temperatura em grid 3 colunas
- [x] GCS pediátrico automático (< 5 anos)
- [x] GCS-P (Glasgow Pupilar) com cálculo correto de desconto
- [x] Seção O2 com dispositivos (CN, MNR, Venturi, OAF, TOT, TQT, CPAP, VMI, VNI)
- [x] Parâmetros ventilatórios (CPAP fields e VMI/VNI fields)
- [x] Cálculo de O2 necessário (litros + cilindros)
- [x] Infusão contínua — DVAs + outras drogas com linhas dinâmicas
- [x] Grupo "Aporte Calórico / Hidratação" nas drogas (NPT, Albumina, soluções)
- [x] Observações e anotações (textarea dark green)
- [x] Restrições de altitude de cabine com 4 toggles SIM/NÃO + aviso vermelho
- [x] Seção Fluxo e Decisão Médica (4 cards: liberado, reavaliação, misericórdia, negado)
- [x] Equipe de Voo (médico + enfermeiro designados, carregados do Supabase)
- [x] finalizarRegulacao() salva tudo no Supabase (regulacoes + missoes)
- [x] Exportar PDF via jsPDF com todas as seções

---

## Tasks pendentes / ideias futuras

- [ ] Listagem de regulações anteriores dentro do painel
- [ ] Edição de regulação já salva
- [ ] Assinatura digital no PDF
- [ ] Notificações push / e-mail para a equipe ao criar missão
- [ ] Dashboard com métricas (missões por período, NACA, rotas)
- [ ] App mobile (PWA ou nativo)

---

## Convenções de código

- Sem frameworks — vanilla JS puro.
- CSS via custom properties (`:root { --navy, --green, --amber, ... }`).
- Seções colapsáveis com `toggleSection(id)`.
- Toasts via `toast(msg, erro=false)`.
- Campos `hidden` para valores calculados: `tempo-total-hidden`, `o2-litros-hidden`, `o2-cilindros-hidden`, `pam-valor`.
- PDF: usar jsPDF UMD — `const { jsPDF } = window.jspdf`. Evitar caracteres especiais (acentos, °, ←) no PDF pois jsPDF padrão não suporta — usar versão ASCII equivalente.
