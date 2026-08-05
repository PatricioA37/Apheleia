# Flujo de trabajo — git + spec-kit

## Antes de nada: verificar que el repo está bien configurado

Ejecutar una vez al clonar. Si algo no coincide, corregirlo **antes** de trabajar.

```bash
git branch --show-current    # debe decir: master
git remote -v                # debe apuntar al repo de GitHub del equipo
git status                   # debe decir "working tree clean"
```

---

## Modelo de ramas

`master` contiene **la spec, los contratos y el código integrado**. Siempre debe estar
en un estado que funcione. Nadie implementa directo ahí.

Una rama por **vértice de trabajo**, no por persona — así el trabajo de una persona
no bloquea al resto:

| Rama | Vértice | Carpetas que toca |
|------|---------|-------------------|
| `001-continuidad-cuidado/rag-agente` | RAG, biblioteca, agentes | `src/rag/`, `src/agents/`, `src/graph/` |
| `001-continuidad-cuidado/interfaz-movil` | App paciente | `mobile/` |
| `001-continuidad-cuidado/interfaz-clinica` | Interfaz dupla gestora | `web/` |
| `001-continuidad-cuidado/backend-api` | Endpoints, core, datos | `src/api/`, `src/core/`, `src/data/` |

**Criterio de separación**: cada rama tiene su territorio de carpetas. Si dos ramas
tocan el mismo archivo, es señal de que el trabajo está mal repartido — hay que
hablarlo, no resolverlo con merge.

Joaquín y Gerardo entregan insumos (planes, criterios, matriz de priorización) como
contenido, no como código. No necesitan rama propia salvo que editen archivos
directamente.

---

## Arrancar (cada persona, una vez)

Reemplaza `<tu-vertice>` por el de la tabla de arriba. **No copies el nombre de la
rama de otra persona.**

```bash
git clone <url-del-repo>
cd apheleia

# Verificar antes de empezar
git branch --show-current      # master
git status                     # clean

# Crear tu rama de vértice desde master actualizado
git pull
git checkout -b 001-continuidad-cuidado/<tu-vertice>

# Subirla y dejarla vinculada al remoto
git push -u origin 001-continuidad-cuidado/<tu-vertice>
```

Ejemplos concretos:

```bash
# Patricio
git checkout -b 001-continuidad-cuidado/rag-agente

# Jonathan (app paciente)
git checkout -b 001-continuidad-cuidado/interfaz-movil

# Jonathan (interfaz clínica — rama separada, se integra por separado)
git checkout -b 001-continuidad-cuidado/interfaz-clinica
```

---

## Ciclo de trabajo diario

```bash
# 1. Antes de empezar el día: traer lo último
git checkout master
git pull
git checkout 001-continuidad-cuidado/<tu-vertice>
git merge master

# 2. Trabajar. Commitear seguido, commits chicos.
git status                     # SIEMPRE mirar qué vas a agregar
git add src/rag/embeddings.py  # agregar por archivo o carpeta, no 'git add -A' a ciegas
git commit -m "rag: cliente de embeddings con los dos tiers de Voyage"

# 3. Subir tu trabajo
git push
```

**Por qué no `git add -A` sin mirar**: arrastra archivos generados, `.env` mal
ubicados, o cambios accidentales en carpetas de otro vértice. El `.gitignore` cubre
lo predecible, pero `git status` antes de agregar toma dos segundos y evita
sorpresas.

---

## Integrar a `master`

Cuando tu pieza funciona y no rompe nada:

```bash
# 1. Actualizar tu rama con lo último de master y resolver conflictos EN TU RAMA
git checkout master
git pull
git checkout 001-continuidad-cuidado/<tu-vertice>
git merge master
# ...resolver conflictos si los hay, verificar que sigue funcionando...

# 2. Recién ahora integrar a master
git checkout master
git merge 001-continuidad-cuidado/<tu-vertice>
git push

# 3. Volver a tu rama para seguir trabajando
git checkout 001-continuidad-cuidado/<tu-vertice>
```

**El orden importa**: los conflictos se resuelven en tu rama, nunca en `master`. Si
algo sale mal, `master` sigue intacto y solo tu rama queda a medias.

En un evento de dos días, merge directo es aceptable en vez de Pull Request. Si
prefieren PR para tener revisión, funciona igual — el paso 1 no cambia.

---

## Ritmo de integración

**Integrar cada 2–3 horas, no al final del día.** La razón de que existan los
contratos (`specs/001-continuidad-cuidado/contracts/tools.md`) es que la integración
sea un trámite y no un descubrimiento.

Checkpoints sugeridos: media mañana, después de almuerzo, media tarde, cierre.

---

## Si un contrato cambia

1. Se actualiza `specs/001-continuidad-cuidado/contracts/tools.md` **en `master`** primero.
2. Se avisa al equipo: qué campo cambió y por qué (mensaje corto basta).
3. Quien trabaja contra ese contrato hace `git merge master` y ajusta.

Nunca se cambia un contrato en silencio dentro de una rama propia — eso rompe a
quien está construyendo contra él.

---

## Errores frecuentes y cómo evitarlos

| Error | Síntoma | Prevención |
|-------|---------|-----------|
| Commitear en la rama equivocada | Trabajo de spec en rama de vértice, o al revés | `git branch --show-current` antes de commitear |
| `git checkout master` falla | Estás en un clon con otra rama base | `git branch -a` para ver las ramas reales |
| Merge con conflictos gigantes | No se integró en horas | Integrar cada 2–3 horas |
| Subir `.env` con API keys | Keys expuestas en el repo | Ya está en `.gitignore`; verificar con `git status` |
| Dos personas editan el mismo archivo | Conflictos constantes | Respetar el territorio de carpetas por vértice |

**Si commiteaste en la rama equivocada** (pasa, y no es grave):

```bash
git log --oneline -1                              # copiar el hash del commit
git checkout <rama-correcta>
git cherry-pick <hash>
git checkout <rama-equivocada>
git reset --hard HEAD~1                           # ojo: borra el commit de ahí
```

---

## Qué NO commitear

- `.env` con claves reales (usar `.env.example` como plantilla)
- `cohorte_sintetica.json` y otros archivos generados
- `__pycache__/`, `node_modules/`, `.venv/`
- Cualquier dato con PII — **no debería existir ninguno**, pero es la verificación
  obligatoria antes de cada `git push`

Todo lo anterior ya está en `.gitignore`. La verificación manual es la red de
seguridad, no el mecanismo principal.
