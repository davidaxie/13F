"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

export function SearchInput({
  size = "lg",
  initial = "",
  autoFocus = false,
}: {
  size?: "lg" | "sm";
  initial?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  const inputClass =
    size === "lg"
      ? "w-full bg-transparent py-5 pl-14 pr-5 text-lg font-serif text-foreground placeholder:text-muted focus:outline-none"
      : "w-full bg-transparent py-3 pl-11 pr-3 text-base text-foreground placeholder:text-muted focus:outline-none";

  const iconClass =
    size === "lg"
      ? "pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted"
      : "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted";

  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <Search
        className={iconClass}
        size={size === "lg" ? 20 : 16}
        strokeWidth={1.5}
      />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search a fund manager…"
        className={`${inputClass} border-b border-hairline transition-colors focus:border-foreground`}
        spellCheck={false}
        autoComplete="off"
      />
    </form>
  );
}
