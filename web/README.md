# Interfaz clínica — React

Landing zone para el proyecto React de Jonathan. Cuando el scaffold esté listo
(`npm create vite@latest` o el generador que prefiera), se integra aquí.

**Antes de escribir la primera línea**, revisar:
- `specs/001-continuidad-cuidado/contracts/tools.md` — endpoints `/api/clinica/*`
- `specs/001-continuidad-cuidado/spec.md` — US1 (bandeja) y US5 (alertas)

Estructura esperada (ver `plan.md`):

```
web/
├── src/
│   ├── pages/ (o routes/)
│   │   ├── bandeja/
│   │   └── alertas/
│   ├── components/
│   └── lib/api.ts
├── package.json
└── ...
```

Puede construirse contra los ejemplos JSON del contrato antes de que el backend
esté funcionando — no hay que esperar.
