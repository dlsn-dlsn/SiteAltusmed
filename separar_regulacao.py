#!/usr/bin/env python3
"""
Separa regulacao.html em:
  - regulacao.html  (HTML + CSS, sem o bloco <script>)
  - regulacao.js    (JavaScript puro)

Execute: python3 separar_regulacao.py
"""
import re, os

HTML_FILE = 'regulacao.html'
JS_FILE   = 'regulacao.js'

with open(HTML_FILE, 'r', encoding='utf-8') as f:
    html = f.read()

# ── Extrai o bloco <script> ───────────────────────────────────
match = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
if not match:
    print("❌ Bloco <script> não encontrado!")
    exit(1)

js_content = match.group(1)

# ── Verifica se já foi separado ───────────────────────────────
if 'src="regulacao.js"' in html:
    print("⚠️  Já separado! regulacao.js já referenciado.")
    exit(0)

# ── Salva o JavaScript separado ──────────────────────────────
with open(JS_FILE, 'w', encoding='utf-8') as f:
    f.write(js_content.strip())
print(f"✅ {JS_FILE} criado ({len(js_content)} chars)")

# ── Substitui <script>...</script> por <script src="regulacao.js"> ──
html_novo = re.sub(
    r'<script>.*?</script>',
    '<script src="regulacao.js"></script>',
    html,
    flags=re.DOTALL
)

with open(HTML_FILE, 'w', encoding='utf-8') as f:
    f.write(html_novo)

print(f"✅ {HTML_FILE} atualizado (script externo)")

# ── Verifica tamanhos ─────────────────────────────────────────
html_size = os.path.getsize(HTML_FILE)
js_size   = os.path.getsize(JS_FILE)
print(f"\nTamanhos:")
print(f"  regulacao.html: {html_size/1024:.1f} KB")
print(f"  regulacao.js:   {js_size/1024:.1f} KB")
print(f"\n🎉 Separação concluída!")
print("Agora o Claude Code consegue editar regulacao.js normalmente.")
print("\nPróximo:")
print("  git add . && git commit -m 'refactor: separa JS do HTML na regulação' && git push")
