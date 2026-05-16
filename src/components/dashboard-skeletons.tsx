export function HighlightsSkeleton() {
  return (
    <div className="mt-12 animate-pulse">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i}>
            <div className="border-b border-hairline pb-3">
              <div className="h-5 w-32 rounded bg-hairline" />
            </div>
            <ul className="mt-3 space-y-3">
              {[0, 1, 2, 3, 4].map((j) => (
                <li key={j} className="h-10 rounded bg-hairline/40" />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FundCardSkeleton({ name }: { name: string }) {
  return (
    <div className="animate-pulse">
      <div className="font-serif text-2xl text-muted">{name}</div>
      <div className="mt-2 h-3 w-60 rounded bg-hairline" />
      <div className="mt-5 grid grid-cols-2 gap-x-6">
        {[0, 1].map((i) => (
          <div key={i}>
            <div className="h-2 w-10 rounded bg-hairline" />
            <div className="mt-2 h-3 w-32 rounded bg-hairline/60" />
            <div className="mt-1.5 h-3 w-24 rounded bg-hairline/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
