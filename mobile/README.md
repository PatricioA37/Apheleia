# App paciente — React Native + Expo

Landing zone para el proyecto Expo de Jonathan. Cuando el scaffold esté listo
(`npx create-expo-app`), se integra aquí.

**Antes de escribir la primera línea**, revisar:
- `specs/001-continuidad-cuidado/contracts/tools.md` — endpoints `/api/paciente/*`
- `specs/001-continuidad-cuidado/spec.md` — US2 (medicamentos/controles) y US3 (chat)

Estructura esperada (ver `plan.md`):

```
mobile/
├── app/                # rutas (expo-router)
│   ├── medicamentos/
│   ├── controles/
│   └── chat/
├── components/
├── lib/api.ts
├── app.json
├── package.json
└── ...
```

Puede construirse contra los ejemplos JSON del contrato antes de que el backend
esté funcionando — no hay que esperar.
