import { Skeleton } from "@/components/ui/skeleton";

export function PageError({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
      {message}
    </p>
  );
}

const ROW_NAME_WIDTHS = ["w-[46%]", "w-[34%]", "w-[52%]", "w-[28%]", "w-[40%]", "w-[31%]"];

export function PageLoading({ label }: { label: string }) {
  return (
    <div className="w-full" role="status" aria-busy="true" aria-label={label}>
      <Skeleton className="mb-4 h-[30px] w-40 rounded-[4px]" />
      <div className="border-l-[6px] border-l-muted">
        {ROW_NAME_WIDTHS.map((nameWidth, index) => (
          <div key={index} className="flex h-9 items-center gap-3 border-b border-border px-3">
            <Skeleton className={`h-3.5 max-w-72 rounded-[4px] ${nameWidth}`} />
            <Skeleton className="h-3.5 w-24 shrink-0 rounded-[4px]" />
            <Skeleton className="hidden h-3.5 w-28 shrink-0 rounded-[4px] sm:block" />
            <Skeleton className="ml-auto hidden h-3.5 w-16 shrink-0 rounded-[4px] md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageEmpty({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`rounded-xl border border-hairline bg-surface-1 py-10 text-center text-sm text-ink-tertiary ${className}`}
    >
      {children}
    </p>
  );
}
