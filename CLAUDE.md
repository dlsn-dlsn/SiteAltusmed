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
`origem_codigo` TEXT | `destino_codigo` TEXT | `distancia_km` NUMERIC | `ordem` INT

### Colunas em `config_financeiro`
Configurações de valor por km/pernoite por cargo; usada em `calcularValores()`.
Inclui `regulador_por_regulacao NUMERIC` — valor fixo por regulação realizada.

### Coluna adicionada em `regulacoes`
`pago BOOLEAN DEFAULT FALSE` — indica se o regulador foi pago pelo período.
⚠️ Rodar no Supabase antes de usar fechamento com reguladores:
```sql
ALTER TABLE regulacoes ADD COLUMN IF NOT EXISTS pago BOOLEAN DEFAULT FALSE;
```

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

**Prestadores — duas seções visuais** — tabela `#fin-tbody-prestadores` renderiza dois grupos com header colorido: (A) "Médicos e Enfermeiros Transportadores" (borda verde, fonte de missões); (B) "Reguladores" (borda âmbar, fonte de `regulacoes.medico_id`). Valor de regulador = count × `config_financeiro.regulador_por_regulacao`. Sub-tabela "Ver Regulações" mostra código + data de cada regulação. `pagarPeriodo('id','regulador',mes,ano)` marca `pago=true` em `regulacoes`; tipos `medico`/`enfermeiro` continuam marcando `missoes`.

**PDF regulacao.html — seção Logística** — primeiros elementos são dois cards lado a lado [ORIGEM][DESTINO]: fundo branco, label cinza 6.5px uppercase, valor navy 10px bold, altura 14mm. Fonte: `d.origem` / `d.destino` (lidos de `#origem`/`#destino` em `finalizarRegulacao()` e armazenados em `regulacaoSalva`). Se existirem trechos (`tr-orig-*`), exibe rota visual BEL→FOR→BSB abaixo dos cards. NÃO existe campo `log-origem` / `origem-input` — o input visível é `#origem`.

**exportarFechamentoPDF** — async, busca dados diretamente do Supabase (NÃO lê o DOM). Usa `mesAtual`/`anoAtual` globais. Status exato no filtro: `'Concluída'` (com acento). **Duas tabelas separadas no PDF**: (1) Transportadores — agrupa por `medico_voo_id`/`enfermeiro_voo_id`, colunas Prestador/Cargo/Miss./Km/Pern./Valor/Pendente; (2) Reguladores — agrupa por `medico_id` em `regulacoes`, colunas Regulador/Regulações/Valor Unit./Total/Pendente. Cada tabela tem subtotal próprio; Total Geral em bloco navy unificado. Busca `perfis` + `config_financeiro` + `regulacoes` em paralelo via `Promise.all`. `checkPage()` + `miniHeader()` para paginação automática.

**exportarPDFMissao(id)** — em `restrito.html`. Gera PDF de encerramento para missões Concluídas. Busca `missoes` + `trechos_missao` em paralelo, depois `regulacoes` e `perfis` da equipe. Seções: Rota Voada (cards por trecho), Dados do Paciente, Equipe de Voo, Assinaturas 2×2 (equipe preenchida + receptores em branco). Botão "📄 Exportar PDF" aparece no modal de detalhes somente se `status === 'Concluída'`. ID da missão armazenado em `window.modalMissaoId`.

**Modal fechamento** — radio "Gerar e exportar PDF" / "Apenas gerar". `confirmarFechamento()` lê o radio, atualiza `mesAtual`/`anoAtual`, chama `carregarFinanceiro()`, exporta PDF se selecionado.

**renderizarTabela — código clicável por status** — `m.status === 'Concluída'` → `abrirDetalhesMissao(id)`; `'Em andamento'` → `abrirEncerramento(id, codigo)`; outros → sem ação, cursor padrão.

**PDF regulacao.html — seção O2** — fieldRow 2 colunas [Dispositivo | Fluxo]. Parâmetros de VM (Modo, FiO2, PEEP, Vol, Freq, PS) só aparecem se dispositivo for VMI/VNI/CPAP. Sem linha de texto separada; só a barra verde de O2 abaixo dos cards.

**PDF regulacao.html — drogas** — classifica cada item de `duas` e `outras_drogas` contra `DVA_NOMES` (Norepinefrina, Epinefrina, Dopamina, Dobutamina, Vasopressina, Fenilefrina, Milrinona, Levosimendan, Prostaglandina, Terlipressina, Angiotensina). Seção "Drogas Vasoativas em Infusao" só se houver DVAs; "Outras Drogas em Infusao Continua" só se houver outras.

**PDF regulacao.html — monitor vitais** — painel lateral 34mm. Vitais: HR·ECG fs:20, SpO2 fs:20, Resp fs:18, P.Arterial fs:14, Temp fs:16. Vertical centering: `mid = yv + altV/2`; label em `mid-4`, valor em `mid+1`, unidade em `mid+5.5`. PAM exibido como número entre parênteses abaixo do valor de PA (sem texto "PAM mmHg").

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
✅ exportarPDF em regulacao.html — identidade visual completa (monitor, O2, DVAs, GCS, PAM, trechos, assinatura).
✅ exportarPDFMissao em restrito.html — encerramento com rota, paciente, equipe e assinaturas 2×2.
✅ exportarFechamentoPDF reformulado — tabela estilizada, COREN correto, cargo por cargo_tipo, valores pt-BR.
✅ Código da missão clicável por status (Concluída → detalhes, Em andamento → encerramento).
✅ Fechamento financeiro com reguladores separados de transportadores (2025-05-16).
✅ PDF de fechamento com duas tabelas (Transportadores + Reguladores) e Total Geral unificado (2025-05-16).
✅ Pagamento de reguladores via `pagarPeriodo(...,'regulador',...)` → atualiza `regulacoes.pago` (2025-05-16).
✅ PDF regulacao.html — origem e destino como cards destacados no início da seção Logística (2025-05-16).

## Próximos passos
- [ ] Rodar SQL no Supabase: `ALTER TABLE regulacoes ADD COLUMN IF NOT EXISTS pago BOOLEAN DEFAULT FALSE`
- [ ] Listagem + edição de regulações anteriores no painel
- [ ] Assinatura digital no PDF
- [ ] Notificações push/e-mail ao criar missão
- [ ] Dashboard de métricas (missões, NACA, rotas)
- [ ] App mobile (PWA ou nativo)
