import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getForm, submitForm } from '../api'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Evaluate a conditional rule against current form values */
function evalConditional(conditional, values) {
  if (!conditional || conditional.show === null || conditional.show === undefined) return true
  if (!conditional.when) return true

  const watchVal = String(values[conditional.when] ?? '')
  const cmpVal   = String(conditional.eq ?? '')
  const op       = conditional.op || 'eq'

  let matches
  switch (op) {
    case 'eq':          matches = watchVal === cmpVal; break
    case 'neq':         matches = watchVal !== cmpVal; break
    case 'contains':    matches = watchVal.includes(cmpVal); break
    case 'startsWith':  matches = watchVal.startsWith(cmpVal); break
    case 'gt':          matches = parseFloat(watchVal) > parseFloat(cmpVal); break
    case 'lt':          matches = parseFloat(watchVal) < parseFloat(cmpVal); break
    case 'isEmpty':     matches = watchVal === '' || watchVal === 'undefined'; break
    case 'isNotEmpty':  matches = watchVal !== '' && watchVal !== 'undefined'; break
    default:            matches = watchVal === cmpVal
  }

  return conditional.show ? matches : !matches
}

/** Run logic rules for a field given current form values, returns property overrides */
function evalLogicRules(field, values) {
  const overrides = {}
  if (!field.logic || field.logic.length === 0) return overrides

  for (const rule of field.logic) {
    if (rule.enabled === false) continue

    let triggered = false
    const t = rule.trigger || {}

    if (t.type === 'always') {
      triggered = true
    } else if (t.type === 'simple') {
      if (t.when) {
        triggered = String(values[t.when] ?? '') === String(t.eq ?? '')
      }
    } else if (t.type === 'javascript') {
      try {
        // eslint-disable-next-line no-new-func
        triggered = new Function('data', t.code || 'return false')(values)
      } catch { /* invalid JS — skip */ }
    }

    if (!triggered) continue

    for (const action of (rule.actions || [])) {
      if (action.type === 'property') {
        overrides[action.property] = action.value === 'true' || action.value === true
      }
    }
  }

  return overrides
}

/** Validate a single field value. Returns an error string or null. */
function validateField(field, value, overrides = {}) {
  if (overrides.hidden) return null   // hidden fields skip validation
  if (overrides.disabled) return null  // disabled fields skip validation

  const v   = { ...field.validate }
  const req = v.required || field.required
  const msg = v.customMessage

  // Empty check
  const isEmpty = value === undefined || value === null || value === '' || value === false

  if (req && isEmpty) return msg || `${field.label} is required`
  if (isEmpty) return null  // no further checks if optional and empty

  const strVal = String(value)

  if (v.minLength && strVal.length < Number(v.minLength))
    return msg || `Minimum ${v.minLength} character${Number(v.minLength)===1?'':'s'} required`

  if (v.maxLength && strVal.length > Number(v.maxLength))
    return msg || `Maximum ${v.maxLength} character${Number(v.maxLength)===1?'':'s'} allowed`

  if (v.min !== '' && v.min !== undefined && v.min !== null && !isNaN(Number(v.min)) && Number(value) < Number(v.min))
    return msg || `Value must be at least ${v.min}`

  if (v.max !== '' && v.max !== undefined && v.max !== null && !isNaN(Number(v.max)) && Number(value) > Number(v.max))
    return msg || `Value must be at most ${v.max}`

  if (v.pattern) {
    try {
      if (!new RegExp(v.pattern).test(strVal)) return msg || 'Invalid format'
    } catch { /* bad regex — skip */ }
  }

  return null
}

// ── Form Field Renderer ────────────────────────────────────────────────────────
function FormField({ field, value, onChange, error, disabled }) {
  const cls = `block w-full px-3 py-2 rounded-lg border text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
    error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
  } ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}`

  switch (field.type) {
    case 'textfield': case 'phoneNumber':
      return <input className={cls} type="text" placeholder={field.placeholder} value={value||''} onChange={e=>onChange(e.target.value)} disabled={disabled}/>
    case 'email':
      return <input className={cls} type="email" placeholder={field.placeholder} value={value||''} onChange={e=>onChange(e.target.value)} disabled={disabled}/>
    case 'number':
      return <input className={cls} type="number" placeholder={field.placeholder}
        min={field.validate?.min||field.min} max={field.validate?.max||field.max}
        value={value??''} onChange={e=>onChange(e.target.value)} disabled={disabled}/>
    case 'password':
      return <input className={cls} type="password" placeholder={field.placeholder} value={value||''} onChange={e=>onChange(e.target.value)} disabled={disabled}/>
    case 'textarea':
      return <textarea className={`${cls} resize-y`} rows={field.rows||3} placeholder={field.placeholder} value={value||''} onChange={e=>onChange(e.target.value)} disabled={disabled}/>
    case 'select':
      return (
        <select className={cls} value={value||''} onChange={e=>onChange(e.target.value)} disabled={disabled}>
          <option value="">-- select --</option>
          {(field.options||[]).map((o,i)=><option key={i} value={o}>{o}</option>)}
        </select>
      )
    case 'radio':
      return (
        <div className="space-y-2 mt-1">
          {(field.options||[]).map((o,i)=>(
            <label key={i} className={`flex items-center gap-2 cursor-pointer text-sm text-gray-700 ${disabled?'opacity-60':''}`}>
              <input type="radio" name={field.key} value={o} checked={value===o} onChange={()=>onChange(o)} className="text-blue-600" disabled={disabled}/>
              {o}
            </label>
          ))}
        </div>
      )
    case 'checkbox':
      return (
        <label className={`flex items-center gap-2 cursor-pointer text-sm text-gray-700 ${disabled?'opacity-60':''}`}>
          <input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked)} className="rounded text-blue-600" disabled={disabled}/>
          {field.label}
        </label>
      )
    case 'datetime':
      return <input className={cls} type={field.dateOnly?'date':'datetime-local'} value={value||''} onChange={e=>onChange(e.target.value)} disabled={disabled}/>
    case 'file':
      return (
        <input className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          type="file" multiple={field.multiple} onChange={e=>onChange(Array.from(e.target.files).map(f=>f.name).join(', '))} disabled={disabled}/>
      )
    default: return null
  }
}

