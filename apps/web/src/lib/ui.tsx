import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { loadUsers, type Profile } from "./data";

/* -------------------------------------------------------------------------- */
/* Shared class tokens                                                         */
/* -------------------------------------------------------------------------- */

export const inputClass =
  "mt-1 w-full rounded-lg border border-slate-700 bg-[#080C12] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#2E9BFF] disabled:opacity-50";

const controlBase =
  "mt-1 w-full rounded-lg border bg-[#080C12] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition disabled:cursor-not-allowed disabled:opacity-50";

function controlClass(invalid?: boolean) {
  return `${controlBase} ${
    invalid
      ? "border-red-500/60 focus:border-red-400"
      : "border-slate-700 focus:border-[#2E9BFF]"
  }`;
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                     */
/* -------------------------------------------------------------------------- */

type Variant = "primary" | "ghost" | "danger" | "subtle";
const variants: Record<Variant, string> = {
  primary: "bg-[#2E9BFF] text-[#05080D] hover:bg-[#5BB2FF]",
  ghost:
    "border border-slate-700 text-slate-200 hover:border-[#2E9BFF] hover:text-white",
  danger: "border border-red-500/40 text-red-300 hover:bg-red-500/10",
  subtle:
    "border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-white",
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Layout primitives                                                           */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-800 bg-[#0D1118] ${className}`}
    >
      {children}
    </div>
  );
}

export type Tone = "slate" | "blue" | "green" | "amber" | "red";
const tones: Record<Tone, string> = {
  slate: "bg-slate-800 text-slate-300",
  blue: "bg-[#2E9BFF]/15 text-[#9DD1FF]",
  green: "bg-emerald-500/15 text-emerald-300",
  amber: "bg-amber-500/15 text-amber-300",
  red: "bg-red-500/15 text-red-300",
};

export function Badge({
  tone = "slate",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Status-style pill used on cards and tables. */
export function StatusPill({
  tone = "slate",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const palette = [
  "#2E9BFF",
  "#7C5CFF",
  "#18B58A",
  "#E0902B",
  "#E0527A",
  "#3AA7C9",
];

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-semibold text-[#05080D]"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: palette[hash % palette.length],
      }}
    >
      {initials}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-6">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-xl text-sm text-slate-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback states                                                             */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  title,
  text,
  action,
  icon,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 text-center">
      {icon && (
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-slate-800 text-slate-400">
          {icon}
        </div>
      )}
      <p className="font-medium text-slate-200">{title}</p>
      {text && (
        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
          {text}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-slate-800/70 ${className}`} />
  );
}

export function LoadingState({
  label = "Loading…",
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <p className="text-sm text-slate-500">{label}</p>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
    >
      {children}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Form primitives                                                             */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  children,
  hint,
  error,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  htmlFor?: string;
}) {
  return (
    <div className="block">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-300"
      >
        {label}
      </label>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-300" role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span className="mt-1 block text-xs font-normal text-slate-500">
            {hint}
          </span>
        )
      )}
    </div>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId}>
      <input
        id={fieldId}
        className={`${controlClass(Boolean(error))} ${className}`}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    </Field>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextAreaField({
  label,
  hint,
  error,
  id,
  className = "",
  rows = 4,
  ...props
}: TextAreaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId}>
      <textarea
        id={fieldId}
        rows={rows}
        className={`${controlClass(Boolean(error))} ${className}`}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    </Field>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
};

export function SelectField({
  label,
  hint,
  error,
  id,
  options,
  placeholder,
  className = "",
  ...props
}: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId}>
      <select
        id={fieldId}
        className={`${controlClass(Boolean(error))} ${className}`}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {placeholder && (
          <option value="" disabled={props.required}>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal + confirm                                                             */
/* -------------------------------------------------------------------------- */

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = "md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const width =
    size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  // Focus + escape + body scroll lock only on mount/unmount.
  // Using a ref for onClose so parent re-renders (new onClose identity)
  // do not re-run this effect and steal focus from inputs after each keystroke.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-end bg-black/70 p-0 sm:place-items-center sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92vh] w-full ${width} overflow-y-auto rounded-t-2xl border border-slate-700 bg-[#0D1118] outline-none sm:rounded-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-[#0D1118]/95 px-5 py-4 backdrop-blur sm:px-6">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-9 min-h-0 w-9 place-items-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-800 bg-[#0D1118]/95 px-5 py-4 backdrop-blur sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-6 text-slate-300">{message}</p>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Entity picker (staff / generic list)                                        */
/* -------------------------------------------------------------------------- */

export type EntityOption = {
  id: string;
  label: string;
  meta?: string;
};

type EntityPickerProps = {
  label: string;
  value: string;
  onChange: (id: string, option?: EntityOption) => void;
  options?: EntityOption[];
  /** When true, loads active staff from `users` via the shared cache. */
  staff?: boolean;
  /** Restrict staff list to active profiles only (default true). */
  activeOnly?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
};

export function EntityPicker({
  label,
  value,
  onChange,
  options: externalOptions,
  staff = false,
  activeOnly = true,
  placeholder = "Search and select…",
  hint,
  error,
  disabled,
  required,
  allowClear = true,
}: EntityPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [staffOptions, setStaffOptions] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    setLoading(true);
    void loadUsers()
      .then((profiles: Profile[]) => {
        if (cancelled) return;
        const next = profiles
          .filter((p) => (activeOnly ? p.status === "active" : true))
          .map((p) => ({
            id: p.id,
            label: p.name || p.workEmail || p.id,
            meta: [p.jobTitle, p.department].filter(Boolean).join(" · "),
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setStaffOptions(next);
      })
      .catch(() => {
        if (!cancelled) setStaffOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [staff, activeOnly]);

  const options = externalOptions ?? staffOptions;

  const selected = useMemo(
    () => options.find((option) => option.id === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 40);
    return options
      .filter(
        (option) =>
          option.label.toLowerCase().includes(q) ||
          option.meta?.toLowerCase().includes(q) ||
          option.id.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative block">
      <Field label={label} hint={hint} error={error}>
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((current) => !current)}
          className={`${controlClass(Boolean(error))} flex min-h-11 items-center justify-between gap-3 text-left`}
        >
          <span className="flex min-w-0 items-center gap-3">
            {selected ? (
              <>
                <Avatar name={selected.label} size={28} />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-white">
                    {selected.label}
                  </span>
                  {selected.meta && (
                    <span className="block truncate text-xs text-slate-500">
                      {selected.meta}
                    </span>
                  )}
                </span>
              </>
            ) : (
              <span className="text-slate-500">{placeholder}</span>
            )}
          </span>
          <span className="shrink-0 text-slate-500">{open ? "▴" : "▾"}</span>
        </button>
      </Field>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-700 bg-[#0B1018] shadow-2xl"
        >
          <div className="border-b border-slate-800 p-2">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type to filter…"
              className="w-full rounded-lg border border-slate-700 bg-[#080C12] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#2E9BFF]"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {loading && (
              <p className="px-3 py-4 text-sm text-slate-500">Loading…</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="px-3 py-4 text-sm text-slate-500">No matches.</p>
            )}
            {!loading &&
              filtered.map((option) => {
                const active = option.id === value;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-800/80 ${
                      active ? "bg-sky-400/10" : ""
                    }`}
                    onClick={() => {
                      onChange(option.id, option);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Avatar name={option.label} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white">
                        {option.label}
                      </span>
                      {option.meta && (
                        <span className="block truncate text-xs text-slate-500">
                          {option.meta}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
          </div>
          {allowClear && value && (
            <div className="border-t border-slate-800 p-2">
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setQuery("");
                }}
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
      {required && (
        <input
          tabIndex={-1}
          className="sr-only"
          required
          value={value}
          onChange={() => undefined}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                       */
/* -------------------------------------------------------------------------- */

const iconPaths = {
  home: "M3 11l9-8 9 8M5 10v10h14V10",
  tasks: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  users: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 20c0-3 3-5 8-5s8 2 8 5",
  check: "M5 12l4 4 10-10",
  megaphone: "M3 11v2l12 5V6L3 11zM15 8h3a3 3 0 0 1 0 8h-3",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z",
  log: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h4",
  plus: "M12 5v14M5 12h14",
  alert: "M12 9v4M12 17h.01M10.3 4.3l-7 12A2 2 0 0 0 5 19h14a2 2 0 0 0 1.7-2.7l-7-12a2 2 0 0 0-3.4 0z",
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3",
  calendar: "M8 3v3M16 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  bell: "M6 9a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0",
} as const;

export function Icon({
  name,
  size = 18,
}: {
  name: keyof typeof iconPaths;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}
