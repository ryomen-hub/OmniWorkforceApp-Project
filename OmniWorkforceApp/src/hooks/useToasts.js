import { useRef, useState } from "react";
export default function useToasts() {
  const [toasts, setToasts] = useState([]); const toastId = useRef(0);
  const showToast = (message) => { const id = ++toastId.current; setToasts((items) => [...items, { id, message }]); setTimeout(() => setToasts((items) => items.filter((toast) => toast.id !== id)), 3000); };
  return { toasts, showToast };
}
