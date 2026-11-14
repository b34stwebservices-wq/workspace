# B34ST UI design system

Shared components live in `lib/ui.tsx` and `lib/toast.tsx`.

## Layout & feedback

| Component | Use for |
|-----------|---------|
| `PageHeader` | Page title + optional eyebrow, description, actions |
| `Card` | Generic bordered surface |
| `EmptyState` | No data (title, text, optional action/icon) |
| `LoadingState` | Skeleton rows while fetching |
| `Skeleton` | Single pulse block |
| `ErrorNote` | Inline error banner |
| `Badge` / `StatusPill` | Labels and workflow status |

## Actions

- `Button` variants: `primary` \| `ghost` \| `danger` \| `subtle`
- `useToast()` from `lib/toast` — success / error / info messages

## Forms

- `TextField`, `TextAreaField`, `SelectField` — label + control + hint/error
- `Field` — low-level label wrapper if you need a custom control
- `inputClass` — legacy class string; prefer the field components

## Overlays

- `Modal` — `title`, `onClose`, optional `footer`, `size` (`sm` \| `md` \| `lg`)
- `ConfirmDialog` — destructive or important confirmations

## Entity selection

```tsx
<EntityPicker
  label="Assignee"
  staff
  value={assigneeId}
  onChange={(id) => setAssigneeId(id)}
  required
/>
```

Pass `options={[{ id, label, meta? }]}` for clients or other lists instead of `staff`.

## Icons

`Icon` names: `home`, `tasks`, `users`, `check`, `megaphone`, `shield`, `log`, `plus`, `alert`, `search`, `calendar`, `bell`.

## Conventions

- Prefer these components over one-off markup so spacing, focus rings and mobile heights stay consistent.
- Keep business logic out of the UI layer; pages own data and pass props down.
- Do not store secrets or personal data in component state beyond what the screen needs.
