import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getForm, updateForm } from '../api'
import { FIELD_TYPES, CATEGORIES, createField, getFieldDef, labelToKey } from '../fieldTypes'

// ── Field preview shown inside the canvas card ───────────────────────────────
function FieldPreview({ field }) {
  const cls = 'block w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-500 pointer-events-none'

  switch (field.type) {
    case 'textfield':
    case 'email':
    case 'phoneNumber':
      return <input className={cls} type="text" placeholder={field.placeholder || field.label} disabled />
    case 'number':
      return <input className={cls} type="number" placeholder={field.placeholder || '0'} disabled />
    case 'password':
      return <input className={cls} type="password" placeholder="••••••••" disabled />
    case 'textarea':
      return <textarea className={cls} rows={field.rows || 2} placeholder={field.placeholder || field.label} disabled />
    case 'select':
      return (
        <select className={cls} disabled>
          <option>-- select --</option>
          {(field.options || []).map((o, i) => <option key={i}>{o}</option>)}
        </select>
      )
    case 'radio':
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pointer-events-none">
          {(field.options || []).map((o, i) => (
            <label key={i} className="flex items-center gap-1.5 text-sm text-gray-500">
              <input type="radio" disabled /> {o}
            </label>
          ))}
        </div>
      )
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-gray-500 pointer-events-none">
          <input type="checkbox" disabled /> {field.label}
        </label>
      )
    case 'datetime':
      return <input className={cls} type={field.dateOnly ? 'date' : 'datetime-local'} disabled />
    case 'file':
      return (
        <div className={`${cls} flex items-center gap-2`}>
          <span className="text-xs text-gray-400">📎 Choose file…</span>
        </div>
      )
    case 'header':
      const Tag = `h${field.level || 2}`
      return <Tag className="font-bold text-gray-700 leading-tight pointer-events-none" style={{ fontSize: field.level === 1 ? '1.4rem' : field.level === 3 ? '1rem' : '1.2rem' }}>{field.text}</Tag>
    case 'paragraph':
      return <p className="text-sm text-gray-600 leading-relaxed pointer-events-none">{field.text}</p>
    case 'divider':
      return <hr className="border-gray-300 pointer-events-none" />
    default:
      return <div className="text-xs text-gray-400 italic">Unknown field type: {field.type}</div>
  }
}

