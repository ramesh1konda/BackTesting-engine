import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getForm, getSubmissions, deleteSubmission, exportSubmissionsUrl } from '../api'

export default function Submissions() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([getForm(id), getSubmissions(id)])
      .then(([{ data: f }, { data: s }]) => {
        setForm(f)
        setSubmissions(s)
      })
      .catch(() => setError('Failed to load submissions.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async (subId) => {
    if (!window.confirm('Delete this submission?')) return
    setDeletingId(subId)
    try {
      await deleteSubmission(id, subId)
      setSubmissions(prev => prev.filter(s => s.id !== subId))
    } catch {
      alert('Delete failed.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mr-2" /> Loading…
    </div>
  )

  if (error || !form) return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <p className="text-red-600 font-medium">{error || 'Form not found.'}</p>
      <Link to="/" className="btn-primary mt-4 inline-flex">← Dashboard</Link>
    </div>
  )

  const dataFields = (form.schema?.fields || []).filter(f => f.key)
  const fmt = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const filtered = search
    ? submissions.filter(s => JSON.stringify(s.data).toLowerCase().includes(search.toLowerCase()))
    : submissions

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/" className="hover:text-blue-600">Forms</Link>
        <span>/</span>
        <Link to={`/forms/${id}/build`} className="hover:text-blue-600">{form.name}</Link>
        <span>/</span>
        <span className="text-gray-600">Submissions</span>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{form.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {submissions.length} total submission{submissions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/forms/${id}/build`} className="btn-secondary text-sm">✏️ Edit Form</Link>
          <Link to={`/forms/${id}/preview`} className="btn-secondary text-sm">👁 Preview</Link>
          {submissions.length > 0 && (
            <a href={exportSubmissionsUrl(id)} className="btn-primary text-sm" download>
              ⬇ Export CSV
            </a>
          )}
        </div>
      </div>

      {/* API endpoint info */}
      <div className="mb-6 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-sm">
        <span className="text-blue-500 font-semibold">POST</span>
        <code className="text-blue-800 font-mono text-xs">/api/forms/{id}/submit</code>
        <span className="text-blue-400 text-xs">— send JSON to this endpoint to add a submission</span>
        <button
          className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium"
          onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/api/forms/${id}/submit`)}
        >
          Copy URL
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📭</div>
          <p className="font-medium text-gray-500">No submissions yet</p>
          <p className="text-sm mt-1">Share the form preview link to start collecting data.</p>
          <Link to={`/forms/${id}/preview`} className="btn-primary mt-5 inline-flex">Open form →</Link>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="mb-3">
            <input
              className="input max-w-sm text-sm"
              placeholder="Search submissions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Table */}
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted At</th>
                  {dataFields.map(f => (
                    <th key={f.key} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(sub => (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{fmt(sub.submitted_at)}</td>
                    {dataFields.map(f => {
                      const val = sub.data[f.key]
                      const display = val === undefined || val === null || val === '' ? (
                        <span className="text-gray-300 italic">—</span>
                      ) : typeof val === 'boolean' ? (
                        <span className={val ? 'text-green-600' : 'text-red-500'}>{val ? 'Yes' : 'No'}</span>
                      ) : (
                        <span className="text-gray-800 max-w-xs truncate block" title={String(val)}>{String(val)}</span>
                      )
                      return <td key={f.key} className="px-4 py-3">{display}</td>
                    })}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(sub.id)}
                        disabled={deletingId === sub.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 text-xs p-1"
                        title="Delete submission"
                      >
                        {deletingId === sub.id ? '…' : '🗑'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                No submissions match your search.
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-3 text-right">
            Showing {filtered.length} of {submissions.length} submissions
          </p>
        </>
      )}
    </div>
  )
}
