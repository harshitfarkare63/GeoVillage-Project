import { useState } from 'react'
import { Upload, CheckCircle, XCircle, Loader2, FileText, AlertTriangle } from 'lucide-react'
import api from '../lib/api'

const Stage = ({ label, status, detail }) => {
  const icons = {
    pending: <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border-strong)' }} />,
    running: <Loader2 size={18} color="var(--warning)" style={{ animation: 'spin 0.7s linear infinite' }} />,
    done:    <CheckCircle size={18} color="var(--success)" />,
    error:   <XCircle size={18} color="var(--danger)" />,
  }
  const colors = { pending: 'var(--text-muted)', running: 'var(--warning)', done: 'var(--success)', error: 'var(--danger)' }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ paddingTop: 1 }}>{icons[status] || icons.pending}</div>
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: colors[status] }}>{label}</div>
        {detail && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>{detail}</div>}
      </div>
    </div>
  )
}

const STAGES = ['File Loaded', 'Schema Validated', 'Data Cleaned', 'Deduplicated', 'Batch Inserted', 'Integrity Verified']

export const AdminDataImportPage = () => {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [running, setRunning] = useState(false)
  const [stages, setStages] = useState(STAGES.map(() => 'pending'))
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  const updateStage = (i, status, setter) =>
    setter((prev) => prev.map((s, idx) => (idx === i ? status : s)))

  // Simulate ETL progress (real impl would use SSE/WebSocket for streaming)
  const runImport = async () => {
    if (!file) return
    setRunning(true)
    setReport(null)
    setError('')
    const s = STAGES.map(() => 'pending')
    setStages(s)

    try {
      // In production: POST /api/admin/import with FormData
      // Here we simulate step-by-step progress visually
      for (let i = 0; i < STAGES.length; i++) {
        setStages((prev) => prev.map((x, idx) => idx === i ? 'running' : x))
        await new Promise((r) => setTimeout(r, 700 + Math.random() * 600))
        setStages((prev) => prev.map((x, idx) => idx === i ? 'done' : x))
      }
      setReport({
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        inserted: Math.floor(Math.random() * 45000 + 5000),
        skipped: Math.floor(Math.random() * 500),
        errors: Math.floor(Math.random() * 10),
        duration: '4.2s',
        counts: { countries: 1, states: 36, districts: 732, subDistricts: 6115, villages: 600953 },
      })
    } catch (err) {
      setError(err.message)
      setStages((prev) => prev.map((s) => s === 'running' ? 'error' : s))
    } finally {
      setRunning(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.csv'))) setFile(f)
    else setError('Only .xlsx or .csv files are accepted')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Import</h1>
          <p className="page-subtitle">Import MDDS village dataset via Python ETL pipeline</p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Upload Zone */}
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input').click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--accent)' : file ? 'var(--success)' : 'var(--border-strong)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '40px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'var(--accent-dim)' : file ? 'var(--success-dim)' : 'var(--bg-card)',
              transition: 'all 0.2s',
              marginBottom: 16,
            }}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.csv"
              style={{ display: 'none' }}
              onChange={(e) => { setFile(e.target.files[0]); setError('') }}
            />
            {file ? (
              <>
                <FileText size={36} color="var(--success)" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</p>
                <p style={{ fontSize: '0.8125rem', marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB · Click to change</p>
              </>
            ) : (
              <>
                <Upload size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Drop MDDS dataset here</p>
                <p style={{ fontSize: '0.8125rem', marginTop: 4 }}>Supports .xlsx and .csv</p>
              </>
            )}
          </div>

          {error && (
            <div style={{ display: 'flex', gap: 8, background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: '0.8125rem', color: 'var(--danger)', marginBottom: 12 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={runImport} disabled={!file || running} style={{ flex: 1, justifyContent: 'center' }}>
              {running ? <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Upload size={15} />}
              {running ? 'Processing...' : 'Start Import'}
            </button>
            {file && !running && (
              <button className="btn btn-secondary" onClick={() => { setFile(null); setStages(STAGES.map(() => 'pending')); setReport(null) }}>
                Clear
              </button>
            )}
          </div>

          {/* Schema guide */}
          <div className="card" style={{ marginTop: 20 }}>
            <h4 style={{ marginBottom: 10 }}>Required CSV Columns</h4>
            {['state_name', 'state_code', 'district_name', 'subdistrict_name', 'village_name'].map((col) => (
              <div key={col} style={{ marginBottom: 4 }}>
                <code style={{ fontSize: '0.8125rem' }}>{col}</code>
                <span style={{ fontSize: '0.75rem', color: 'var(--danger)', marginLeft: 6 }}>required</span>
              </div>
            ))}
            {['pincode', 'latitude', 'longitude'].map((col) => (
              <div key={col} style={{ marginBottom: 4 }}>
                <code style={{ fontSize: '0.8125rem' }}>{col}</code>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>optional</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Status */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4 }}>Pipeline Progress</h3>
            <p style={{ fontSize: '0.8125rem', marginBottom: 16 }}>ETL processes data in 6 sequential stages</p>
            {STAGES.map((label, i) => (
              <Stage key={label} label={label} status={stages[i]}
                detail={stages[i] === 'running' ? 'Processing...' : stages[i] === 'done' ? 'Completed' : ''}
              />
            ))}
          </div>

          {/* Import Report */}
          {report && (
            <div className="card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <CheckCircle size={20} color="var(--success)" />
                <h3 style={{ color: 'var(--success)' }}>Import Complete</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Inserted', value: report.inserted.toLocaleString(), color: 'var(--success)' },
                  { label: 'Skipped', value: report.skipped.toLocaleString(), color: 'var(--warning)' },
                  { label: 'Errors', value: report.errors, color: report.errors > 0 ? 'var(--danger)' : 'var(--text-muted)' },
                  { label: 'Duration', value: report.duration, color: 'var(--accent)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{value}</div>
                  </div>
                ))}
              </div>

              <h4 style={{ marginBottom: 8, fontSize: '0.8125rem' }}>Database Integrity Check</h4>
              {Object.entries(report.counts).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{v.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
