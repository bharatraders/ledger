export default function Avatar({ name }) {
  const ch = (name || '?').charAt(0).toUpperCase();
  return (
    <div className="grid h-11 w-11 flex-none place-items-center rounded-full bg-rule font-bold text-accent">
      {ch}
    </div>
  );
}
