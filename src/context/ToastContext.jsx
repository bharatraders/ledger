import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext({ toast: () => {} });

export function ToastProvider({ children }) {
  const [message, setMessage] = useState('');
  const timer = useRef(null);

  const toast = useCallback((m) => {
    setMessage(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 2200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, message }}>
      {children}
      {message ? (
        <div
          role="status"
          className="fixed left-1/2 bottom-24 z-40 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-base text-paper"
        >
          {message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
