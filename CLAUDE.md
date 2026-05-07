# AltusMed — Site + Sistema Interno

## Stack
HTML/CSS/JS vanilla | Supabase JS v2 | Vercel | jsPDF 2.5.1 (CDN) | DM Sans (Google Fonts)

## Arquivos
| Arquivo | Função |
|---|---|
| `index.html` | Site público PT |
| `AltusMedENG.html` | Site público EN |
| `restrito.html` | Painel interno autenticado |
| `regulacao.html` | Formulário de regulação (auth própria) |
| `regulacao-uti-aerea-v3.html` | ⚠️ Legado — não usar |
| `vercel.json` | Rotas Vercel |

## Supabase — Tabelas
`perfis` (nome, cargo, cargo_tipo, crm, is_admin) | `missoes` | `regulacoes` | `aeroportos_custom`

### Colunas não-óbvias em `regulacoes`
`pa` TEXT "120/80" | `temp` (NÃO `temperatura`) | `dois` JSONB (DVAs) | `outras_drogas` JSONB
`gcs_pupilar` int(1=ambas OK, 2=uma não, 3=ambas não) | `gcs_pediatrico` bool
`o2_ativo` bool | `o2_flow` num | `o2_duracao` int | `pam` num
`medico_voo_id/nome` | `enfermeiro_voo_id/nome`

---

## Decisões arquiteturais (não reabrir)

**regulacao.html** — auth própria Supabase. Não usar iframe. Nav via `window.location.href`.

**restrito.html** — hash navigation: detecta `#missoes` / `#regulacao` no load; limpa com `replaceState`.

**Saudação por cargo**
```js
if (tipo === 'medico' || tipo === 'diretor') return 'Dr. ';
if (tipo === 'enfermeiro') return 'ENF(a). ';
```
Label registro: `CRM` (médico/diretor) | `COREN` (enfermeiro) — dinâmico.

**GCS-P** = `GCS_total − desconto` (pupilar 1→0, 2→1, 3→2). Pediátrico auto ativa se `idade < 5`.

**PAM** = `(PAS + 2×PAD) / 3` — badge verde.

**O2** = `flow × tempo_total × 1.3` (30% margem). `tempo_total = tempo_voo + 60min`; se `> 210min` +60min extra.

**Autocomplete aeroportos** — busca substring (≤8); fallback Jaccard trigrama; score < 0.75 → botão salvar custom. Usar `onmousedown` + `setTimeout(150ms)` no blur (evita conflito click/blur).

**Infusão contínua** — linhas com `data-dva-id` / `data-droga-id`. Coletar via `querySelectorAll` filtrando `style.display !== 'none'`.

**Toggles altitude** — estado em `toggleState`. NÃO=âmbar, SIM=vermelho. Aviso vermelho se qualquer SIM.

**Fluxo/decisão** — 4 cards: `liberado` `reavaliacao` `misericordia` `negado`. Reavaliação exibe campo horas.

**Equipe de voo** — carregada do Supabase (`cargo_tipo IN ('medico','diretor','enfermeiro')`).

---

## Convenções
- Vanilla JS — sem frameworks
- CSS via custom properties: `--navy`, `--green`, `--amber`
- Seções colapsáveis: `toggleSection(id)`
- Feedback: `toast(msg, erro=false)`
- Campos hidden para valores calculados: `tempo-total-hidden`, `o2-litros-hidden`, `pam-valor`
- PDF: `const { jsPDF } = window.jspdf` — evitar acentos/° no PDF (sem suporte nativo)

---

## Estado atual
✅ Tudo funcional: site PT/EN, auth, área restrita, missões, regulacao.html standalone, GCS/PAM/O2/DVAs/PDF.

## Próximos passos
- [ ] Listagem + edição de regulações anteriores no painel
- [ ] Assinatura digital no PDF
- [ ] Notificações push/e-mail ao criar missão
- [ ] Dashboard de métricas (missões, NACA, rotas)
- [ ] App mobile (PWA ou nativo)
