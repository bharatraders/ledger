import BottomSheet from './BottomSheet';
import { useToast } from '../../context/ToastContext';
import { statement, printHTML } from '../../utils/statement';

export default function ShareSheet({ party, entries, onClose }) {
  const { toast } = useToast();

  function text() {
    return statement(party, entries);
  }

  function wa() {
    const t = encodeURIComponent(text());
    window.open('https://api.whatsapp.com/send?text=' + t, '_blank');
  }

  async function native() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Statement: ' + party.name, text: text() });
      } catch {
        // user dismissed
      }
    } else {
      copy(text());
      toast('Sharing not supported here. Text copied.');
    }
  }

  function copy(t) {
    try {
      navigator.clipboard.writeText(t).catch(() => fallbackCopy(t));
    } catch {
      fallbackCopy(t);
    }
  }

  function fallbackCopy(t) {
    const x = document.createElement('textarea');
    x.value = t;
    document.body.appendChild(x);
    x.select();
    try {
      document.execCommand('copy');
    } catch {
      // ignore
    }
    document.body.removeChild(x);
  }

  function pdf() {
    document.getElementById('printarea').innerHTML = printHTML(party, entries);
    onClose();
    setTimeout(() => window.print(), 150);
  }

  const opts = [
    {
      key: 'wa',
      icon: '💬',
      title: 'Send on WhatsApp',
      sub: 'Pick the chat inside WhatsApp',
      act: wa,
    },
    { key: 'native', icon: '📤', title: 'Share via other apps', sub: 'SMS, email, Telegram and more', act: native },
    { key: 'pdf', icon: '📄', title: 'Save as PDF / Print', sub: 'Full statement in a table', act: pdf },
    {
      key: 'copy',
      icon: '📋',
      title: 'Copy text',
      sub: 'Paste anywhere',
      act: () => {
        copy(text());
        toast('Statement copied');
      },
    },
  ];

  return (
    <BottomSheet title={'Share ledger of ' + party.name} onClose={onClose}>
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={o.act}
          className="mt-2.5 flex w-full items-center gap-3.5 rounded-[14px] border border-rule bg-paper p-4 text-left"
        >
          <span className="flex-none text-[26px]" aria-hidden="true">
            {o.icon}
          </span>
          <span>
            <b className="block">{o.title}</b>
            <span className="text-sm text-muted">{o.sub}</span>
          </span>
        </button>
      ))}
      <button type="button" onClick={onClose} className="mt-2 w-full p-3 text-muted">
        Close
      </button>
    </BottomSheet>
  );
}
