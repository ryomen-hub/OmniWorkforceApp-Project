export default function StatusPill({ type, children }) { return <span className={`status-pill status-${type}`}>{children}</span>; }
