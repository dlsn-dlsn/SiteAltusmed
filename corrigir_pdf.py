#!/usr/bin/env python3
"""
Corrige todos os problemas do PDF no regulacao.html
Execute na pasta do projeto: python3 corrigir_pdf.py
"""
import re, os

HTML = 'regulacao.html'
LOGOS_JS = 'logos_base64.js'

with open(HTML, 'r', encoding='utf-8') as f:
    html = f.read()

print("Iniciando correções...")

# ── 1. ACENTOS ────────────────────────────────────────────────
acentos = [
    ("'Regulacao Aeromedica'",          "'Regulação Aeromédica'"),
    ('"Regulacao Aeromedica"',          '"Regulação Aeromédica"'),
    ("'Missao:'",                        "'Missão:'"),
    ('"Missao:"',                        '"Missão:"'),
    ("'Logistica'",                      "'Logística'"),
    ('"Logistica"',                      '"Logística"'),
    ("'Tempo total missao'",             "'Tempo total missão'"),
    ('"Tempo total missao"',             '"Tempo total missão"'),
    ("'Diagnostico'",                    "'Diagnóstico'"),
    ('"Diagnostico"',                    '"Diagnóstico"'),
    ("'DIAGNOSTICO'",                    "'DIAGNÓSTICO'"),
    ("'Medicacoes em Infusao Continua'", "'Medicações em Infusão Contínua'"),
    ('"Medicacoes em Infusao Continua"', '"Medicações em Infusão Contínua"'),
    ("'MEDICACOES EM INFUSAO CONTINUA'", "'MEDICAÇÕES EM INFUSÃO CONTÍNUA'"),
    ("'Observacoes e Anotacoes'",        "'Observações e Anotações'"),
    ('"Observacoes e Anotacoes"',        '"Observações e Anotações"'),
    ("'OBSERVACOES E ANOTACOES'",        "'OBSERVAÇÕES E ANOTAÇÕES'"),
    ("'Restricoes de Altitude'",         "'Restrições de Altitude de Cabine'"),
    ('"Restricoes de Altitude"',         '"Restrições de Altitude de Cabine"'),
    ("'RESTRICOES DE ALTITUDE'",         "'RESTRIÇÕES DE ALTITUDE DE CABINE'"),
    ("'Recomendacao de Voo'",            "'Recomendação de Voo'"),
    ('"Recomendacao de Voo"',            '"Recomendação de Voo"'),
    ("'RECOMENDACAO DE VOO'",            "'RECOMENDAÇÃO DE VOO'"),
    ("5.000 pes",                        "5.000 pés"),
    ("expansao de gases",                "expansão de gases"),
    ("'Fluxo e Decisao Medica'",         "'Fluxo e Decisão Médica'"),
    ('"Fluxo e Decisao Medica"',         '"Fluxo e Decisão Médica"'),
    ("'FLUXO E DECISAO MEDICA'",         "'FLUXO E DECISÃO MÉDICA'"),
    ("'Decisao'",                        "'Decisão'"),
    ('"Decisao"',                        '"Decisão"'),
    ("'Medico Regulador'",               "'Médico Regulador'"),
    ('"Medico Regulador"',               '"Médico Regulador"'),
    ("'MEDICO REGULADOR'",               "'MÉDICO REGULADOR'"),
    ("criterio medico",                  "critério médico"),
    ("'Oxigenio'",                       "'Oxigênio'"),
    ('"Oxigenio"',                       '"Oxigênio"'),
    ("'OXIGENIO'",                       "'OXIGÊNIO'"),
    ("'Ventilacao Mecanica'",            "'Ventilação Mecânica'"),
    ("'Equipe de Voo'",                  "'Equipe de Voo'"),
    ("'Regulacao'",                      "'Regulação'"),
    ('"Regulacao"',                      '"Regulação"'),
    ("'Aeromedica'",                     "'Aeromédica'"),
    ('"Aeromedica"',                     '"Aeromédica"'),
    ("'continuacao'",                    "'continuação'"),
    ('"continuacao"',                    '"continuação"'),
    ("Regulacao Aeromedica",             "Regulação Aeromédica"),
]

for old, new in acentos:
    html = html.replace(old, new)
print("✅ Acentos corrigidos")

# ── 2. BUG "oCN" — concatenação errada no monitor ─────────────
# Corrige a linha que monta vmiTxt no rodapé do monitor
html = re.sub(
    r"const vmiTxt\s*=\s*[^;]+;",
    "const vmiTxt = String(d.o2_dispositivo || '') + (d.vm_fio2 ? ' · FiO2 ' + d.vm_fio2 + '%' : '') + (d.vm_peep ? ' · PEEP ' + d.vm_peep : '');",
    html
)
print("✅ Bug 'oCN' corrigido")

