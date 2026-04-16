/**
 * Client-side spam detection for contact form submissions.
 * Scores messages based on common spam/sales-pitch indicators.
 * Returns true if the message is likely spam.
 */

// Phrases commonly found in cold outreach / sales pitches
const SPAM_PHRASES = [
  // Sales pitch language
  'book meetings', 'book a meeting', 'schedule a call', 'schedule a time',
  'drive traffic', 'generate leads', 'user sign ups', 'sign ups',
  'guaranteed results', 'money back', 'refund', 'risk-free',
  'grow your business', 'scale your business', 'boost your revenue',
  'increase your sales', 'double your', 'triple your',
  'million contacts', 'million emails', 'extensive network',
  'private network', 'targeted outreach', 'cold outreach',
  'roi guaranteed', 'proven results', 'proven system',
  'we help businesses', 'i help businesses', 'help companies like yours',
  'quick call', 'free consultation', 'free audit', 'free demo',
  'no obligation', 'limited time', 'act now', 'don\'t miss',
  'exclusive offer', 'special offer', 'discount',
  'click here', 'learn more at', 'check out our',
  'calendly.com', 'book.', 'schedule.',

  // SEO spam
  'seo services', 'search engine optimization', 'rank higher',
  'first page of google', 'backlinks', 'domain authority',
  'keyword ranking', 'organic traffic',

  // Web dev spam
  'redesign your website', 'website redesign', 'build you a website',
  'mobile-friendly website', 'web development services',

  // Marketing spam
  'social media marketing', 'email marketing', 'digital marketing',
  'content marketing', 'marketing agency', 'marketing services',
  'brand awareness', 'lead generation', 'conversion rate',
  'pay per click', 'ppc campaign', 'google ads',

  // Crypto/finance spam
  'cryptocurrency', 'bitcoin', 'forex', 'trading signals',
  'investment opportunity', 'passive income', 'make money',

  // LinkedIn-style cold outreach
  'tried to find you on linkedin', 'found you on linkedin',
  'reaching out here', 'reaching out because',
  'i came across your', 'i noticed your',
  'i was impressed by', 'love what you\'re doing',
]

// Suspicious URL patterns (calendly, bitly, etc.)
const SPAM_URL_PATTERNS = [
  /calendly\.com/i,
  /bit\.ly/i,
  /tinyurl\.com/i,
  /linktr\.ee/i,
  /mailchi\.mp/i,
  /hubspot\./i,
  /typeform\.com/i,
  /jotform\.com/i,
  /booking\./i,
]

// Email domain patterns common in spam
const SPAM_EMAIL_DOMAINS = [
  'sendproud', 'coldemail', 'outreach', 'leadgen', 'growthhack',
  'salesforce', 'mailshake', 'woodpecker', 'lemlist', 'apollo',
  'instantly', 'smartlead', 'snov', 'hunter',
]

interface SpamCheckInput {
  name: string
  email: string
  subject: string
  message: string
  phone?: string
}

interface SpamResult {
  isSpam: boolean
  score: number        // 0-100, higher = more likely spam
  reasons: string[]    // Human-readable reasons for flagging
}

export function detectSpam(input: SpamCheckInput): SpamResult {
  const reasons: string[] = []
  let score = 0

  const combinedText = `${input.subject} ${input.message}`.toLowerCase()
  const messageLower = input.message.toLowerCase()
  const subjectLower = input.subject.toLowerCase()
  const emailLower = input.email.toLowerCase()

  // 1. Check for spam phrases (each match adds points)
  let phraseMatches = 0
  for (const phrase of SPAM_PHRASES) {
    if (combinedText.includes(phrase)) {
      phraseMatches++
    }
  }
  if (phraseMatches >= 3) {
    score += 25 + (phraseMatches - 3) * 5
    reasons.push(`Contains ${phraseMatches} sales/marketing phrases`)
  } else if (phraseMatches >= 1) {
    score += phraseMatches * 8
    reasons.push(`Contains ${phraseMatches} promotional phrase(s)`)
  }

  // 2. Check for scheduling/booking URLs
  const urlMatches = combinedText.match(/https?:\/\/[^\s]+/gi) || []
  for (const url of urlMatches) {
    for (const pattern of SPAM_URL_PATTERNS) {
      if (pattern.test(url)) {
        score += 20
        reasons.push(`Contains scheduling/marketing URL`)
        break
      }
    }
  }
  // Any external URL in a contact form is suspicious
  if (urlMatches.length > 0) {
    score += 10
    if (!reasons.some(r => r.includes('URL'))) {
      reasons.push('Contains external URL(s)')
    }
  }

  // 3. Check email domain
  const emailDomain = emailLower.split('@')[1] || ''
  for (const spamDomain of SPAM_EMAIL_DOMAINS) {
    if (emailDomain.includes(spamDomain)) {
      score += 20
      reasons.push(`Email domain associated with outreach tools`)
      break
    }
  }

  // 4. Subject line analysis
  const spamSubjectPatterns = [
    /guaranteed/i, /results or your money/i, /free (audit|demo|consultation)/i,
    /partnership/i, /collaboration opportunity/i, /business proposal/i,
    /increase.*(revenue|sales|traffic)/i, /grow your/i,
    /quick question/i, /following up/i, /re: /i,  // fake reply
  ]
  for (const pattern of spamSubjectPatterns) {
    if (pattern.test(input.subject)) {
      score += 15
      reasons.push(`Subject line matches spam pattern`)
      break
    }
  }

  // 5. Message length heuristic — very long messages from first contact are suspicious
  if (input.message.length > 800) {
    score += 10
    reasons.push('Unusually long first contact message')
  }

  // 6. Check for "I/We" statements typical of pitches
  const pitchStarters = (messageLower.match(/\b(i help|we help|i can|we can|i offer|we offer|i specialize|we specialize|i provide|we provide)\b/g) || []).length
  if (pitchStarters >= 2) {
    score += 15
    reasons.push('Multiple self-promotional statements')
  }

  // 7. Contains phone number in message body (cold callers often include theirs)
  const phoneInMessage = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(input.message) || /\+\d{10,}/.test(input.message)
  if (phoneInMessage && urlMatches.length > 0) {
    score += 10
    reasons.push('Contains both phone number and URL in message')
  }

  // 8. Generic greeting with business name absent — doesn't mention RTI or disability services
  const mentionsRTI = /\b(rti|road to independence|disability|disabilities|special needs|independent living|supported living|respite)\b/i.test(combinedText)
  if (!mentionsRTI && phraseMatches >= 2) {
    score += 10
    reasons.push('No mention of RTI services — likely generic outreach')
  }

  // Cap at 100
  score = Math.min(100, score)

  return {
    isSpam: score >= 50,
    score,
    reasons,
  }
}
