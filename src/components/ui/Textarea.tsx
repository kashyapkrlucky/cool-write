import type { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id?: string;
  label?: string;
  boxClassName?: string;
  description?: string;
  resize?: "none" | "vertical" | "horizontal" | "both";
}

export default function Textarea({
  id,
  label,
  boxClassName = "",
  description,
  resize = "none",
  ...props
}: TextareaProps) {
  return (
    <div className={`flex flex-col gap-2 ${boxClassName}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold uppercase tracking-wide text-(--ink-soft)"
        >
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={3}
        style={{ resize }}
        className="h-full w-full p-3 rounded-xl text-sm text-(--ink) outline-none border border-(--border) bg-(--surface) focus-within:border-(--ink) focus-within:ring-2 focus-within:ring-(--border-soft) placeholder:text-(--ink-soft)"
        {...props}
      />
      {description && (
        <p className="mt-2 text-sm text-(--ink-soft)">{description}</p>
      )}
    </div>
  );
}