// ── Main Preview Page ──────────────────────────────────────────────────────────
export default function FormPreview() {
  const { id } = useParams()
  const [form, setForm]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [values, setValues]       = useState({})
  const [errors, setErrors]       = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showApiInfo, setShowApiInfo] = useState(false)

  useEffect(() => {
    getForm(id)
      .then(({ data }) => {
        setForm(data)
        // Seed default values from API tab + localStorage persistence
        const defaults = {}
        for (const field of (data.schema?.fields || [])) {
          if (!field.key) continue
          if (field.api?.persistent) {
            const saved = localStorage.getItem(`fbld_${id}_${field.key}`)
            if (saved !== null) { defaults[field.key] = JSON.parse(saved); continue }
          }
          if (field.api?.defaultValue) {
            const dv = field.api.defaultValue === 'today'
              ? new Date().toISOString().split('T')[0]
              : field.api.defaultValue
            defaults[field.key] = dv
          }
        }
        setValues(defaults)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  // Compute per-field logic overrides (required/disabled/hidden via Logic rules)
  const logicOverrides = useCallback((fields, vals) => {
    const result = {}
    for (const f of fields) {
      result[f.id] = evalLogicRules(f, vals)
    }
    return result
  }, [])

  const allFields   = form?.schema?.fields || []
  const overrides   = logicOverrides(allFields, values)

  // Determine visible fields (Conditional + logic hidden)
  const visibleIds = new Set(
    allFields
      .filter(f => {
        const logicHidden = overrides[f.id]?.hidden === true
        if (logicHidden) return false
        return evalConditional(f.conditional, values)
      })
      .map(f => f.id)
  )

  const handleChange = (key, val, fieldId) => {
    setValues(prev => {
      const next = { ...prev, [key]: val }

      // Clear values of fields that become hidden and have clearOnHide
      for (const f of allFields) {
        if (!f.key || f.id === fieldId) continue
        const willHide = !evalConditional(f.conditional, next) || evalLogicRules(f, next).hidden
        if (willHide && f.api?.clearOnHide !== false && prev[f.key] !== undefined) {
          next[f.key] = ''
        }
      }

      // Persist if enabled
      const field = allFields.find(f => f.key === key)
      if (field?.api?.persistent) {
        try { localStorage.setItem(`fbld_${id}_${key}`, JSON.stringify(val)) } catch {}
      }

      return next
    })
    setErrors(prev => ({ ...prev, [key]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Validate all visible fields
    const newErrors = {}
    for (const field of allFields) {
      if (!field.key || !visibleIds.has(field.id)) continue
      const err = validateField(field, values[field.key], overrides[field.id] || {})
      if (err) newErrors[field.key] = err
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    setSubmitting(true)
    setSubmitError('')
    try {
      // Strip protected fields before sending
      const payload = {}
      for (const field of allFields) {
        if (!field.key || !visibleIds.has(field.id)) continue
        if (field.api?.protected) continue
        payload[field.key] = values[field.key] ?? ''
      }
      await submitForm(id, payload)
      setSubmitted(true)
      setValues({})
    } catch (err) {
      if (err.response?.data?.errors) setErrors(err.response.data.errors)
      else setSubmitError('Submission failed. Please try again.')
    } finally { setSubmitting(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mr-2"/>Loading…
    </div>
  )
  if (!form) return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <p className="text-red-600 font-medium">Form not found.</p>
      <Link to="/" className="btn-primary mt-4 inline-flex">← Dashboard</Link>
    </div>
  )

  const dataFields = allFields.filter(f => f.key)

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
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Link to={`/forms/${id}/build`} className="btn-secondary text-sm">✏️ Edit</Link>
        <Link to={`/forms/${id}/submissions`} className="btn-secondary text-sm">📊 Data</Link>
        <button onClick={()=>{ navigator.clipboard?.writeText(window.location.href) }} className="btn-ghost text-sm">🔗 Copy Link</button>
        <button onClick={()=>setShowApiInfo(v=>!v)} className="ml-auto btn-ghost text-sm text-blue-600">
          {showApiInfo ? '▲ Hide API' : '⚙ API Info'}
        </button>
      </div>

      {/* API Info Panel */}
      {showApiInfo && (
        <div className="mb-6 bg-gray-900 text-green-400 rounded-xl p-5 text-sm font-mono space-y-3">
          <p className="text-gray-400 text-xs uppercase tracking-wide font-sans font-semibold mb-2">Auto-generated REST API</p>
          <div><span className="text-yellow-400">POST</span><span className="text-white ml-2">/api/forms/{id}/submit</span><span className="text-gray-500 ml-2 font-sans text-xs">— submit data</span></div>
          <div><span className="text-blue-400">GET</span><span className="text-white ml-2">/api/forms/{id}/submissions</span><span className="text-gray-500 ml-2 font-sans text-xs">— list submissions</span></div>
          <div><span className="text-blue-400">GET</span><span className="text-white ml-2">/api/forms/{id}/submissions/export</span><span className="text-gray-500 ml-2 font-sans text-xs">— CSV export</span></div>
          {dataFields.length > 0 && (
            <div className="pt-2 border-t border-gray-700">
              <p className="text-gray-400 text-xs font-sans mb-1">Payload schema ({dataFields.filter(f=>!f.api?.protected).length} fields):</p>
              <pre className="text-green-300 text-xs leading-relaxed overflow-x-auto">{JSON.stringify(
                Object.fromEntries(dataFields.filter(f=>!f.api?.protected).map(f=>[f.key, `<${f.type}>`])), null, 2
              )}</pre>
              {dataFields.some(f=>f.api?.protected) && (
                <p className="text-gray-500 text-xs mt-2">🔒 Protected fields excluded: {dataFields.filter(f=>f.api?.protected).map(f=>f.key).join(', ')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Form card */}
      <div className="card p-8 shadow-md">
        {submitted ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Submitted successfully!</h2>
            <p className="text-gray-500 mb-6">Your response has been recorded.</p>
            <div className="flex gap-3 justify-center">
              <button className="btn-primary" onClick={()=>setSubmitted(false)}>Submit another</button>
              <Link to={`/forms/${id}/submissions`} className="btn-secondary">View submissions</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{form.name}</h1>
            {form.description && <p className="text-gray-500 text-sm mb-6">{form.description}</p>}
            {!form.description && <div className="mb-5"/>}

            {allFields.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p>This form has no fields yet.</p>
                <Link to={`/forms/${id}/build`} className="btn-primary mt-4 inline-flex">Add fields →</Link>
              </div>
            ) : (
              <div className="space-y-5">
                {allFields.map(field => {
                  // Skip hidden fields
                  if (!visibleIds.has(field.id)) return null

                  const fieldOverride = overrides[field.id] || {}
                  const isDisabled    = !!fieldOverride.disabled
                  const isRequired    = (field.required || field.validate?.required || !!fieldOverride.required)

                  // Layout elements
                  if (field.type === 'header') {
                    const Tag = `h${field.level||2}`
                    return <Tag key={field.id} className="font-bold text-gray-800 pt-2" style={{fontSize:field.level===1?'1.5rem':field.level===3?'1.05rem':'1.25rem'}}>{field.text}</Tag>
                  }
                  if (field.type === 'paragraph') return <p key={field.id} className="text-gray-600 text-sm leading-relaxed">{field.text}</p>
                  if (field.type === 'divider')   return <hr key={field.id} className="border-gray-200"/>

                  return (
                    <div key={field.id}>
                      {field.type !== 'checkbox' && (
                        <label className={`label ${isDisabled?'opacity-60':''}`}>
                          {field.label}
                          {isRequired && <span className="text-red-500 ml-0.5">*</span>}
                          {fieldOverride.required && !field.required && !field.validate?.required && (
                            <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-normal">required by logic</span>
                          )}
                          {isDisabled && <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-normal">disabled</span>}
                        </label>
                      )}
                      <FormField
                        field={field}
                        value={values[field.key]}
                        onChange={val => handleChange(field.key, val, field.id)}
                        error={errors[field.key]}
                        disabled={isDisabled}
                      />
                      {errors[field.key] && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <span>⚠</span>{errors[field.key]}
                        </p>
                      )}
                      {field.helpText && !errors[field.key] && (
                        <p className="text-xs text-gray-400 mt-1">{field.helpText}</p>
                      )}
                    </div>
                  )
                })}

                {submitError && <p className="text-sm text-red-600 flex items-center gap-1"><span>⚠</span>{submitError}</p>}

                <button type="submit" className="btn-primary w-full justify-center py-2.5 mt-2" disabled={submitting}>
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
