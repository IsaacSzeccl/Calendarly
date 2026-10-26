import type { ButtonHTMLAttributes, ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-rule bg-paper px-3 py-2.5 text-ink placeholder:text-pencil/70 focus:border-ribbon focus:outline-none";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "plain" }) {
  const look = {
    primary: "bg-ribbon text-ribbon-ink hover:brightness-110 font-semibold",
    quiet: "border border-rule bg-paper hover:bg-paper-deep font-medium",
    plain: "text-pencil underline underline-offset-4 hover:text-ink",
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-md transition disabled:cursor-not-allowed disabled:opacity-50 ${variant === "plain" ? "py-1" : "min-h-11 px-4 py-2"} ${look} ${className}`}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-pencil">{hint}</span>}
    </label>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-4 py-3 ${tone === "error" ? "border-danger/40 text-danger" : "border-rule bg-paper-deep"}`}
    >
      {children}
    </p>
  );
}
