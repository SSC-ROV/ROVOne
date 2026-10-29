import type { ReactNode } from "react";

export function BoardHeader({
  title,
  subtitle,
  views,
  filters,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  views?: ReactNode;
  filters?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="board-title text-foreground">{title}</h1>
        {subtitle ? <p className="pb-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        {action ? <div className="ml-auto flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {views}
      {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
    </div>
  );
}
