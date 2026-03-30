import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getForm, submitForm } from '../api'

function FormField({ field, value, onChange, error }) {
  const inputCls = `block w-full px-3 py-2 rounded-lg border text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
    error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
  }`

  switch (field.type) {
    case 'textfield':
    case 'phoneNumber':
      return <input className={inputCls} type="text" placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />
    case 'email':
      return <input className={inputCls} type="email" placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />
    case 'number':
      return <input className={inputCls} type="number" placeholder={field.placeholder} min={field.min} max={field.max} value={value ?? ''} onChange={e => onChange(e.target.value)} />
    case 'password':
      return <input className={inputCls} type="password" placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />
    case 'textarea':
      return <textarea className={`${inputCls} resize-y`} rows={field.rows || 3} placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />
    case 'select':
      return (
        <select className={inputCls} value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">-- select --</option>
          {(field.options || []).map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      )
    case 'radio':
      return (
        <div className="space-y-2 mt-1">
          {(field.options || []).map((o, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="radio" name={field.key} value={o} checked={value === o} onChange={() => onChange(o)} className="text-blue-600" />
              {o}
            </label>
          ))}
        </div>
      )
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="rounded text-blue-600" />
          {field.label}
        </label>
      )
    case 'datetime':
      return <input className={inputCls} type={field.dateOnly ? 'date' : 'datetime-local'} value={value || ''} onChange={e => onChange(e.target.value)} />
    case 'file':
      return (
        <input
          className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          type="file"
          multiple={field.multiple}
          onChange={e => onChange(Array.from(e.target.files).map(f => f.name).join(', '))}
        />
      )
    default:
      return null
  }
}

export default function FormPreview() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showApiInfo, setShowApiInfo] = useState(false)

  useEffect(() => {
    getForm(id)
      .then(({ data }) => setForm(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }))
    setErrors(prev => ({ ...prev, [key]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    try {
      await submitForm(id, values)
      setSubmitted(true)
      setValues({})
    } catch (err) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors)
      } else {
        setSubmitError('Submission failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mr-2" /> Loading…
    </div>
  )

  if (!form) return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <p className="text-red-600 font-medium">Form not found.</p>
      <Link to="/" className="btn-primary mt-4 inline-flex">← Dashboard</Link>
    </div>
  )

  const dataFields = (form.schema?.fields || []).filter(f => !['header', 'paragraph', 'divider'].includes(f.type))
  const allFields = form.schema?.fields || []

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/" className="hover:text-blue-600">Forms</Link>
        <span>/</span>
        <Link to={`/forms/${id}/build`} className="hover:text-blue-600">{form.name}</Link>
        <span>/</span>
        <span className="text-gray-600">Preview</span>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 mb-6">
        <Link to={`/forms/${id}/build`} className="btn-secondary text-sm">✏️ Edit Form</Link>
        <Link to={`/forms/${id}/submissions`} className="btn-secondary text-sm">📊 View Data</Link>
        <button
          onClick={() => { navigator.clipboard?.writeText(window.location.href); alert('Preview URL copied!') }}
          className="btn-ghost text-sm"
        >
          🔗 Copy Link
        </button>
        <button onClick={() => setShowApiInfo(v => !v)} className="ml-auto btn-ghost text-sm text-blue-600">
          {showApiInfo ? '▲ Hide API' : '⚙ API Info'}
        </button>
      </div>

      {/* API Info Panel */}
      {showApiInfo && (
        <div className="mb-6 bg-gray-900 text-green-400 rounded-xl p-5 text-sm font-mono space-y-3">
          <p className="text-gray-400 text-xs uppercase tracking-wide font-sans font-semibold mb-2">Auto-generated REST API</p>
          <div>
            <span className="text-yellow-400">POST</span>
            <span className="text-white ml-2">/api/forms/{id}/submit</span>
            <span className="text-gray-500 ml-2 font-sans text-xs">— submit data</span>
          </div>
          <div>
            <span className="text-blue-400">GET</span>
            <span className="text-white ml-2">/api/forms/{id}/submissions</span>
            <span className="text-gray-500 ml-2 font-sans text-xs">— list submissions</span>
          </div>
          <div>
            <span className="text-blue-400">GET</span>
            <span className="text-white ml-2">/api/forms/{id}/submissions/export</span>
            <span className="text-gray-500 ml-2 font-sans text-xs">— CSV export</span>
          </div>
          {dataFields.length > 0 && (
            <div className="pt-2 border-t border-gray-700">
              <p className="text-gray-400 text-xs font-sans mb-1">Expected JSON body:</p>
              <pre className="text-green-300 text-xs leading-relaxed">{JSON.stringify(
                Object.fromEntries(dataFields.map(f => [f.key, `<${f.type}>`])), null, 2
              )}</pre>
            </div>
          )}
        </div>
      )}

      {/* Form Card */}
      <div className="card p-8 shadow-md">
        {submitted ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Submitted successfully!</h2>
            <p className="text-gray-500 mb-6">Your response has been recorded.</p>
            <div className="flex gap-3 justify-center">
              <button className="btn-primary" onClick={() => setSubmitted(false)}>Submit another</button>
              <Link to={`/forms/${id}/submissions`} className="btn-secondary">View all submissions</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{form.name}</h1>
            {form.description && <p className="text-gray-500 text-sm mb-6">{form.description}</p>}
            {!form.description && <div className="mb-5" />}

            {allFields.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p>This form has no fields yet.</p>
                <Link to={`/forms/${id}/build`} className="btn-primary mt-4 inline-flex">Add fields →</Link>
              </div>
            ) : (
              <div className="space-y-5">
                {allFields.map(field => {
                  const isLayout = ['header', 'paragraph', 'divider'].includes(field.type)

                  if (field.type === 'header') {
                    const Tag = `h${field.level || 2}`
                    return (
                      <Tag key={field.id} className="font-bold text-gray-800 pt-2" style={{ fontSize: field.level === 1 ? '1.5rem' : field.level === 3 ? '1.05rem' : '1.25rem' }}>
                        {field.text}
                      </Tag>
                    )
                  }
                  if (field.type === 'paragraph') {
                    return <p key={field.id} className="text-gray-600 text-sm leading-relaxed">{field.text}</p>
                  }
                  if (field.type === 'divider') {
                    return <hr key={field.id} className="border-gray-200" />
                  }

                  return (
                    <div key={field.id}>
                      {field.type !== 'checkbox' && (
                        <label className="label">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                      )}
                      <FormField
                        field={field}
                        value={values[field.key]}
                        onChange={val => handleChange(field.key, val)}
                        error={errors[field.key]}
                      />
                      {errors[field.key] && (
                        <p className="text-xs text-red-500 mt-1">{errors[field.key]}</p>
                      )}
                      {field.helpText && !errors[field.key] && (
                        <p className="text-xs text-gray-400 mt-1">{field.helpText}</p>
                      )}
                    </div>
                  )
                })}

                {submitError && <p className="text-sm text-red-600">{submitError}</p>}

                <button
                  type="submit"
                  className="btn-primary w-full justify-center py-2.5 mt-2"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