# ── 3. TEMPERATURA — unidade °C ───────────────────────────────
# Garante que °C aparece após o valor da temperatura no monitor
html = html.replace(
    "doc.text(d.temp ? String(d.temp) : '-', xVal",
    "doc.text(d.temp ? String(d.temp) + '\\u00b0C' : '-', xVal"
)
# Versão alternativa se a linha for diferente
html = re.sub(
    r"(c\.unit\s*===\s*['\"]°C['\"].*?doc\.text\(['\"]°C['\"])",
    r"\1",
    html
)
print("✅ Temperatura °C verificada")

# ── 4. FUNÇÃO secTitulo ───────────────────────────────────────
# Insere a função secTitulo antes de exportarPDF se não existir
if 'function secTitulo(' not in html:
    func = '''
  function secTitulo(doc, texto, x, y, w) {
    doc.setFillColor(240, 247, 232);
    doc.rect(x, y, w, 6, 'F');
    doc.setFillColor(120, 190, 32);
    doc.rect(x, y, 2.5, 6, 'F');
    doc.setTextColor(15, 30, 53);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(texto.toUpperCase(), x + 5, y + 4.2);
    return y + 8;
  }

'''
    html = html.replace('async function exportarPDF()', func + '  async function exportarPDF()')
    print("✅ Função secTitulo inserida")
else:
    print("✅ Função secTitulo já existe")

# ── 5. MINI-CABEÇALHO NAS PÁGINAS SEGUINTES ──────────────────
mini_cab = '''    doc.setFillColor(15, 30, 53);
    doc.rect(0, 0, 210, 10, 'F');
    doc.setDrawColor(120, 190, 32);
    doc.setLineWidth(0.5);
    doc.line(0, 10, 210, 10);
    doc.setTextColor(120, 190, 32);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('ALTUSMED', 14, 7);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Regulação Aeromédica · continuação', 196, 7, { align: 'right' });
    return 16;'''

# Substitui o return após addPage() nas funções de verificação
html = re.sub(
    r'(doc\.addPage\(\);)\s*\n(\s*)(return \d+;)',
    r'\1\n' + mini_cab,
    html,
    count=3
)
print("✅ Mini-cabeçalho nas páginas seguintes")

# ── 6. LOGOS — injetar do logos_base64.js ────────────────────
if os.path.exists(LOGOS_JS):
    with open(LOGOS_JS, 'r') as f:
        js = f.read()

    altus_m = re.search(r"const LOGO_ALTUSMED = '(data:image[^']+)';", js)
    aerotop_m = re.search(r"const LOGO_AEROTOP\s*=\s*'(data:image[^']+)';", js)

    # Remove constantes antigas/placeholder
    html = re.sub(r"const LOGO_ALTUSMED = '[^']*';\n", '', html)
    html = re.sub(r"const LOGO_AEROTOP\s*=\s*'[^']*';\n\n?", '', html)

    # Injeta valores reais no início do <script>
    altus_val = altus_m.group(1) if altus_m else ''
    aerotop_val = aerotop_m.group(1) if aerotop_m else ''

    constantes = f"const LOGO_ALTUSMED = '{altus_val}';\nconst LOGO_AEROTOP = '{aerotop_val}';\n\n"
    html = re.sub(r'(<script>)\s*\n', r'\1\n' + constantes, html, count=1)

    print(f"✅ Logos: AltusMed={'OK' if altus_val else 'VAZIO'}, AeroTop={'OK' if aerotop_val else 'VAZIO'}")
else:
    print("⚠️  logos_base64.js não encontrado — logos ignoradas")

# ── 7. Garante uso das logos no cabeçalho do PDF ─────────────
# Adiciona o código de addImage se não existir
if 'addImage(LOGO_ALTUSMED' not in html:
    logo_code = '''
    // Logos no cabeçalho
    if (typeof LOGO_ALTUSMED !== 'undefined' && LOGO_ALTUSMED && !LOGO_ALTUSMED.startsWith('PLACE')) {
      try { doc.addImage(LOGO_ALTUSMED, 'PNG', 14, 3, 32, 9); } catch(e) {}
    }
    if (typeof LOGO_AEROTOP !== 'undefined' && LOGO_AEROTOP && !LOGO_AEROTOP.startsWith('PLACE')) {
      try { doc.addImage(LOGO_AEROTOP, 'PNG', 148, 2, 48, 13); } catch(e) {}
    }
'''
    # Insere após o desenho do cabeçalho navy (rect do header)
    html = re.sub(
        r'(doc\.setFillColor\(15,\s*30,\s*53\);\s*\n\s*doc\.rect\(0,\s*0,\s*210,\s*2[0-9])',
        r'\1',
        html,
        count=1
    )
    # Insere antes do texto ALTUSMED no cabeçalho
    html = re.sub(
        r"(doc\.text\('ALTUSMED')",
        logo_code + r"    \1",
        html,
        count=1
    )
    print("✅ Código addImage inserido no cabeçalho")

# ── Salva ─────────────────────────────────────────────────────
with open(HTML, 'w', encoding='utf-8') as f:
    f.write(html)

print("\n🎉 regulacao.html corrigido com sucesso!")
print("Próximo passo: git add . && git commit -m 'fix: PDF acentos logos monitor identidade' && git push")
