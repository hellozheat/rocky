# Architecture profiles

devkit defaults to **layered React SPA**. Detect the user’s repo before imposing structure.

## Detection order

1. `app/` + Next.js deps → **nextjs-app-router**
2. `src/components/atoms` + `connected/` → **layered-react-spa** (default)
3. No `components/` but `src/routes` or Express → **node-api-only**
4. Else: graphify + read neighbors — do not force atoms/connected

## layered-react-spa (default)

```
src/
├── components/atoms/       # presentational
├── components/connected/   # context + selectors + actions
├── context/
├── actions/
├── reducers/
├── selectors/
├── services/
├── pages/
├── utils/
└── config/
```

Styling: `styles.module.less` per component. Forms: antd `Form`. State: context + reducers.

## nextjs-app-router

Same logic layers; routes in `app/`. See agent `nextjs-developer.md` for server/client boundaries.

## node-api-only

Router → use case → repository. No React handbook for UI. See `node-api-developer.md` and `docs://architecture-style`.

## Styling variants

| Profile | When |
|---------|------|
| LESS modules | Default handbook |
| Tailwind | `tailwindcss` in package.json — see `tailwind-ui-developer.md`; do not mix LESS + Tailwind in one file |
