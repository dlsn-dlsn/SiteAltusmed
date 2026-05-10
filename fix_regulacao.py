#!/usr/bin/env python3
"""
Fix completo do regulacao.html
Execute: python3 fix_regulacao.py
"""
import re, subprocess, sys

with open('regulacao.html', 'r', encoding='utf-8') as f:
    html = f.read()

fixes = 0

def fix(old, new, desc=''):
    global html, fixes
    if old in html:
        html = html.replace(old, new)
        fixes += 1
        print(f"  ✅ {desc or old[:50]}")
    
# ── ACENTOS ──────────────────────────────────────────────────
print("\n── Acentos ──")
fix("'Missao:'",                  "'Missão:'",           "Missão")
fix('"Missao:"',                  '"Missão:"',           "Missão")
fix("+ 'Missao: '",               "+ 'Missão: '",        "Missão label")
fix("'Missao: '",                 "'Missão: '",          "Missão label2")
fix("'LOGISTICA'",                "'LOGÍSTICA'",         "LOGÍSTICA")
fix('"LOGISTICA"',                '"LOGÍSTICA"',         "LOGÍSTICA2")
fix("'RECOMENDACAO DE VOO",       "'RECOMENDAÇÃO DE VOO","RECOMENDAÇÃO")
fix('"RECOMENDACAO DE VOO',       '"RECOMENDAÇÃO DE VOO',"RECOMENDAÇÃO2")
fix("Recomendacao de Voo",        "Recomendação de Voo", "Recomendação3")
fix("'Medico Regulador:",         "'Médico Regulador:",  "Médico Regulador")
fix('"Medico Regulador:',         '"Médico Regulador:',  "Médico Regulador2")
fix("'Medico'",                   "'Médico'",            "Médico")
fix('"Medico"',                   '"Médico"',            "Médico2")
fix("'Assinatura do Medico",      "'Assinatura do Médico","Assinatura Médico")
fix('"Assinatura do Medico',      '"Assinatura do Médico',"Assinatura Médico2")
fix("Medico Regulador:",          "Médico Regulador:",   "Médico Regulador texto")
fix("'criterio medico'",          "'critério médico'",   "critério médico")
fix('"criterio medico"',          '"critério médico"',   "critério médico2")

# Temperatura
grau = '\u00b0'
html = html.replace("doc.text('oC'", "doc.text('" + grau + "C'")
html = html.replace('doc.text("oC"', 'doc.text("' + grau + 'C"')
html = html.replace("'oC'", "'" + grau + "C'")
print("  ✅ Temperatura °C")

# ── MONITOR ──────────────────────────────────────────────────
print("\n── Monitor ──")
old_altura = re.search(r'const alturaTotal\s*=\s*(\d+)', html)
if old_altura:
    print(f"  alturaTotal atual: {old_altura.group(1)}")
html = re.sub(r'const alturaTotal\s*=\s*\d+', 'const alturaTotal = 95', html)
print("  ✅ alturaTotal = 95")

html = re.sub(r'const altV\s*=\s*[^;]+;', 'const altV = 83 / vitais.length;', html)
print("  ✅ altV = 83/vitais.length")

# ── IDENTIDADE VISUAL DAS SEÇÕES ─────────────────────────────
print("\n── Identidade visual ──")
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
    html = html.replace('  async function exportarPDF()', func + '  async function exportarPDF()')
    print("  ✅ Função secTitulo inserida")
else:
    print("  ✅ Função secTitulo já existe")

# Substitui secHeader por secTitulo se existir
if 'function secHeader(' in html:
    # Mantém secHeader como alias de secTitulo
    html = html.replace(
        'function secHeader(',
        'function secHeader_old('
    )
    # Adiciona novo secHeader que usa secTitulo
    html = html.replace(
        'function secHeader_old(',
        'function secHeader(titulo) { y = secTitulo(doc, titulo, ml, y, pw - ml*2); }\n  function secHeader_old('
    )
    print("  ✅ secHeader atualizado para usar secTitulo")

# ── EVITAR QUEBRA DE SEÇÃO ────────────────────────────────────
print("\n── Anti-quebra de seção ──")
# Garante verificação de espaço antes das seções principais
verificacao = '''
  // Verifica espaço antes de seção
  function checkPagina(alturaMinima) {
    if (y + alturaMinima > 270) {
      doc.addPage();
      doc.setFillColor(15, 30, 53);
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
      y = 16;
    }
  }

'''
if 'function checkPagina(' not in html:
    html = html.replace('  async function exportarPDF()', verificacao + '  async function exportarPDF()')
    print("  ✅ Função checkPagina inserida")
else:
    print("  ✅ checkPagina já existe")

# ── VERIFICA SINTAXE ─────────────────────────────────────────
print("\n── Verificação ──")
script = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
if script:
    js = script.group(1)
    abre = js.count('{')
    fecha = js.count('}')
    print(f"  Chaves: {abre}/{fecha} {'✅' if abre==fecha else '❌ dif:'+str(abre-fecha)}")

with open('regulacao.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f"\n🎉 {fixes} correções aplicadas!")
print("Próximo: git add . && git commit -m 'fix: PDF completo' && git push")
