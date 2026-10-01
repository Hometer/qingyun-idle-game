export function Section({
  title,
  action,
  children,
  variant = "default",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  variant?: "default" | "featured";
}) {
  return (
    <section className={`game-section relative mt-4 overflow-hidden border border-line bg-card p-4 sm:p-5 ${variant === "featured" ? "game-section-featured" : ""}`}>
      <div className="relative mb-4 flex items-center justify-between gap-3 border-b border-line/70 pb-3">
        <h2 className="game-section-title flex min-w-0 items-center gap-2.5 text-[19px] font-semibold tracking-[.08em] sm:text-[21px]">
          <span aria-hidden="true" className="section-seal flex h-7 w-7 shrink-0 items-center justify-center text-sm">章</span>
          {title}
        </h2>
        {action}
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}
