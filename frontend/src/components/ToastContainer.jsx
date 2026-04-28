import { CheckCircle, XCircle, X } from 'lucide-react'

export const ToastContainer = ({ toasts, removeToast }) => (
  <div className="toast-container">
    {toasts.map((t) => (
      <div key={t.id} className={`toast ${t.type}`}>
        {t.type === 'success'
          ? <CheckCircle size={16} color="var(--success)" />
          : <XCircle size={16} color="var(--danger)" />}
        <span style={{ flex: 1, fontSize: '0.875rem' }}>{t.message}</span>
        <button
          onClick={() => removeToast(t.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
        >
          <X size={14} />
        </button>
      </div>
    ))}
  </div>
)
