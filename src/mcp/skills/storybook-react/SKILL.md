---
name: storybook-react
description: Storybook CSF 3 for React — colocated stories, atoms vs connected decorators, Vite/LESS/antd setup.
---

# Storybook React (reference)

Read **`storybook.mdc`** before editing stories.

## CSF 3 template

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import MyComponent from './index';

const meta: Meta<typeof MyComponent> = {
  title: 'Components/Atoms/MyComponent',
  component: MyComponent,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof MyComponent>;

export const Default: Story = { args: { title: 'Example' } };
```

## Atoms vs connected

| Type | Stories |
|------|---------|
| **atoms** | `args` only; no context |
| **connected** | decorators with providers or mock `getContextStores` |

## preview.tsx (connected)

```tsx
const WithProviders = composeProviders(AssetManagerProvider, LayoutProvider)(
  ({ children }) => <>{children}</>
);
decorators: [(Story) => <WithProviders><Story /></WithProviders>],
```

Import global/antd LESS in preview if the app does.

## Practices

- One story per variant (Default, Loading, Error, Empty)
- `argTypes` for controls; `tags: ['autodocs']`
- Colocate `Component.stories.tsx` beside component

## Commands

```bash
yarn storybook
yarn build-storybook
```

## Setup (if missing)

```bash
yarn add -D @storybook/react-vite storybook
npx storybook@latest init
```
