import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { CheckCircle, XCircle, Award, RotateCcw, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface QuizQuestion {
  id: string
  question: string
  type: 'multiple_choice' | 'text'
  options: string[]
  correctAnswer: number | string // number for multiple choice index, string for text answer
}

interface VideoQuizProps {
  videoId: string
  videoTitle: string
  onComplete: (passed: boolean, score: number) => void
}

const VideoQuiz = ({ videoId, videoTitle, onComplete }: VideoQuizProps) => {
  const { profile } = useAuthStore()
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [passingScore, setPassingScore] = useState(70)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number | string>>({})
  const [showResults, setShowResults] = useState(false)
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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

      if (error) {
        if (error.code === 'PGRST116') {
          // No quiz for this video
          toast('No quiz available for this video', { icon: 'ℹ️' })
          onComplete(true, 100)
          return
        }
        throw error
      }

      if (data) {
        setQuestions(data.questions as QuizQuestion[])
        setPassingScore(data.passing_score)
      }
    } catch (error) {
      console.error('Error fetching quiz:', error)
      toast.error('Failed to load quiz')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAnswer = (questionIndex: number, answer: number | string) => {
    if (showResults) return
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }))
  }

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1)
    }
  }

  const calculateScore = () => {
    let correct = 0
    questions.forEach((q, index) => {
      const userAnswer = selectedAnswers[index]
      if (q.type === 'text') {
        // Case-insensitive comparison for text answers
        const correctText = (q.correctAnswer as string).toLowerCase().trim()
        const userText = (userAnswer as string || '').toLowerCase().trim()
        if (userText === correctText) {
          correct++
        }
      } else {
        // Multiple choice - compare indices
        if (userAnswer === q.correctAnswer) {
          correct++
        }
      }
    })
    return Math.round((correct / questions.length) * 100)
  }

  const handleSubmit = async () => {
    if (Object.keys(selectedAnswers).length < questions.length) {
      toast.error('Please answer all questions before submitting')
      return
    }

    setSubmitting(true)
    const finalScore = calculateScore()
    setScore(finalScore)
    const passed = finalScore >= passingScore

    try {
      // Update video progress with quiz results
      await supabase
        .from('video_progress')
        .update({
          quiz_score: finalScore,
          quiz_passed: passed,
        })
        .eq('user_id', profile?.id)
        .eq('video_id', videoId)

      setShowResults(true)
      
      if (passed) {
        toast.success(`Congratulations! You passed with ${finalScore}%`)
      } else {
        toast.error(`You scored ${finalScore}%. You need ${passingScore}% to pass.`)
      }
    } catch (error) {
      console.error('Error saving quiz results:', error)
      toast.error('Failed to save quiz results')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetry = () => {
    setSelectedAnswers({})
    setCurrentQuestion(0)
    setShowResults(false)
    setScore(0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="sr-only">Loading quiz...</span>
      </div>
    )
  }

  if (questions.length === 0) {
    return null
  }

  const currentQ = questions[currentQuestion]
  const allAnswered = Object.keys(selectedAnswers).length === questions.length
  const passed = score >= passingScore

  if (showResults) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="text-center">
          <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
            passed ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {passed ? (
              <Award className="w-10 h-10 text-green-600" />
            ) : (
              <XCircle className="w-10 h-10 text-red-600" />
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {passed ? 'Congratulations!' : 'Not Quite There'}
          </h2>
          
          <p className="text-gray-600 mb-4">
            {passed 
              ? `You passed the quiz for "${videoTitle}"!`
              : `You need ${passingScore}% to pass. Keep learning and try again!`
            }
          </p>

          <div className="text-5xl font-bold mb-6" style={{ color: passed ? '#16a34a' : '#dc2626' }}>
            {score}%
          </div>

          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Correct Answers</span>
                <p className="font-semibold text-gray-900">
                  {questions.filter((q, i) => {
                    const userAnswer = selectedAnswers[i]
                    if (q.type === 'text') {
                      return (userAnswer as string || '').toLowerCase().trim() === (q.correctAnswer as string).toLowerCase().trim()
                    }
                    return userAnswer === q.correctAnswer
                  }).length} / {questions.length}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Passing Score</span>
                <p className="font-semibold text-gray-900">{passingScore}%</p>
              </div>
            </div>
          </div>

          {/* Show answers review */}
          <div className="text-left mb-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Review Your Answers:</h3>
            {questions.map((q, index) => {
              const userAnswer = selectedAnswers[index]
              const isCorrect = q.type === 'text'
                ? (userAnswer as string || '').toLowerCase().trim() === (q.correctAnswer as string).toLowerCase().trim()
                : userAnswer === q.correctAnswer
              
              const displayUserAnswer = q.type === 'text' 
                ? (userAnswer as string || '(no answer)')
                : q.options[userAnswer as number] || '(no answer)'
              
              const displayCorrectAnswer = q.type === 'text'
                ? (q.correctAnswer as string)
                : q.options[q.correctAnswer as number]

              return (
                <div key={q.id} className={`p-3 rounded-lg border ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{q.question}</p>
                      <p className="text-sm mt-1">
                        <span className="text-gray-500">Your answer: </span>
                        <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>
                          {displayUserAnswer}
                        </span>
                      </p>
                      {!isCorrect && (
                        <p className="text-sm">
                          <span className="text-gray-500">Correct answer: </span>
                          <span className="text-green-700">{displayCorrectAnswer}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex gap-3">
            {!passed && (
              <Button variant="outline" className="flex-1" onClick={handleRetry}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
            <Button 
              className="flex-1" 
              onClick={() => onComplete(passed, score)}
            >
              {passed ? 'Continue' : 'Close'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Quiz: {videoTitle}</h2>
          <span className="text-sm text-gray-500">
            Question {currentQuestion + 1} of {questions.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
          <div 
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              currentQ.type === 'text' 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {currentQ.type === 'text' ? 'Text Answer' : 'Multiple Choice'}
            </span>
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-4">{currentQ.question}</h3>
          
          {currentQ.type === 'multiple_choice' ? (
            <div className="space-y-3">
              {currentQ.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectAnswer(currentQuestion, index)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedAnswers[currentQuestion] === index
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedAnswers[currentQuestion] === index
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedAnswers[currentQuestion] === index && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="text-gray-900">{option}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={(selectedAnswers[currentQuestion] as string) || ''}
                onChange={(e) => handleSelectAnswer(currentQuestion, e.target.value)}
                placeholder="Type your answer here..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-lg"
              />
              <p className="text-sm text-gray-500 mt-2">Your answer will be compared case-insensitively.</p>
            </div>
          )}
        </div>

        {/* Question navigation dots */}
        <div className="flex justify-center gap-2 mb-6">
          {questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestion(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentQuestion
                  ? 'bg-blue-500 w-6'
                  : selectedAnswers[index] !== undefined
                    ? 'bg-green-500'
                    : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
            className="flex-1"
          >
            Previous
          </Button>
          
          {currentQuestion === questions.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className="flex-1"
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={selectedAnswers[currentQuestion] === undefined}
              className="flex-1"
            >
              Next
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}

export default VideoQuiz
