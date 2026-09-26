export default function SearchBar({ value, onChange }) {
  return (
    <div className="relative mx-4 mb-1.5 mt-3.5">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className="absolute left-[15px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 stroke-muted"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        placeholder="Search party name"
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[14px] border-2 border-rule bg-card py-4 pl-12 pr-4 focus:border-accent focus:outline-none"
      />
    </div>
  );
}
