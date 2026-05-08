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
`perfis` (nome, cargo, cargo_tipo, crm, registro_tipo, registro_uf, registro_numero, cpf, data_nascimento, chave_pix, is_admin, deletado, deletado_em, deletado_por)
`missoes` (km_total, pernoites, valor_medico, valor_enfermeiro, pago_medico, pago_enfermeiro, medico_voo_id, medico_voo_nome, enfermeiro_voo_id, enfermeiro_voo_nome, deletado, deletado_em, deletado_por)
`regulacoes` | `trechos_missao` | `aeroportos_custom` | `config_financeiro`

### Colunas não-óbvias em `regulacoes`
`pa` TEXT "120/80" | `temp` (NÃO `temperatura`) | `dois` JSONB (DVAs) | `outras_drogas` JSONB
`gcs_pupilar` int(1=ambas OK, 2=uma não, 3=ambas não) | `gcs_pediatrico` bool
`o2_ativo` bool | `o2_flow` num | `o2_duracao` int | `pam` num
`medico_voo_id/nome` | `enfermeiro_voo_id/nome`

### Colunas em `trechos_missao`
`missao_id` UUID | `regulacao_id` UUID | `origem` TEXT | `destino` TEXT | `km` NUMERIC

### Colunas em `config_financeiro`
Configurações de valor por km/pernoite por cargo; usada em `calcularValores()`.

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

**Trechos de voo** — Haversine com `AEROPORTOS_COORDS` (49 aeroportos). `distanciaKm(lat1,lng1,lat2,lng2)`. Salva em `trechos_missao` com `missao_id` e `regulacao_id`. `km_total` gravado na `missoes`. Container com `max-height:220px; overflow-y:auto`.

**Registro profissional** — 3 colunas inline: Tipo (CRM/COREN) | UF | Número. Campos: `registro_tipo`, `registro_uf`, `registro_numero`. Exibido abaixo do nome na tabela de prestadores.

**Soft delete** — `deletado BOOLEAN`, `deletado_em TIMESTAMPTZ`, `deletado_por UUID`. Filtrar sempre com `.or('deletado.is.null,deletado.eq.false')`. Senha de confirmação: `'1234'` (modal `#modal-deletar`).

**Financeiro tab** — admin vê todos; médico/enfermeiro vê só as próprias missões via `.or('medico_voo_id.eq.X,enfermeiro_voo_id.eq.X,medico_id.eq.X')`. Sub-tabs: Resumo | Prestadores | Configurações. Widget "Meus Voos" para não-admin.

**exportarFechamentoPDF** — async, busca dados diretamente do Supabase (NÃO lê o DOM). Usa `mesAtual`/`anoAtual` globais. Status exato no filtro: `'Concluída'` (com acento). Agrupa por `medico_voo_id` e `enfermeiro_voo_id` em separado.

**Modal fechamento** — radio "Gerar e exportar PDF" / "Apenas gerar". `confirmarFechamento()` lê o radio, atualiza `mesAtual`/`anoAtual`, chama `carregarFinanceiro()`, exporta PDF se selecionado.

---

## Convenções
- Vanilla JS — sem frameworks
- CSS via custom properties: `--navy`, `--green`, `--amber`
- Seções colapsáveis: `toggleSection(id)` — usa classe `.hidden`, NÃO `style.display`
- Feedback: `toast(msg, erro=false)`
- Campos hidden para valores calculados: `tempo-total-hidden`, `o2-litros-hidden`, `pam-valor`, `km-total-hidden`
- PDF: `const { jsPDF } = window.jspdf` — evitar acentos/° no PDF (sem suporte nativo)
- Equipe responsiva: `.equipe-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem }` → 1 col em ≤600px

---

## Estado atual
✅ Tudo funcional: site PT/EN, auth, área restrita, missões, regulacao.html standalone, GCS/PAM/O2/DVAs/PDF.
✅ Trechos de voo com Haversine em restrito.html e regulacao.html.
✅ Aba Financeiro completa (Resumo, Prestadores, Configurações, Meus Voos).
✅ Registro CRM/COREN com UF — perfil e admin de usuários.
✅ Edição completa de usuários (CPF, nascimento, chave PIX, registro).
✅ Soft delete com senha em missões e usuários.
✅ Modal detalhes de missão no financeiro.
✅ Modal fechamento com opção PDF — exportarFechamentoPDF busca do Supabase.
✅ Filtro de deletados em todas as queries.
✅ km_total correto no dashboard e Meus Voos.

## Próximos passos
- [ ] Listagem + edição de regulações anteriores no painel
- [ ] Assinatura digital no PDF
- [ ] Notificações push/e-mail ao criar missão
- [ ] Dashboard de métricas (missões, NACA, rotas)
- [ ] App mobile (PWA ou nativo)
