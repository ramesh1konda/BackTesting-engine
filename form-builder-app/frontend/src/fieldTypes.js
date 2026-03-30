export const FIELD_TYPES = [
  // ── Basic Fields ────────────────────────────────────────────────────────
  {
    type: 'textfield', label: 'Text Field', icon: 'T', category: 'Basic Fields',
    defaults: { label: 'Text Field', placeholder: '', required: false, helpText: '' },
  },
  {
    type: 'email', label: 'Email', icon: '@', category: 'Basic Fields',
    defaults: { label: 'Email', placeholder: 'email@example.com', required: false, helpText: '' },
  },
  {
    type: 'phoneNumber', label: 'Phone Number', icon: '☎', category: 'Basic Fields',
    defaults: { label: 'Phone Number', placeholder: '', required: false, helpText: '' },
  },
  {
    type: 'number', label: 'Number', icon: '#', category: 'Basic Fields',
    defaults: { label: 'Number', placeholder: '', required: false, helpText: '', min: '', max: '' },
  },
  {
    type: 'password', label: 'Password', icon: '●', category: 'Basic Fields',
    defaults: { label: 'Password', placeholder: '', required: false, helpText: '' },
  },
  {
    type: 'textarea', label: 'Text Area', icon: '¶', category: 'Basic Fields',
    defaults: { label: 'Text Area', placeholder: '', required: false, helpText: '', rows: 3 },
  },
  {
    type: 'select', label: 'Select', icon: '▾', category: 'Basic Fields',
    defaults: { label: 'Select', required: false, helpText: '', options: ['Option 1', 'Option 2', 'Option 3'] },
  },
  {
    type: 'radio', label: 'Radio', icon: '◉', category: 'Basic Fields',
    defaults: { label: 'Radio', required: false, helpText: '', options: ['Option 1', 'Option 2', 'Option 3'] },
  },
  {
    type: 'checkbox', label: 'Checkbox', icon: '☑', category: 'Basic Fields',
    defaults: { label: 'I agree to the terms', required: false, helpText: '' },
  },
  // ── Advanced ─────────────────────────────────────────────────────────────
  {
    type: 'datetime', label: 'Date / Time', icon: '◷', category: 'Advanced',
    defaults: { label: 'Date', required: false, helpText: '', dateOnly: true },
  },
  {
    type: 'file', label: 'File Upload', icon: '⬆', category: 'Advanced',
    defaults: { label: 'File Upload', required: false, helpText: '', multiple: false },
  },
  // ── Layout ────────────────────────────────────────────────────────────────
  {
    type: 'header', label: 'Header', icon: 'H', category: 'Layout',
    defaults: { text: 'Section Header', level: 2 },
  },
  {
    type: 'paragraph', label: 'Paragraph', icon: 'P', category: 'Layout',
    defaults: { text: 'Enter descriptive text here.' },
  },
  {
    type: 'divider', label: 'Divider', icon: '—', category: 'Layout',
    defaults: {},
  },
]

export const CATEGORIES = ['Basic Fields', 'Advanced', 'Layout']

export const getFieldDef = (type) => FIELD_TYPES.find(f => f.type === type)

/** Generate a camelCase API key from a label string */
export const labelToKey = (label) =>
  (label || 'field')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('')
    || 'field'

/** Create a new field object from a type string */
export const createField = (type) => {
  const def = getFieldDef(type)
  if (!def) return null
  const isLayout = def.category === 'Layout'
  const id = `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  return {
    id,
    type,
    key: isLayout ? null : labelToKey(def.defaults.label) + '_' + id.slice(-5),
    ...def.defaults,
  }
}
