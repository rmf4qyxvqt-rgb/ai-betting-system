type StatCardProps = {
  title: string;
  value: string;
  hint?: string;
};

export function StatCard({ title, value, hint }: StatCardProps) {
  return (
    <article className="desk-card-dark fade-in rounded-[24px] p-5">
      <p className="desk-kicker text-[#89a6cf]">{title}</p>
      <p className="mt-3 font-[var(--font-display)] text-4xl font-semibold text-[#f4f1eb]">{value}</p>
      {hint ? <p className="mt-2 text-sm text-[#c8d4e5]">{hint}</p> : null}
    </article>
  );
}
