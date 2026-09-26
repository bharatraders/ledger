export default function Spinner({ label = 'Loading…' }) {
  return (
    <div role="status" aria-label={label} className="flex items-center justify-center gap-3 py-10 text-muted">
      <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-rule border-t-accent" />
      <span>{label}</span>
    </div>
  );
}
