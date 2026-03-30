import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getForms, createForm, deleteForm } from '../api'

function NewFormModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Form name is required'); return }
    setLoading(true)
    try {
      const { data } = await createForm({ name: name.trim(), description })
      onCreate(data)
    } catch {
      setError('Failed to create form. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-gray-900 mb-5">Create New Form</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Form Name *</label>
            <input
              className="input"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="e.g. Contact Us, Job Application…"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              className="input resize-none"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this form for?"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Creating…' : 'Create Form'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FormCard({ form, onDelete }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    try {
      await deleteForm(form.id)
      onDelete(form.id)
    } catch {
      setDeleting(false)
      setConfirming(false)
    }
  }

  const fmt = (iso) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="card hover:shadow-md transition-shadow group flex flex-col">
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2">{form.name}</h3>
          <span className="flex-shrink-0 bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            {form.submissionCount} {form.submissionCount === 1 ? 'submission' : 'submissions'}
          </span>
        </div>
        {form.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{form.description}</p>
        )}
        <p className="text-xs text-gray-400">Updated {fmt(form.updated_at)}</p>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-2">
        <Link
          to={`/forms/${form.id}/build`}
          className="btn-primary text-xs px-3 py-1.5"
          onClick={e => e.stopPropagation()}
        >
          ✏️ Edit
        </Link>
        <Link
          to={`/forms/${form.id}/preview`}
          className="btn-secondary text-xs px-3 py-1.5"
          onClick={e => e.stopPropagation()}
        >
          👁 Preview
        </Link>
        <Link
          to={`/forms/${form.id}/submissions`}
          className="btn-secondary text-xs px-3 py-1.5"
          onClick={e => e.stopPropagation()}
        >
          📊 Data
        </Link>
        <button
          className={`ml-auto btn text-xs px-3 py-1.5 ${confirming ? 'bg-red-600 text-white hover:bg-red-700' : 'btn-ghost text-red-500 hover:bg-red-50'}`}
          onClick={handleDelete}
          disabled={deleting}
          onBlur={() => setConfirming(false)}
        >
          {deleting ? '…' : confirming ? 'Confirm?' : '🗑'}
        </button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getForms()
      .then(({ data }) => setForms(data))
      .catch(() => setError('Could not load forms. Make sure the backend is running on port 3001.'))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = (form) => {
    setShowModal(false)
    navigate(`/forms/${form.id}/build`)
  }

  const handleDelete = (id) => setForms(prev => prev.filter(f => f.id !== id))

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Forms</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Build forms visually — each form gets its own REST API automatically.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <span className="text-base leading-none">+</span> New Form
        </button>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3" />
          Loading forms…
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium">{error}</p>
          <p className="text-red-500 text-sm mt-1">Run <code className="bg-red-100 px-1 rounded">npm run dev</code> in the <code className="bg-red-100 px-1 rounded">backend/</code> folder.</p>
        </div>
      )}

      {!loading && !error && forms.length === 0 && (
        <div className="text-center py-24">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No forms yet</h2>
          <p className="text-gray-400 mb-6">Create your first form and get a REST API in seconds.</p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Create your first form
          </button>
        </div>
      )}

      {!loading && !error && forms.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {forms.map(form => (
            <FormCard key={form.id} form={form} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showModal && <NewFormModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </div>
  )
}
