# Flujo de trabajo — git + spec-kit

## Convención de ramas

`main` (o `master`) contiene la **spec y los contratos**, siempre estables. Nadie
implementa directo ahí.

Una rama por vértice, no por persona — así el trabajo de Jonathan no bloquea el
tuyo ni viceversa. Se nombran con el prefijo de la spec activa:

```
001-continuidad-cuidado/rag-agente       ← Patricio: RAG + biblioteca + chat
001-continuidad-cuidado/interfaz-movil   ← Jonathan: React Native / Expo
001-continuidad-cuidado/criterio-clinico ← Joaquín: planes, criterios (si él edita directo)
001-continuidad-cuidado/priorizacion     ← Gerardo: matriz de la bandeja (si él edita directo)
```

Si Joaquín y Gerardo no van a tocar código directamente (lo más probable), sus
insumos entran como archivos que Patricio o Jonathan incorporan — no necesitan
rama propia. Ajusta según cómo trabaje cada uno.

## Comandos para arrancar (cada persona, una vez)

```bash
git clone <url-del-repo>
cd apheleia

# Crear y moverse a tu rama de vértice
git checkout -b 001-continuidad-cuidado/rag-agente

# Trabajar, commitear seguido (commits chicos, no uno gigante al final)
git add -A
git commit -m "rag: cliente de embeddings con mock de biblioteca"

# Subir la rama
git push -u origin 001-continuidad-cuidado/rag-agente
```

## Integrar contra `main`

```bash
# Antes de integrar, traer lo último de main
git checkout main
git pull
git checkout 001-continuidad-cuidado/rag-agente
git merge main          # resolver conflictos si los hay, ojalá pocos porque
                         # cada quien trabaja en su carpeta (src/rag/ vs mobile/)

# Cuando la pieza funciona, PR contra main (o merge directo si el equipo
# prefiere velocidad sobre revisión en un hackathon de 2 días)
git checkout main
git merge 001-continuidad-cuidado/rag-agente
git push
```

**Regla práctica para 2 días**: integrar seguido (cada 2-3 horas), no al final.
La razón de que los contratos existan (`contracts/tools.md`) es evitar que la
integración final sea un descubrimiento — debería ser un trámite.

## Si un contrato cambia a mitad de camino

1. Se actualiza `specs/001-continuidad-cuidado/contracts/tools.md` en `main` primero.
2. Se avisa al equipo (mensaje corto: qué campo cambió y por qué).
3. Quien esté trabajando contra ese contrato hace `git merge main` para recibir
   el cambio y ajusta.

Nunca se cambia un contrato silenciosamente en una rama propia.

## Qué NO mezclar en un commit

- No mezclar cambios de `mobile/` con cambios de `src/`. Un commit, un vértice.
- No commitear `.env`, `cohorte_sintetica.json` generado, ni `__pycache__`
  (ya están en `.gitignore`).
- No commitear datos con PII — no debería existir ninguno, pero es la
  verificación de siempre antes de un `git push`.
