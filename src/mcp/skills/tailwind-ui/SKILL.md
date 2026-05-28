---
name: tailwind-ui
description: Tailwind CSS for React — utilities, tokens, responsive variants, antd coexistence, no LESS mix in same file.
---

# Tailwind UI (reference)

## Scope

Same React layout as **`react-hexagonal.md`** (or layered atoms/connected if repo uses it). **Only styling** differs: `className` utilities, not `styles.module.less`.

## Config

```
tailwind.config.ts    # content paths, theme tokens
postcss.config.js
src/styles/globals.css   # @tailwind directives if used
```

## Patterns

- Utilities: layout → spacing → typography → color (match neighbors)
- Responsive: repo breakpoints (`md:`, `lg:`)
- State: `hover:`, `focus:`, `disabled:`
- **antd**: prefer Table/Modal/Select when repo uses antd; `className` / `rootClassName` only as neighbors do
- **`cn()` / `clsx()`** only if repo already uses them

```tsx
export function Card({ title, children }: CardProps) {
  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
```

## Never in one file

```tsx
import styles from './styles.module.less';
<div className={`${styles.root} flex gap-2`} />  // ❌
```

## Related

- **`frontend-design`** — visual direction
- **`react-hexagonal`** — architecture/state
