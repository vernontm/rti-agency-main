import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Card from '../components/ui/Card'
import { FileText, ChevronLeft, Download, AlertTriangle } from 'lucide-react'
import Button from '../components/ui/Button'

interface Document {
  id: string
  title: string
  description: string | null
  pdf_url: string
  created_at: string
  category: 'advisory' | 'downloads'
}

const DocumentsPage = () => {
  const [advisories, setAdvisories] = useState<Document[]>([])
  const [downloads, setDownloads] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [activeTab, setActiveTab] = useState<'advisories' | 'downloads'>('advisories')
  const location = useLocation()

  useEffect(() => {
    setLoading(true)
    fetchDocuments()
  }, [location.pathname])

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('advisories')
        .select('id, title, description, pdf_url, created_at, category')
        .eq('is_visible', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      const docs = (data || []).map(d => ({
        ...d,
        category: d.category || 'advisory'
      }))
      
      setAdvisories(docs.filter(d => d.category === 'advisory'))
      setDownloads(docs.filter(d => d.category === 'downloads'))
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (doc: Document) => {
    window.open(doc.pdf_url, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  // Full-screen viewer when document is selected
  if (selectedDocument) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col">
        <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setSelectedDocument(null)}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedDocument.title}</h2>
              {selectedDocument.description && (
                <p className="text-sm text-gray-500">{selectedDocument.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => handleDownload(selectedDocument)}>
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
            <span className="text-sm text-gray-400">
              {new Date(selectedDocument.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden">
          <iframe
            src={selectedDocument.pdf_url}
            className="w-full h-full"
            title={selectedDocument.title}
          />
        </div>
      </div>
    )
  }

  const currentDocs = activeTab === 'advisories' ? advisories : downloads

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-600">Advisories and downloadable resources</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200" role="tablist" aria-label="Documents">
        <button
          id="docs-tab-advisories"
          role="tab"
          aria-selected={activeTab === 'advisories'}
          aria-controls="docs-tabpanel-advisories"
          tabIndex={activeTab === 'advisories' ? 0 : -1}
          onClick={() => setActiveTab('advisories')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'advisories'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Advisories ({advisories.length})
          </div>
        </button>
        <button
          id="docs-tab-downloads"
          role="tab"
          aria-selected={activeTab === 'downloads'}
          aria-controls="docs-tabpanel-downloads"
          tabIndex={activeTab === 'downloads' ? 0 : -1}
          onClick={() => setActiveTab('downloads')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'downloads'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Downloads ({downloads.length})
          </div>
        </button>
      </div>

      <div role="tabpanel" id={`docs-tabpanel-${activeTab}`} aria-labelledby={`docs-tab-${activeTab}`}>
      {currentDocs.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No {activeTab === 'advisories' ? 'Advisories' : 'Downloads'} Available
          </h3>
          <p className="text-gray-500">Check back later for new documents.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentDocs.map((doc) => (
            <Card
              key={doc.id}
              className="p-4 hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => setSelectedDocument(doc)}
            >
              <div className="flex items-start gap-3">
                <div className={`p-3 rounded-lg transition-colors ${
                  activeTab === 'advisories' 
                    ? 'bg-orange-100 group-hover:bg-orange-200' 
                    : 'bg-blue-100 group-hover:bg-blue-200'
                }`}>
                  {activeTab === 'advisories' ? (
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                  ) : (
                    <Download className="w-6 h-6 text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold text-gray-900 transition-colors ${
                    activeTab === 'advisories' 
                      ? 'group-hover:text-orange-600' 
                      : 'group-hover:text-blue-600'
                  }`}>
                    {doc.title}
                  </h3>
                  {doc.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{doc.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}

export default DocumentsPage
