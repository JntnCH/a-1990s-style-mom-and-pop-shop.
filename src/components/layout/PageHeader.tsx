import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
  centered = false,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  centered?: boolean;
  className?: string;
}) {
  if (centered) {
    return (
      <div
        className={`mb-6 text-center flex flex-col items-center justify-center gap-2 ${className}`}
      >
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
        {action ? (
          <div className="mt-2 flex items-center justify-center gap-2">{action}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`mb-6 flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
