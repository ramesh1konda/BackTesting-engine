import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getForm, updateForm } from '../api'
import { FIELD_TYPES, CATEGORIES, createField, getFieldDef } from '../fieldTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────
const setNested = (obj, path, val) => ({ ...obj, [path]: val })

// ── Field canvas preview ───────────────────────────────────────────────────────
function FieldPreview({ field }) {
  const cls = 'block w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-500 pointer-events-none'
  switch (field.type) {
    case 'textfield': case 'email': case 'phoneNumber':
      return <input className={cls} type="text" placeholder={field.placeholder || field.label} disabled />
    case 'number':
      return <input className={cls} type="number" placeholder={field.placeholder || '0'} disabled />
    case 'password':
      return <input className={cls} type="password" placeholder="••••••••" disabled />
    case 'textarea':
      return <textarea className={cls} rows={field.rows || 2} placeholder={field.placeholder || field.label} disabled />
    case 'select':
      return <select className={cls} disabled><option>-- select --</option>{(field.options||[]).map((o,i)=><option key={i}>{o}</option>)}</select>
    case 'radio':
      return <div className="flex flex-wrap gap-x-4 gap-y-1 pointer-events-none">{(field.options||[]).map((o,i)=><label key={i} className="flex items-center gap-1.5 text-sm text-gray-500"><input type="radio" disabled/>{o}</label>)}</div>
    case 'checkbox':
      return <label className="flex items-center gap-2 text-sm text-gray-500 pointer-events-none"><input type="checkbox" disabled/>{field.label}</label>
    case 'datetime':
      return <input className={cls} type={field.dateOnly?'date':'datetime-local'} disabled/>
    case 'file':
      return <div className={`${cls} flex items-center gap-2`}><span className="text-xs text-gray-400">📎 Choose file…</span></div>
    case 'header':
      const Tag = `h${field.level||2}`
      return <Tag className="font-bold text-gray-700 leading-tight pointer-events-none" style={{fontSize:field.level===1?'1.4rem':field.level===3?'1rem':'1.2rem'}}>{field.text}</Tag>
    case 'paragraph':
      return <p className="text-sm text-gray-600 leading-relaxed pointer-events-none">{field.text}</p>
    case 'divider':
      return <hr className="border-gray-300 pointer-events-none"/>
    default:
      return <div className="text-xs text-gray-400 italic">Unknown field: {field.type}</div>
  }
}

