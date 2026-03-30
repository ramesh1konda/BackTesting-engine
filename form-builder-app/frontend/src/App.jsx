import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import FormBuilder from './pages/FormBuilder'
import FormPreview from './pages/FormPreview'
import Submissions from './pages/Submissions'

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/forms/:id/build" element={<FormBuilder />} />
            <Route path="/forms/:id/preview" element={<FormPreview />} />
            <Route path="/forms/:id/submissions" element={<Submissions />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
