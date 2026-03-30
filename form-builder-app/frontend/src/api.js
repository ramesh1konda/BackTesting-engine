import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Forms
export const getForms       = ()           => api.get('/forms')
export const getForm        = (id)         => api.get(`/forms/${id}`)
export const createForm     = (data)       => api.post('/forms', data)
export const updateForm     = (id, data)   => api.put(`/forms/${id}`, data)
export const deleteForm     = (id)         => api.delete(`/forms/${id}`)

// Submissions
export const submitForm          = (id, data)          => api.post(`/forms/${id}/submit`, data)
export const getSubmissions      = (id)                => api.get(`/forms/${id}/submissions`)
export const deleteSubmission    = (formId, subId)     => api.delete(`/forms/${formId}/submissions/${subId}`)
export const exportSubmissionsUrl = (id)               => `/api/forms/${id}/submissions/export`