// ── Sortable card ──────────────────────────────────────────────────────────────
function SortableFieldCard({ field, isSelected, onSelect, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const isLayout = ['header','paragraph','divider'].includes(field.type)
  const hasConditional = field.conditional?.show !== null && field.conditional?.show !== undefined
  const hasLogic = field.logic?.length > 0

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onClick={() => onSelect(field.id)}
      className={`group relative border rounded-xl bg-white cursor-pointer transition-all ${isSelected ? 'border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.2)]' : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'}`}>
      <button {...attributes} {...listeners} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-1 rounded z-10" onClick={e=>e.stopPropagation()}>⠿</button>
      <div className="pl-8 pr-10 py-3">
        {!isLayout && (
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className="text-xs font-medium text-gray-700">{field.label}</span>
            {(field.required || field.validate?.required) && <span className="text-red-500 text-xs">*</span>}
            {hasConditional && <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">conditional</span>}
            {hasLogic && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">logic</span>}
            <span className="ml-auto text-[10px] text-gray-400 font-mono">{field.key}</span>
          </div>
        )}
        <FieldPreview field={field}/>
        {field.helpText && <p className="text-xs text-gray-400 mt-1">{field.helpText}</p>}
      </div>
      <button onClick={e=>{e.stopPropagation();onDelete(field.id)}} className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 text-xs">✕</button>
      {isSelected && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-xl"/>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PROPERTY TABS
// ══════════════════════════════════════════════════════════════════════════════

// ── Display Tab ────────────────────────────────────────────────────────────────
function DisplayTab({ field, onChange }) {
  const def = getFieldDef(field.type)
  const isLayout = def?.category === 'Layout'
  const hasOptions = ['select','radio'].includes(field.type)
  const set = (k, v) => onChange({ ...field, [k]: v })

  const updateOption = (i, val) => { const opts=[...(field.options||[])]; opts[i]=val; set('options',opts) }
  const addOption = () => set('options', [...(field.options||[]), `Option ${(field.options||[]).length+1}`])
  const removeOption = (i) => set('options', field.options.filter((_,idx)=>idx!==i))

  return (
    <div className="space-y-4">
      {field.type==='header' && (
        <>
          <div><label className="label">Header Text</label><input className="input" value={field.text||''} onChange={e=>set('text',e.target.value)}/></div>
          <div><label className="label">Level</label>
            <select className="input" value={field.level||2} onChange={e=>set('level',Number(e.target.value))}>
              <option value={1}>H1 — Large</option><option value={2}>H2 — Medium</option><option value={3}>H3 — Small</option>
            </select>
          </div>
        </>
      )}
      {field.type==='paragraph' && (
        <div><label className="label">Text Content</label><textarea className="input resize-none" rows={4} value={field.text||''} onChange={e=>set('text',e.target.value)}/></div>
      )}

      {!isLayout && (
        <>
          <div><label className="label">Label</label><input className="input" value={field.label||''} onChange={e=>set('label',e.target.value)}/></div>
          {!['checkbox','radio','select','datetime','file'].includes(field.type) && (
            <div><label className="label">Placeholder</label><input className="input" value={field.placeholder||''} onChange={e=>set('placeholder',e.target.value)}/></div>
          )}
          {field.type==='textarea' && (
            <div><label className="label">Rows</label><input className="input" type="number" min={1} max={20} value={field.rows||3} onChange={e=>set('rows',Number(e.target.value))}/></div>
          )}
          {field.type==='datetime' && (
            <div><label className="label">Mode</label>
              <select className="input" value={field.dateOnly?'date':'datetime'} onChange={e=>set('dateOnly',e.target.value==='date')}>
                <option value="date">Date only</option><option value="datetime">Date & Time</option>
              </select>
            </div>
          )}
          {field.type==='file' && (
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!field.multiple} onChange={e=>set('multiple',e.target.checked)} className="rounded"/><span className="text-sm text-gray-700">Allow multiple files</span></label>
          )}
          {hasOptions && (
            <div>
              <label className="label">Options</label>
              <div className="space-y-2">
                {(field.options||[]).map((opt,i)=>(
                  <div key={i} className="flex gap-2">
                    <input className="input flex-1" value={opt} onChange={e=>updateOption(i,e.target.value)}/>
                    <button onClick={()=>removeOption(i)} className="text-gray-400 hover:text-red-500 px-2 text-lg leading-none">×</button>
                  </div>
                ))}
              </div>
              <button onClick={addOption} className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add option</button>
            </div>
          )}
          <div><label className="label">Help Text</label><input className="input" value={field.helpText||''} onChange={e=>set('helpText',e.target.value)} placeholder="Optional hint below the field"/></div>
          <div className="flex items-center gap-2 pt-1">
            <input id="req" type="checkbox" checked={!!field.required} onChange={e=>{set('required',e.target.checked); onChange({...field, required:e.target.checked, validate:{...(field.validate||{}), required:e.target.checked}})}} className="rounded"/>
            <label htmlFor="req" className="text-sm text-gray-700 cursor-pointer">Required field</label>
          </div>
        </>
      )}
    </div>
  )
}

// ── Validation Tab ─────────────────────────────────────────────────────────────
const PATTERN_PRESETS = [
  { label: 'None', value: '' },
  { label: 'Email address', value: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
  { label: 'URL', value: 'https?://.+' },
  { label: 'Alphanumeric only', value: '^[a-zA-Z0-9]+$' },
  { label: 'Numbers only', value: '^[0-9]+$' },
  { label: 'Letters only', value: '^[a-zA-Z]+$' },
  { label: 'Phone (US)', value: '^\\+?1?\\s?\\(?[0-9]{3}\\)?[\\s.-]?[0-9]{3}[\\s.-]?[0-9]{4}$' },
  { label: 'Custom…', value: '__custom__' },
]

function ValidationTab({ field, onChange }) {
  const v = field.validate || {}
  const setV = (k, val) => onChange({ ...field, validate: { ...v, [k]: val }, ...(k==='required' ? {required:val} : {}) })
  const isText = ['textfield','email','phoneNumber','password','textarea'].includes(field.type)
  const isNumber = field.type === 'number'

  const currentPattern = v.pattern || ''
  const presetMatch = PATTERN_PRESETS.find(p => p.value === currentPattern && p.value !== '__custom__')
  const [patternMode, setPatternMode] = useState(
    currentPattern === '' ? '' : (presetMatch ? currentPattern : '__custom__')
  )

  const handlePatternSelect = (val) => {
    setPatternMode(val)
    if (val !== '__custom__') setV('pattern', val)
  }

  return (
    <div className="space-y-4">
      {/* Required */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
        <input id="v-req" type="checkbox" checked={!!v.required} onChange={e=>setV('required',e.target.checked)} className="rounded"/>
        <label htmlFor="v-req" className="text-sm font-medium text-gray-700 cursor-pointer">Required field</label>
      </div>

      {/* Text length */}
      {isText && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Length</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Min Length</label><input className="input" type="number" min="0" value={v.minLength||''} onChange={e=>setV('minLength',e.target.value)} placeholder="0"/></div>
            <div><label className="label">Max Length</label><input className="input" type="number" min="0" value={v.maxLength||''} onChange={e=>setV('maxLength',e.target.value)} placeholder="∞"/></div>
          </div>
        </div>
      )}

      {/* Number range */}
      {isNumber && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Range</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Min Value</label><input className="input" type="number" value={v.min??''} onChange={e=>setV('min',e.target.value)}/></div>
            <div><label className="label">Max Value</label><input className="input" type="number" value={v.max??''} onChange={e=>setV('max',e.target.value)}/></div>
          </div>
        </div>
      )}

      {/* Pattern */}
      {isText && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pattern</p>
          <div>
            <label className="label">Preset</label>
            <select className="input" value={patternMode} onChange={e=>handlePatternSelect(e.target.value)}>
              {PATTERN_PRESETS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {patternMode === '__custom__' && (
            <div>
              <label className="label">Custom Regex</label>
              <input className="input font-mono text-xs" value={v.pattern||''} onChange={e=>setV('pattern',e.target.value)} placeholder="^[a-z]+$"/>
              <p className="text-xs text-gray-400 mt-1">JavaScript regex without slashes</p>
            </div>
          )}
          {patternMode && patternMode !== '__custom__' && (
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs font-mono text-gray-500 break-all">{v.pattern}</div>
          )}
        </div>
      )}

      {/* Unique */}
      <div className="flex items-center gap-2">
        <input id="v-unique" type="checkbox" checked={!!v.unique} onChange={e=>setV('unique',e.target.checked)} className="rounded"/>
        <label htmlFor="v-unique" className="text-sm text-gray-700 cursor-pointer">Unique (reject duplicate values)</label>
      </div>

      {/* Custom error message */}
      <div>
        <label className="label">Custom Error Message</label>
        <input className="input" value={v.customMessage||''} onChange={e=>setV('customMessage',e.target.value)} placeholder="Leave blank to use default"/>
      </div>

      {/* Summary */}
      {(v.required || v.minLength || v.maxLength || v.pattern || v.min || v.max || v.unique) && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
          <p className="text-xs font-semibold text-blue-700 mb-1">Active Rules</p>
          {v.required && <p className="text-xs text-blue-600">✓ Required</p>}
          {v.minLength && <p className="text-xs text-blue-600">✓ Min length: {v.minLength}</p>}
          {v.maxLength && <p className="text-xs text-blue-600">✓ Max length: {v.maxLength}</p>}
          {v.min && <p className="text-xs text-blue-600">✓ Min value: {v.min}</p>}
          {v.max && <p className="text-xs text-blue-600">✓ Max value: {v.max}</p>}
          {v.pattern && <p className="text-xs text-blue-600">✓ Pattern match</p>}
          {v.unique && <p className="text-xs text-blue-600">✓ Unique</p>}
        </div>
      )}
    </div>
  )
}

// ── API Tab ────────────────────────────────────────────────────────────────────
function ApiTab({ field, onChange }) {
  const a = field.api || {}
  const setA = (k, val) => onChange({ ...field, api: { ...a, [k]: val } })
  const setKey = (val) => onChange({ ...field, key: val.replace(/[^a-zA-Z0-9_]/g,'') })

  const apiEndpoint = `/api/forms/{formId}/submit`

  return (
    <div className="space-y-4">
      {/* Property name */}
      <div>
        <label className="label">Property Name <span className="text-gray-400 font-normal">(API key)</span></label>
        <input className="input font-mono text-xs" value={field.key||''} onChange={e=>setKey(e.target.value)}/>
        <p className="text-xs text-gray-400 mt-1">JSON field name used in submission payloads</p>
      </div>

      {/* Default value */}
      <div>
        <label className="label">Default Value</label>
        <input className="input" value={a.defaultValue||''} onChange={e=>setA('defaultValue',e.target.value)} placeholder="Pre-fill on form load"/>
        <p className="text-xs text-gray-400 mt-1">Can use <code className="bg-gray-100 px-1 rounded">today</code> for current date</p>
      </div>

      {/* Flags */}
      <div className="space-y-2.5 pt-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Behaviour</p>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" className="mt-0.5 rounded" checked={!!a.persistent} onChange={e=>setA('persistent',e.target.checked)}/>
          <span className="text-sm text-gray-700">
            <span className="font-medium">Persistent</span>
            <span className="block text-xs text-gray-400">Save & restore value from localStorage</span>
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" className="mt-0.5 rounded" checked={!!a.protected} onChange={e=>setA('protected',e.target.checked)}/>
          <span className="text-sm text-gray-700">
            <span className="font-medium">Protected</span>
            <span className="block text-xs text-gray-400">Exclude this field from API responses</span>
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" className="mt-0.5 rounded" checked={a.clearOnHide!==false} onChange={e=>setA('clearOnHide',e.target.checked)}/>
          <span className="text-sm text-gray-700">
            <span className="font-medium">Clear on hide</span>
            <span className="block text-xs text-gray-400">Clear value when field is hidden by a condition</span>
          </span>
        </label>
      </div>

      {/* Sample payload */}
      {field.key && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sample Payload</p>
          <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono text-green-400">
            <span className="text-gray-500">POST {apiEndpoint}</span>
            {'\n\n'}
            <span className="text-white">{'{ '}</span>
            <span className="text-yellow-300">"{field.key}"</span>
            <span className="text-white">: </span>
            <span className="text-green-300">"{a.defaultValue || '<value>'}"</span>
            <span className="text-white">{' }'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Conditional Tab ────────────────────────────────────────────────────────────
const COND_OPS = [
  { value: 'eq',          label: 'is equal to' },
  { value: 'neq',         label: 'is not equal to' },
  { value: 'contains',    label: 'contains' },
  { value: 'startsWith',  label: 'starts with' },
  { value: 'gt',          label: 'is greater than' },
  { value: 'lt',          label: 'is less than' },
  { value: 'isEmpty',     label: 'is empty' },
  { value: 'isNotEmpty',  label: 'is not empty' },
]

function ConditionalTab({ field, onChange, allFields }) {
  const c = field.conditional || {}
  const setC = (k, v) => onChange({ ...field, conditional: { ...c, [k]: v } })
  const dataFields = allFields.filter(f => f.key && f.id !== field.id)
  const noValueOp = ['isEmpty','isNotEmpty'].includes(c.op)
  const watchField = dataFields.find(f => f.key === c.when)

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Visibility</label>
        <select className="input"
          value={c.show===null||c.show===undefined ? 'always' : c.show ? 'show' : 'hide'}
          onChange={e => { const v=e.target.value; setC('show', v==='always' ? null : v==='show') }}>
          <option value="always">Always visible</option>
          <option value="show">Show when condition is met</option>
          <option value="hide">Hide when condition is met</option>
        </select>
      </div>

      {c.show !== null && c.show !== undefined && (
        <>
          <div>
            <label className="label">Watch Field</label>
            <select className="input" value={c.when||''} onChange={e=>setC('when',e.target.value)}>
              <option value="">-- select a field --</option>
              {dataFields.map(f=><option key={f.id} value={f.key}>{f.label} ({f.key})</option>)}
            </select>
          </div>

          <div>
            <label className="label">Condition</label>
            <select className="input" value={c.op||'eq'} onChange={e=>setC('op',e.target.value)}>
              {COND_OPS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {!noValueOp && (
            <div>
              <label className="label">Value</label>
              {watchField?.type === 'select' || watchField?.type === 'radio' ? (
                <select className="input" value={c.eq||''} onChange={e=>setC('eq',e.target.value)}>
                  <option value="">-- any --</option>
                  {(watchField.options||[]).map((o,i)=><option key={i} value={o}>{o}</option>)}
                </select>
              ) : (
                <input className="input" value={c.eq||''} onChange={e=>setC('eq',e.target.value)} placeholder="Comparison value"/>
              )}
            </div>
          )}

          {/* Human-readable summary */}
          <div className={`rounded-lg p-3 text-xs font-medium border ${c.show ? 'bg-green-50 border-green-200 text-green-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
            <span className="font-semibold">{c.show ? '👁 Show' : '🙈 Hide'}</span> this field when{' '}
            <span className="font-semibold">"{watchField?.label || c.when || '…'}"</span>{' '}
            {COND_OPS.find(o=>o.value===(c.op||'eq'))?.label}{' '}
            {!noValueOp && <span className="font-semibold">"{c.eq||'…'}"</span>}
          </div>

          {!c.when && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2">⚠ Select a field to watch to activate this condition.</p>
          )}
        </>
      )}

      {(c.show === null || c.show === undefined) && (
        <div className="text-center py-6 text-gray-400">
          <div className="text-3xl mb-2">👁</div>
          <p className="text-sm">This field is always visible.</p>
          <p className="text-xs mt-1">Change visibility above to add a condition.</p>
        </div>
      )}
    </div>
  )
}

// ── Logic Tab ──────────────────────────────────────────────────────────────────
const LOGIC_TRIGGER_TYPES = [
  { value: 'simple',    label: 'Simple (field equals value)' },
  { value: 'always',    label: 'Always (on any change)' },
  { value: 'javascript', label: 'JavaScript' },
]

const LOGIC_ACTION_TYPES = [
  { value: 'property', label: 'Set property' },
  { value: 'value',    label: 'Set value' },
  { value: 'clear',    label: 'Clear value' },
]

const LOGIC_PROPERTIES = [
  { value: 'required',  label: 'Required' },
  { value: 'disabled',  label: 'Disabled' },
  { value: 'hidden',    label: 'Hidden' },
]

function LogicTab({ field, onChange, allFields }) {
  const logic = field.logic || []
  const dataFields = allFields.filter(f => f.key)

  const setLogic = (newLogic) => onChange({ ...field, logic: newLogic })

  const addRule = () => setLogic([...logic, {
    id: `rule_${Date.now()}`,
    name: `Rule ${logic.length + 1}`,
    enabled: true,
    trigger: { type: 'simple', when: '', eq: '' },
    actions: [{ id: `act_${Date.now()}`, type: 'property', property: 'required', value: 'true' }],
  }])

  const updateRule = (ruleId, updates) => setLogic(logic.map(r => r.id===ruleId ? {...r,...updates} : r))
  const removeRule = (ruleId) => setLogic(logic.filter(r => r.id!==ruleId))

  const updateTrigger = (ruleId, updates) => updateRule(ruleId, { trigger: { ...logic.find(r=>r.id===ruleId)?.trigger, ...updates } })

  const addAction = (ruleId) => {
    const rule = logic.find(r=>r.id===ruleId)
    updateRule(ruleId, { actions: [...(rule?.actions||[]), { id:`act_${Date.now()}`, type:'property', property:'required', value:'true' }] })
  }
  const updateAction = (ruleId, actId, updates) => {
    const rule = logic.find(r=>r.id===ruleId)
    updateRule(ruleId, { actions: (rule?.actions||[]).map(a => a.id===actId ? {...a,...updates} : a) })
  }
  const removeAction = (ruleId, actId) => {
    const rule = logic.find(r=>r.id===ruleId)
    updateRule(ruleId, { actions: (rule?.actions||[]).filter(a=>a.id!==actId) })
  }

  if (logic.length === 0) return (
    <div className="space-y-4">
      <div className="text-center py-8 text-gray-400">
        <div className="text-4xl mb-3">⚡</div>
        <p className="text-sm font-medium text-gray-500">No logic rules yet</p>
        <p className="text-xs mt-1 text-gray-400">Add rules to dynamically change this field's behaviour</p>
      </div>
      <button onClick={addRule} className="btn-primary w-full justify-center">+ Add Logic Rule</button>
    </div>
  )

  return (
    <div className="space-y-4">
      {logic.map((rule, ri) => (
        <div key={rule.id} className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Rule header */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-200">
            <input
              className="flex-1 text-xs font-semibold bg-transparent border-0 focus:outline-none text-gray-700"
              value={rule.name} onChange={e=>updateRule(rule.id,{name:e.target.value})}
            />
            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={rule.enabled!==false} onChange={e=>updateRule(rule.id,{enabled:e.target.checked})} className="rounded"/>
              On
            </label>
            <button onClick={()=>removeRule(rule.id)} className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
          </div>

          <div className="p-3 space-y-3">
            {/* Trigger */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Trigger</p>
              <select className="input mb-2" value={rule.trigger?.type||'simple'} onChange={e=>updateTrigger(rule.id,{type:e.target.value})}>
                {LOGIC_TRIGGER_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {rule.trigger?.type==='simple' && (
                <div className="grid grid-cols-2 gap-2">
                  <select className="input text-xs" value={rule.trigger.when||''} onChange={e=>updateTrigger(rule.id,{when:e.target.value})}>
                    <option value="">-- field --</option>
                    {dataFields.map(f=><option key={f.id} value={f.key}>{f.label}</option>)}
                  </select>
                  <input className="input text-xs" placeholder="equals value…" value={rule.trigger.eq||''} onChange={e=>updateTrigger(rule.id,{eq:e.target.value})}/>
                </div>
              )}
              {rule.trigger?.type==='javascript' && (
                <div>
                  <textarea className="input font-mono text-xs resize-none" rows={3} value={rule.trigger.code||''} onChange={e=>updateTrigger(rule.id,{code:e.target.value})} placeholder={'// return true to trigger\n// data = form values\nreturn data.fieldKey === "value";'}/>
                  <p className="text-xs text-gray-400 mt-1">Function receives <code className="bg-gray-100 px-1 rounded">data</code> (all current values). Return <code className="bg-gray-100 px-1 rounded">true</code> to trigger.</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Actions</p>
              <div className="space-y-2">
                {(rule.actions||[]).map(action => (
                  <div key={action.id} className="flex gap-2 items-start">
                    <select className="input text-xs flex-shrink-0 w-28" value={action.type} onChange={e=>updateAction(rule.id,action.id,{type:e.target.value})}>
                      {LOGIC_ACTION_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {action.type==='property' && (
                      <>
                        <select className="input text-xs flex-1" value={action.property||'required'} onChange={e=>updateAction(rule.id,action.id,{property:e.target.value})}>
                          {LOGIC_PROPERTIES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                        <select className="input text-xs w-20" value={action.value} onChange={e=>updateAction(rule.id,action.id,{value:e.target.value})}>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      </>
                    )}
                    {action.type==='value' && (
                      <input className="input text-xs flex-1" placeholder="New value" value={action.value||''} onChange={e=>updateAction(rule.id,action.id,{value:e.target.value})}/>
                    )}
                    {action.type==='clear' && (
                      <span className="text-xs text-gray-400 flex-1 pt-2">Clears this field's value</span>
                    )}
                    <button onClick={()=>removeAction(rule.id,action.id)} className="text-gray-400 hover:text-red-500 text-lg leading-none mt-0.5">×</button>
                  </div>
                ))}
              </div>
              <button onClick={()=>addAction(rule.id)} className="text-xs text-blue-600 hover:text-blue-800 mt-2 font-medium">+ Add action</button>
            </div>
          </div>
        </div>
      ))}

      <button onClick={addRule} className="btn-secondary w-full justify-center text-sm">+ Add Rule</button>
    </div>
  )
}

// ── Properties Panel (tabbed) ─────────────────────────────────────────────────
const PROP_TABS = [
  { id: 'display',     label: 'Display',     icon: '◻' },
  { id: 'validation',  label: 'Validation',  icon: '✓' },
  { id: 'api',         label: 'API',         icon: '{ }' },
  { id: 'conditional', label: 'Conditional', icon: '?' },
  { id: 'logic',       label: 'Logic',       icon: '⚡' },
]

function PropertiesPanel({ field, onChange, allFields }) {
  const [activeTab, setActiveTab] = useState('display')
  const isLayout = field ? ['header','paragraph','divider'].includes(field.type) : false

  // Only show relevant tabs for layout fields
  const tabs = isLayout ? [PROP_TABS[0]] : PROP_TABS

  if (!field) return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 text-gray-400">
      <div className="text-4xl mb-3">👈</div>
      <p className="text-sm font-medium text-gray-500">Select a field to edit its properties</p>
      <p className="text-xs mt-1">Click any field in the canvas</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 overflow-x-auto flex-shrink-0 bg-gray-50">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 px-2 py-2 text-[11px] font-medium whitespace-nowrap transition-colors flex flex-col items-center gap-0.5 min-w-0 ${
              activeTab === t.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}>
            <span className="text-base leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'display'     && <DisplayTab     field={field} onChange={onChange}/>}
        {activeTab === 'validation'  && <ValidationTab  field={field} onChange={onChange}/>}
        {activeTab === 'api'         && <ApiTab         field={field} onChange={onChange}/>}
        {activeTab === 'conditional' && <ConditionalTab field={field} onChange={onChange} allFields={allFields}/>}
        {activeTab === 'logic'       && <LogicTab       field={field} onChange={onChange} allFields={allFields}/>}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Main FormBuilder page
// ══════════════════════════════════════════════════════════════════════════════
export default function FormBuilder() {
  const { id } = useParams()

  const [formName, setFormName]       = useState('')
  const [formDesc, setFormDesc]       = useState('')
  const [fields, setFields]           = useState([])
  const [selectedId, setSelectedId]   = useState(null)
  const [activeId, setActiveId]       = useState(null)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [editingName, setEditingName] = useState(false)
  const [activeCategory, setActiveCategory] = useState('Basic Fields')

  useEffect(() => {
    getForm(id)
      .then(({ data }) => { setFormName(data.name); setFormDesc(data.description||''); setFields(data.schema?.fields||[]) })
      .catch(() => setError('Form not found.'))
      .finally(() => setLoading(false))
  }, [id])

  const selectedField = fields.find(f => f.id === selectedId) || null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = ({ active }) => setActiveId(active.id)
  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (over && active.id !== over.id) {
      setFields(prev => arrayMove(prev, prev.findIndex(f=>f.id===active.id), prev.findIndex(f=>f.id===over.id)))
    }
  }

  const addField = (type) => {
    const f = createField(type)
    if (!f) return
    setFields(prev => [...prev, f])
    setSelectedId(f.id)
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
    } catch { alert('Save failed. Is the backend running?') }
    finally { setSaving(false) }
  }

  const activeField = fields.find(f => f.id === activeId)
  const filteredTypes = FIELD_TYPES.filter(ft => ft.category === activeCategory)

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mr-2"/>Loading…</div>
  if (error) return <div className="max-w-lg mx-auto mt-16 text-center"><p className="text-red-600 font-medium">{error}</p><Link to="/" className="btn-primary mt-4 inline-flex">← Back</Link></div>

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">← Forms</Link>
        <span className="text-gray-300">/</span>
        {editingName ? (
          <input className="input py-1 text-sm font-semibold w-48" value={formName} onChange={e=>setFormName(e.target.value)} onBlur={()=>setEditingName(false)} onKeyDown={e=>e.key==='Enter'&&setEditingName(false)} autoFocus/>
        ) : (
          <button className="text-sm font-semibold text-gray-800 hover:text-blue-600 flex items-center gap-1" onClick={()=>setEditingName(true)}>
            {formName}<span className="text-gray-300 text-xs">✎</span>
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">{fields.length} field{fields.length!==1?'s':''}</span>
          <Link to={`/forms/${id}/preview`} className="btn-secondary text-xs px-3 py-1.5">👁 Preview</Link>
          <Link to={`/forms/${id}/submissions`} className="btn-secondary text-xs px-3 py-1.5">📊 Data</Link>
          <button className={`btn text-xs px-4 py-1.5 ${saved?'bg-green-600 text-white':'btn-primary'}`} onClick={save} disabled={saving}>
            {saving?'…':saved?'✓ Saved':'💾 Save'}
          </button>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Field palette */}
        <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Field Types</p>
          </div>
          <div className="flex border-b border-gray-100 text-xs">
            {['Basic Fields','Advanced','Layout'].map((cat,i)=>(
              <button key={cat} onClick={()=>setActiveCategory(cat)}
                className={`flex-1 py-1.5 font-medium transition-colors ${activeCategory===cat?'text-blue-600 border-b-2 border-blue-600':'text-gray-500 hover:text-gray-700'}`}>
                {['Basic','Advanced','Layout'][i]}
              </button>
            ))}
          </div>
          <div className="p-2 space-y-1 flex-1">
            {filteredTypes.map(ft=>(
              <button key={ft.type} onClick={()=>addField(ft.type)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors group">
                <span className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 group-hover:bg-blue-100 text-[11px] font-bold text-gray-500 group-hover:text-blue-600 flex-shrink-0">{ft.icon}</span>
                <span className="text-xs font-medium">{ft.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Center: Canvas */}
        <main className="flex-1 overflow-y-auto bg-gray-50 px-6 py-6">
          <div className="max-w-2xl mx-auto mb-4 bg-white rounded-xl border border-blue-200 p-5 shadow-sm">
            <input className="block w-full text-xl font-bold text-gray-900 border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none pb-1 mb-2 bg-transparent"
              value={formName} onChange={e=>{setFormName(e.target.value);setSaved(false)}} placeholder="Form title"/>
            <input className="block w-full text-sm text-gray-500 border-0 focus:outline-none bg-transparent"
              value={formDesc} onChange={e=>{setFormDesc(e.target.value);setSaved(false)}} placeholder="Form description (optional)"/>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
              <code className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 font-mono">POST /api/forms/{id}/submit</code>
              <span className="text-[11px] text-gray-400">← auto-generated API</span>
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map(f=>f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
                      <div className="text-4xl mb-3">＋</div>
                      <p className="font-medium text-gray-500">Click a field type on the left to add it</p>
                      <p className="text-sm mt-1">Drag fields to reorder</p>
                    </div>
                  ) : fields.map(field=>(
                    <SortableFieldCard key={field.id} field={field} isSelected={selectedId===field.id} onSelect={setSelectedId} onDelete={removeField}/>
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeField ? (
                  <div className="bg-white border-2 border-blue-400 rounded-xl px-4 py-3 shadow-xl opacity-90 max-w-lg">
                    <p className="text-sm font-medium text-gray-700">{activeField.label||activeField.text||activeField.type}</p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {fields.length > 0 && (
              <div className="mt-3 border border-dashed border-gray-300 rounded-xl p-4 flex items-center justify-between">
                <span className="text-xs text-gray-400">Submit button (auto-rendered)</span>
                <div className="bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-lg opacity-60 pointer-events-none">Submit</div>
              </div>
            )}
          </div>
        </main>

        {/* Right: Properties panel */}
        <aside className="w-72 flex-shrink-0 bg-white border-l border-gray-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-100 flex-shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {selectedField ? `${getFieldDef(selectedField.type)?.label || selectedField.type} Properties` : 'Properties'}
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <PropertiesPanel field={selectedField} onChange={updateField} allFields={fields}/>
          </div>
        </aside>
      </div>
    </div>
  )
}