// ── Single sortable field card in the canvas ──────────────────────────────────
function SortableFieldCard({ field, isSelected, onSelect, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const isLayout = ['header', 'paragraph', 'divider'].includes(field.type)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(field.id)}
      className={`group relative border rounded-xl bg-white cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.2)]'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-1 rounded z-10"
        onClick={e => e.stopPropagation()}
        title="Drag to reorder"
      >
        ⠿
      </button>

      <div className="pl-8 pr-10 py-3">
        {/* Label row */}
        {!isLayout && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs font-medium text-gray-700">{field.label}</span>
            {field.required && <span className="text-red-500 text-xs">*</span>}
            <span className="ml-auto text-[10px] text-gray-400 font-mono">{field.key}</span>
          </div>
        )}
        <FieldPreview field={field} />
        {field.helpText && <p className="text-xs text-gray-400 mt-1">{field.helpText}</p>}
      </div>

      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(field.id) }}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 text-xs"
        title="Remove field"
      >
        ✕
      </button>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-xl" />
      )}
    </div>
  )
}

// ── Properties panel for a selected field ────────────────────────────────────
function PropertiesPanel({ field, onChange }) {
  if (!field) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 text-gray-400">
        <div className="text-4xl mb-3">👈</div>
        <p className="text-sm font-medium text-gray-500">Select a field to edit its properties</p>
        <p className="text-xs mt-1">Click any field on the canvas</p>
      </div>
    )
  }

  const def = getFieldDef(field.type)
  const isLayout = def?.category === 'Layout'
  const hasOptions = ['select', 'radio'].includes(field.type)

  const set = (key, val) => onChange({ ...field, [key]: val })

  const updateOption = (i, val) => {
    const opts = [...(field.options || [])]
    opts[i] = val
    set('options', opts)
  }
  const addOption = () => set('options', [...(field.options || []), `Option ${(field.options || []).length + 1}`])
  const removeOption = (i) => set('options', field.options.filter((_, idx) => idx !== i))

  return (
    <div className="overflow-y-auto h-full p-4 space-y-4">
      {/* Field type badge */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium uppercase tracking-wide">
          {def?.label || field.type}
        </span>
      </div>

      {/* Layout field: text content */}
      {field.type === 'header' && (
        <>
          <div>
            <label className="label">Header Text</label>
            <input className="input" value={field.text || ''} onChange={e => set('text', e.target.value)} />
          </div>
          <div>
            <label className="label">Level</label>
            <select className="input" value={field.level || 2} onChange={e => set('level', Number(e.target.value))}>
              <option value={1}>H1 — Large</option>
              <option value={2}>H2 — Medium</option>
              <option value={3}>H3 — Small</option>
            </select>
          </div>
        </>
      )}

      {field.type === 'paragraph' && (
        <div>
          <label className="label">Text Content</label>
          <textarea className="input resize-none" rows={4} value={field.text || ''} onChange={e => set('text', e.target.value)} />
        </div>
      )}

      {/* Regular fields */}
      {!isLayout && (
        <>
          <div>
            <label className="label">Label</label>
            <input
              className="input"
              value={field.label || ''}
              onChange={e => {
                const newLabel = e.target.value
                // Auto-update key if it matches the old auto-generated pattern
                set('label', newLabel)
              }}
            />
          </div>

          <div>
            <label className="label">
              API Key
              <span className="ml-1 text-[10px] font-normal text-gray-400">(property name in submissions)</span>
            </label>
            <input
              className="input font-mono text-xs"
              value={field.key || ''}
              onChange={e => set('key', e.target.value.replace(/\s/g, ''))}
            />
          </div>

          {!['checkbox', 'radio', 'select', 'datetime', 'file'].includes(field.type) && (
            <div>
              <label className="label">Placeholder</label>
              <input className="input" value={field.placeholder || ''} onChange={e => set('placeholder', e.target.value)} />
            </div>
          )}

          {field.type === 'textarea' && (
            <div>
              <label className="label">Rows</label>
              <input className="input" type="number" min={1} max={20} value={field.rows || 3} onChange={e => set('rows', Number(e.target.value))} />
            </div>
          )}

          {field.type === 'number' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Min</label>
                <input className="input" type="number" value={field.min ?? ''} onChange={e => set('min', e.target.value)} />
              </div>
              <div>
                <label className="label">Max</label>
                <input className="input" type="number" value={field.max ?? ''} onChange={e => set('max', e.target.value)} />
              </div>
            </div>
          )}

          {field.type === 'datetime' && (
            <div>
              <label className="label">Mode</label>
              <select className="input" value={field.dateOnly ? 'date' : 'datetime'} onChange={e => set('dateOnly', e.target.value === 'date')}>
                <option value="date">Date only</option>
                <option value="datetime">Date & Time</option>
              </select>
            </div>
          )}

          {field.type === 'file' && (
            <div className="flex items-center gap-2">
              <input id="multi" type="checkbox" checked={!!field.multiple} onChange={e => set('multiple', e.target.checked)} className="rounded" />
              <label htmlFor="multi" className="text-sm text-gray-700 cursor-pointer">Allow multiple files</label>
            </div>
          )}

          {/* Options editor */}
          {hasOptions && (
            <div>
              <label className="label">Options</label>
              <div className="space-y-2">
                {(field.options || []).map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="input flex-1" value={opt} onChange={e => updateOption(i, e.target.value)} />
                    <button onClick={() => removeOption(i)} className="text-gray-400 hover:text-red-500 px-2 text-lg leading-none" title="Remove">×</button>
                  </div>
                ))}
              </div>
              <button onClick={addOption} className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add option</button>
            </div>
          )}

          <div>
            <label className="label">Help Text</label>
            <input className="input" value={field.helpText || ''} onChange={e => set('helpText', e.target.value)} placeholder="Optional description below the field" />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="required"
              type="checkbox"
              checked={!!field.required}
              onChange={e => set('required', e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="required" className="text-sm text-gray-700 cursor-pointer">Required field</label>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main FormBuilder page ─────────────────────────────────────────────────────
export default function FormBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [fields, setFields] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [activeId, setActiveId] = useState(null)   // DnD active id
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [activeCategory, setActiveCategory] = useState('Basic Fields')

  // Load form
  useEffect(() => {
    getForm(id)
      .then(({ data }) => {
        setFormName(data.name)
        setFormDesc(data.description || '')
        setFields(data.schema?.fields || [])
      })
      .catch(() => setError('Form not found.'))
      .finally(() => setLoading(false))
  }, [id])

  const selectedField = fields.find(f => f.id === selectedId) || null

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = ({ active }) => setActiveId(active.id)

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (over && active.id !== over.id) {
      setFields(prev => {
        const oldIdx = prev.findIndex(f => f.id === active.id)
        const newIdx = prev.findIndex(f => f.id === over.id)
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  const addField = (type) => {
    const field = createField(type)
    if (!field) return
    setFields(prev => [...prev, field])
    setSelectedId(field.id)
    setSaved(false)
  }

  const removeField = (fieldId) => {
    setFields(prev => prev.filter(f => f.id !== fieldId))
    if (selectedId === fieldId) setSelectedId(null)
    setSaved(false)
  }

  const updateField = useCallback((updated) => {
    setFields(prev => prev.map(f => f.id === updated.id ? updated : f))
    setSaved(false)
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await updateForm(id, { name: formName, description: formDesc, schema: { fields } })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      alert('Save failed. Is the backend running?')
    } finally {
      setSaving(false)
    }
  }

  const filteredTypes = FIELD_TYPES.filter(ft => ft.category === activeCategory)
  const activeField = fields.find(f => f.id === activeId)

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mr-2" /> Loading…
    </div>
  )

  if (error) return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <p className="text-red-600 font-medium">{error}</p>
      <Link to="/" className="btn-primary mt-4 inline-flex">← Back to Dashboard</Link>
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Top toolbar ────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">← Forms</Link>
        <span className="text-gray-300">/</span>

        {editingName ? (
          <input
            className="input py-1 text-sm font-semibold w-48"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
            autoFocus
          />
        ) : (
          <button
            className="text-sm font-semibold text-gray-800 hover:text-blue-600 flex items-center gap-1"
            onClick={() => setEditingName(true)}
          >
            {formName}
            <span className="text-gray-300 text-xs">✎</span>
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
          <Link to={`/forms/${id}/preview`} className="btn-secondary text-xs px-3 py-1.5">
            👁 Preview
          </Link>
          <Link to={`/forms/${id}/submissions`} className="btn-secondary text-xs px-3 py-1.5">
            📊 Data
          </Link>
          <button
            className={`btn text-xs px-4 py-1.5 ${saved ? 'bg-green-600 text-white' : 'btn-primary'}`}
            onClick={save}
            disabled={saving}
          >
            {saving ? '…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
        </div>
      </div>

      {/* ── Three-column layout ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Field Palette */}
        <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Field Types</p>
          </div>
          {/* Category tabs */}
          <div className="flex border-b border-gray-100 text-xs">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-1 py-1.5 font-medium transition-colors ${
                  activeCategory === cat
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {cat === 'Basic Fields' ? 'Basic' : cat === 'Advanced' ? 'Advanced' : 'Layout'}
              </button>
            ))}
          </div>
          <div className="p-2 space-y-1 flex-1">
            {filteredTypes.map(ft => (
              <button
                key={ft.type}
                onClick={() => addField(ft.type)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors group"
                title={`Add ${ft.label}`}
              >
                <span className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 group-hover:bg-blue-100 text-[11px] font-bold text-gray-500 group-hover:text-blue-600 flex-shrink-0">
                  {ft.icon}
                </span>
                <span className="text-xs font-medium">{ft.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Center: Canvas */}
        <main className="flex-1 overflow-y-auto bg-gray-50 px-6 py-6">
          {/* Form header card */}
          <div className="max-w-2xl mx-auto mb-4 bg-white rounded-xl border border-blue-200 p-5 shadow-sm">
            <input
              className="block w-full text-xl font-bold text-gray-900 border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none pb-1 mb-2 bg-transparent"
              value={formName}
              onChange={e => { setFormName(e.target.value); setSaved(false) }}
              placeholder="Form title"
            />
            <input
              className="block w-full text-sm text-gray-500 border-0 focus:outline-none bg-transparent"
              value={formDesc}
              onChange={e => { setFormDesc(e.target.value); setSaved(false) }}
              placeholder="Form description (optional)"
            />
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
              <code className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 font-mono">
                POST /api/forms/{id}/submit
              </code>
              <span className="text-[11px] text-gray-400">← auto-generated API</span>
            </div>
          </div>

          {/* Fields */}
          <div className="max-w-2xl mx-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
                      <div className="text-4xl mb-3">＋</div>
                      <p className="font-medium text-gray-500">Click a field type on the left to add it</p>
                      <p className="text-sm mt-1">Drag fields to reorder them</p>
                    </div>
                  ) : (
                    fields.map(field => (
                      <SortableFieldCard
                        key={field.id}
                        field={field}
                        isSelected={selectedId === field.id}
                        onSelect={setSelectedId}
                        onDelete={removeField}
                      />
                    ))
                  )}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeField ? (
                  <div className="bg-white border-2 border-blue-400 rounded-xl px-4 py-3 shadow-xl opacity-90 max-w-lg">
                    <p className="text-sm font-medium text-gray-700">{activeField.label || activeField.text || activeField.type}</p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {/* Submit button preview */}
            {fields.length > 0 && (
              <div className="mt-3 border border-dashed border-gray-300 rounded-xl p-4 flex items-center justify-between">
                <span className="text-xs text-gray-400">Submit button (always rendered automatically)</span>
                <div className="bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-lg opacity-60 pointer-events-none">
                  Submit
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right: Properties Panel */}
        <aside className="w-72 flex-shrink-0 bg-white border-l border-gray-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-100 flex-shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {selectedField ? 'Field Properties' : 'Properties'}
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <PropertiesPanel field={selectedField} onChange={updateField} />
          </div>
        </aside>
      </div>
    </div>
  )
}
