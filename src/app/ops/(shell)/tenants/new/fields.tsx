"use client";

// Console Dark form primitives for the wizard: label + control + inline
// error ({colors.error} under the field, per EXPERIENCE.md error pattern).

const INPUT_CLASSES =
  "w-full rounded-lg border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

function borderClass(error: string | undefined): string {
  return error ? "border-status-critical" : "border-border";
}

export function FieldError({ error, id }: { error: string | undefined; id: string }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" data-testid={`${id}`} className="mt-1.5 text-sm text-error-soft">
      {error}
    </p>
  );
}

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
    >
      {children}
    </label>
  );
}

interface ControlProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export function TextField({ id, label, value, error, placeholder, type = "text", onChange, onBlur }: ControlProps) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        data-testid={id}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={`${INPUT_CLASSES} ${borderClass(error)}`}
      />
      <FieldError error={error} id={`${id}-error`} />
    </div>
  );
}

export function TextAreaField({ id, label, value, error, placeholder, onChange, onBlur }: Omit<ControlProps, "type">) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <textarea
        id={id}
        data-testid={id}
        value={value}
        placeholder={placeholder}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={`${INPUT_CLASSES} resize-none ${borderClass(error)}`}
      />
      <FieldError error={error} id={`${id}-error`} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  error,
  options,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        data-testid={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${INPUT_CLASSES} appearance-none ${borderClass(error)} ${value ? "" : "text-muted-foreground/60"}`}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError error={error} id={`${id}-error`} />
    </div>
  );
}

export function ToggleField({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-lg border border-border bg-muted p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        id={id}
        data-testid={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
          checked ? "bg-primary" : "bg-accent"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 size-5 rounded-full bg-foreground transition-transform ${
            checked ? "translate-x-[1.375rem]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
