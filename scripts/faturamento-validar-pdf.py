"""Valida células por posição no PDF, independentemente do valor pago na fatura.

Requer PyMuPDF. Uso: python scripts/faturamento-validar-pdf.py [pasta dos PDFs]
Grava evidência com hash do arquivo, página e coordenada de cada código.
"""
import hashlib
import json
from pathlib import Path
import re
import sys

import pymupdf

pasta = Path(sys.argv[1] if len(sys.argv) > 1 else "Comparação de fatura")
fontes, celulas = [], []
for tabela, nome, limites in [
    ("11", "Código de Serviço Unificado.pdf", (375, 432, 496)),
    ("12", "Nota de Serviço Unificado.pdf", (430, 495, 555)),
]:
    arquivo = pasta / nome
    doc = pymupdf.open(arquivo)
    fontes.append({"tabela": tabela, "arquivo": nome, "sha256": hashlib.sha256(arquivo.read_bytes()).hexdigest(), "paginas": len(doc)})
    padrao = r"RC\d{2}" if tabela == "12" else r"(?:[0-9A-Z]\.[0-9A-Z]{2}|[A-Z]{2}\d{2})"
    for pagina, folha in enumerate(doc, 1):
        palavras = folha.get_text("words")
        codigos = sorted((w for w in palavras if w[0] < 80 and re.fullmatch(padrao, w[4])), key=lambda w: w[1])
        for codigo in codigos:
            fatores = []
            for esquerda, direita in zip(limites, limites[1:]):
                valores = [w[4] for w in palavras if esquerda <= w[0] < direita and abs(w[1] - codigo[1]) <= 1 and re.fullmatch(r"\d+,\d{6}|0", w[4])]
                fatores.append(float(valores[0].replace(",", ".")) if len(valores) == 1 else None)
            celulas.append({"tabela": tabela, "codigo": codigo[4], "pagina": pagina, "y": round(codigo[1], 2), "csc": fatores[0], "cod": fatores[1]})
    doc.close()
Path("docs/faturamento-celulas-pdf.json").write_text(json.dumps({"fontes": fontes, "celulas": celulas}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"{len(celulas)} códigos localizados; {sum(c['csc'] is not None and c['cod'] is not None for c in celulas)} pares numéricos nas colunas CSC/COD.")
