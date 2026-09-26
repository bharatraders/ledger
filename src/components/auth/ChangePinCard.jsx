// The PIN is one shared secret: a single app_config row whose pin_hash is compared by
// verify_pin(). It is only writable through admin_set_pin(), which is granted to
// service_role alone (see backend/sql/005_functions.sql) — the anon key this app ships
// with has no execute grant. So there is deliberately no in-app change flow; this card
// documents the supported one instead of offering a button that could never work.
export default function ChangePinCard() {
  return (
    <section className="rounded-[14px] border border-rule bg-card p-4">
      <h2 className="text-lg font-bold">Ledger PIN</h2>
      <p className="mt-1 text-sm text-muted">
        Every trusted device shares one 6-digit PIN. It lives on the server, so it is changed
        from the backend, not from this screen.
      </p>
      <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-muted">
        <li>
          On the computer that holds <span className="font-mono">backend/.env</span>, open a
          terminal.
        </li>
        <li>
          Run <span className="font-mono">cd party-ledger\backend\scripts</span>.
        </li>
        <li>
          Run <span className="font-mono">node set-pin.js</span> and type the new 6 digits.
        </li>
      </ol>
      <p className="mt-3 text-sm text-muted">
        Each device picks the new PIN up at its next unlock — nothing needs re-registering.
      </p>
    </section>
  );
}
