import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { Plus, Trash2, Save, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'

interface QuizQuestion {
  id: string
  question: string
  type: 'multiple_choice' | 'text'
  options: string[]
  correctAnswer: number | string // number for multiple choice index, string for text answer
}

interface QuizEditorProps {
  videoId: string
  videoTitle: string
  onClose: () => void
}

const QuizEditor = ({ videoId, videoTitle, onClose }: QuizEditorProps) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [passingScore, setPassingScore] = useState(70)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasExistingQuiz, setHasExistingQuiz] = useState(false)

  useEffect(() => {
    fetchQuiz()
  }, [videoId])

  const fetchQuiz = async () => {
    try {
      const { data, error } = await supabase
        .from('video_quizzes')
        .select('*')
        .eq('video_id', videoId)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setQuestions((data as { questions: QuizQuestion[] }).questions || [])
        setPassingScore((data as { passing_score: number }).passing_score || 70)
        setHasExistingQuiz(true)
      }
    } catch (error) {
      console.error('Error fetching quiz:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateId = () => Math.random().toString(36).substring(2, 9)

  const addMultipleChoiceQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        id: generateId(),
        question: '',
        type: 'multiple_choice' as const,
        options: ['', '', '', ''],
        correctAnswer: 0,
      }
    ])
  }

  const addTextQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        id: generateId(),
        question: '',
        type: 'text' as const,
        options: [],
        correctAnswer: '',
      }
    ])
  }

  const updateQuestion = (index: number, field: keyof QuizQuestion, value: string | number | string[]) => {
    setQuestions(prev => prev.map((q, i) => 
      i === index ? { ...q, [field]: value } : q
    ))
  }

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== questionIndex) return q
      const newOptions = [...q.options]
      newOptions[optionIndex] = value
      return { ...q, options: newOptions }
    }))
  }

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  const addOption = (questionIndex: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== questionIndex) return q
      return { ...q, options: [...q.options, ''] }
    }))
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== questionIndex || q.type !== 'multiple_choice') return q
      const newOptions = q.options.filter((_, oi) => oi !== optionIndex)
      // Adjust correct answer if needed
      let newCorrectAnswer = q.correctAnswer as number
      if (optionIndex === q.correctAnswer) {
        newCorrectAnswer = 0
      } else if (optionIndex < (q.correctAnswer as number)) {
        newCorrectAnswer = (q.correctAnswer as number) - 1
      }
      return { ...q, options: newOptions, correctAnswer: newCorrectAnswer }
    }))
  }

  const handleSave = async () => {
    // Validate
    for (const q of questions) {
      if (!q.question.trim()) {
        toast.error('All questions must have text')
        return
      }
      if (q.type === 'multiple_choice') {
        if (q.options.some(o => !o.trim())) {
          toast.error('All options must have text')
          return
        }
        if (q.options.length < 2) {
          toast.error('Each multiple choice question must have at least 2 options')
          return
        }
      } else if (q.type === 'text') {
        if (typeof q.correctAnswer !== 'string' || !q.correctAnswer.trim()) {
          toast.error('Text questions must have a correct answer')
          return
        }
      }
    }

    setSaving(true)
    try {
      if (hasExistingQuiz) {
        const { error } = await supabase
          .from('video_quizzes')
          .update({
            questions,
            passing_score: passingScore,
          })
          .eq('video_id', videoId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('video_quizzes')
          .insert({
            video_id: videoId,
            questions,
            passing_score: passingScore,
          })

        if (error) throw error
        setHasExistingQuiz(true)
      }

      toast.success('Quiz saved successfully!')
      onClose()
    } catch (error) {
      console.error('Error saving quiz:', error)
      toast.error('Failed to save quiz')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this quiz?')) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('video_quizzes')
        .delete()
        .eq('video_id', videoId)

      if (error) throw error

      toast.success('Quiz deleted')
      onClose()
    } catch (error) {
      console.error('Error deleting quiz:', error)
      toast.error('Failed to delete quiz')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Quiz Editor</h2>
          <p className="text-gray-600 text-sm">{videoTitle}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Passing Score:</label>
            <input
              type="number"
              min="0"
              max="100"
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
              className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-center"
            />
            <span className="text-sm text-gray-600">%</span>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((question, qIndex) => (
          <Card key={question.id} className="relative">
            <div className="absolute top-4 left-4 text-gray-400 cursor-move">
              <GripVertical className="w-5 h-5" />
            </div>
            
            <div className="pl-10">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500">Question {qIndex + 1}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    question.type === 'text' 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {question.type === 'text' ? 'Text Answer' : 'Multiple Choice'}
                  </span>
                </div>
                <button
                  onClick={() => removeQuestion(qIndex)}
                  className="text-red-500 hover:text-red-700 p-1"
                  aria-label="Remove question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <input
                type="text"
                value={question.question}
                onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                placeholder="Enter your question..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {question.type === 'multiple_choice' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Options (click radio to set correct answer)</label>
                  {question.options.map((option, oIndex) => (
                    <div key={oIndex} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        checked={question.correctAnswer === oIndex}
                        onChange={() => updateQuestion(qIndex, 'correctAnswer', oIndex)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                        placeholder={`Option ${oIndex + 1}`}
                        className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          question.correctAnswer === oIndex 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gray-300'
                        }`}
                      />
                      {question.options.length > 2 && (
                        <button
                          onClick={() => removeOption(qIndex, oIndex)}
                          className="text-gray-400 hover:text-red-500 p-1"
                          aria-label="Remove option"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {question.options.length < 6 && (
                    <button
                      onClick={() => addOption(qIndex)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Option
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Correct Answer (case-insensitive)</label>
                  <input
                    type="text"
                    value={question.correctAnswer as string}
                    onChange={(e) => updateQuestion(qIndex, 'correctAnswer', e.target.value)}
                    placeholder="Enter the correct answer..."
                    className="w-full px-3 py-2 border border-green-500 bg-green-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">User's answer will be compared case-insensitively with this answer.</p>
                </div>
              )}
            </div>
          </Card>
        ))}

        <div className="flex gap-2">
          <button
            onClick={addMultipleChoiceQuestion}
            className="flex-1 py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Multiple Choice
          </button>
          <button
            onClick={addTextQuestion}
            className="flex-1 py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-purple-500 hover:text-purple-500 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Text Answer
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        {hasExistingQuiz && questions.length > 0 && (
          <Button variant="danger" onClick={handleDelete} disabled={saving}>
            Delete Quiz
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving || questions.length === 0} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Quiz'}
        </Button>
      </div>
    </div>
  )
}

export default QuizEditor
