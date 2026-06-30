import { useState, useEffect } from 'react'
import './App.css'

function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login') // 'login' or 'register'
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Form state
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })

  // Summarizer state
  const [inputText, setInputText] = useState('')
  const [summary, setSummary] = useState('')
  const [numSentences, setNumSentences] = useState(3)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('text')
  const [selectedFile, setSelectedFile] = useState(null)
  const [flashcards, setFlashcards] = useState([])
  const [keywords, setKeywords] = useState([])
  const [viewMode, setViewMode] = useState('summary') // 'summary' or 'flashcards'

  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  // History state
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const API_URL = 'http://localhost:8000'

  // Check for existing token on load
  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    if (token && storedUser) {
      setIsAuthenticated(true)
      setUser(JSON.parse(storedUser))
    }
  }, [])

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token')
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }

  // Auth functions
  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed')
      }

      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify({ username: data.username }))
      setUser({ username: data.username })
      setIsAuthenticated(true)
      setLoginForm({ username: '', password: '' })
    } catch (err) {
      setAuthError(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    if (registerForm.password !== registerForm.confirmPassword) {
      setAuthError('Passwords do not match')
      setAuthLoading(false)
      return
    }

    if (registerForm.password.length < 6) {
      setAuthError('Password must be at least 6 characters')
      setAuthLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: registerForm.username,
          email: registerForm.email,
          password: registerForm.password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed')
      }

      // Auto login after registration
      setAuthMode('login')
      setLoginForm({ username: registerForm.username, password: registerForm.password })
      setRegisterForm({ username: '', email: '', password: '', confirmPassword: '' })
      setAuthError('')

      // Show success message
      alert('Registration successful! Please login.')
    } catch (err) {
      setAuthError(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsAuthenticated(false)
    setUser(null)
    setSummary('')
    setStats(null)
    setHistory([])
    setShowHistory(false)
  }

  // Summarizer functions
  const handleTextSubmit = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to summarize.')
      return
    }

    setIsLoading(true)
    setError('')
    setSummary('')
    setStats(null)
    setFlashcards([])
    setKeywords([])
    setViewMode('summary')

    try {
      const headers = getAuthHeaders()
      const body = JSON.stringify({
        text: inputText,
        num_sentences: numSentences,
      })

      // Parallel requests
      const [summaryRes, flashcardRes, keywordRes] = await Promise.all([
        fetch(`${API_URL}/summarize/text`, { method: 'POST', headers, body }),
        fetch(`${API_URL}/generate/flashcards`, { method: 'POST', headers, body }),
        fetch(`${API_URL}/extract/keywords`, { method: 'POST', headers, body })
      ])

      // Check auth on summary (primary)
      if (summaryRes.status === 401) {
        handleLogout()
        throw new Error('Session expired. Please login again.')
      }

      if (!summaryRes.ok) throw new Error('Failed to summarize text.')

      const summaryData = await summaryRes.json()
      setSummary(summaryData.summary)
      setStats({
        original: summaryData.original_length,
        summarized: summaryData.summary_length,
        reduction: Math.round((1 - summaryData.summary_length / summaryData.original_length) * 100)
      })

      // Process optional results (don't fail if these fail)
      if (flashcardRes.ok) {
        setFlashcards(await flashcardRes.json())
      }

      if (keywordRes.ok) {
        const kData = await keywordRes.json()
        setKeywords(kData.keywords)
      }

    } catch (err) {
      setError(err.message || 'An error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload.')
      return
    }

    setIsLoading(true)
    setError('')
    setError('')
    setSummary('')
    setStats(null)
    setFlashcards([])
    setKeywords([])
    setViewMode('summary')

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('num_sentences', numSentences)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/summarize/file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })

      if (response.status === 401) {
        handleLogout()
        throw new Error('Session expired. Please login again.')
      }

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || 'Failed to summarize file.')
      }

      const data = await response.json()
      setSummary(data.summary)
      setStats({
        original: data.original_length,
        summarized: data.summary_length,
        reduction: Math.round((1 - data.summary_length / data.original_length) * 100)
      })

      if (data.flashcards) setFlashcards(data.flashcards)
      if (data.keywords) setKeywords(data.keywords)

    } catch (err) {
      setError(err.message || 'An error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      setError('')
    }
  }

  const handleClear = () => {
    setInputText('')
    setSummary('')
    setError('')
    setStats(null)
    setSelectedFile(null)
    setFlashcards([])
    setKeywords([])
    setViewMode('summary')
  }

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summary)
  }

  // History functions
  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch(`${API_URL}/history`, {
        headers: getAuthHeaders()
      })

      if (response.status === 401) {
        handleLogout()
        return
      }

      const data = await response.json()
      setHistory(data)
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleShowHistory = () => {
    setShowHistory(true)
    fetchHistory()
  }

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear all history?')) return

    try {
      const response = await fetch(`${API_URL}/history`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (response.ok) {
        setHistory([])
      }
    } catch (err) {
      console.error('Failed to clear history:', err)
    }
  }

  const handleDeleteHistoryItem = async (itemId) => {
    try {
      const response = await fetch(`${API_URL}/history/${itemId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (response.ok) {
        setHistory(history.filter(item => item.id !== itemId))
      }
    } catch (err) {
      console.error('Failed to delete history item:', err)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Render Login/Register
  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-card card fade-in">
            <div className="auth-header">
              <span className="logo-icon">✨</span>
              <h1>AI Notes Summariser</h1>
              <p>Sign in to start summarizing</p>
            </div>

            <div className="auth-tabs">
              <button
                className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => { setAuthMode('login'); setAuthError('') }}
              >
                Sign In
              </button>
              <button
                className={`auth-tab ${authMode === 'register' ? 'active' : ''}`}
                onClick={() => { setAuthMode('register'); setAuthError('') }}
              >
                Sign Up
              </button>
            </div>

            {authError && (
              <div className="error-message fade-in">
                <span>⚠️</span> {authError}
              </div>
            )}

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="auth-form">
                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    type="text"
                    id="username"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    placeholder="Enter your username"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    placeholder="Enter your password"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <><div className="spinner"></div> Signing in...</> : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="auth-form">
                <div className="form-group">
                  <label htmlFor="reg-username">Username</label>
                  <input
                    type="text"
                    id="reg-username"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    placeholder="Choose a username"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reg-password">Password</label>
                  <input
                    type="password"
                    id="reg-password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    placeholder="Create a password"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm Password</label>
                  <input
                    type="password"
                    id="confirm-password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    placeholder="Confirm your password"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <><div className="spinner"></div> Creating account...</> : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render History View
  if (showHistory) {
    return (
      <div className="app">
        <header className="header">
          <div className="container">
            <div className="header-content">
              <div className="header-top">
                <div className="logo">
                  <span className="logo-icon">✨</span>
                  <h1>Search History</h1>
                </div>
                <div className="header-actions">
                  <button className="btn btn-secondary" onClick={() => setShowHistory(false)}>
                    ← Back
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="main container">
          <div className="history-header">
            <h2>Your Summarization History</h2>
            {history.length > 0 && (
              <button className="btn btn-secondary" onClick={handleClearHistory}>
                🗑️ Clear All
              </button>
            )}
          </div>

          {historyLoading ? (
            <div className="loading-state card">
              <div className="spinner large"></div>
              <p>Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-icon">📜</div>
              <p>No history yet</p>
              <span>Your summarization history will appear here</span>
            </div>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <div key={item.id} className="history-item card fade-in">
                  <div className="history-item-header">
                    <span className="history-date">{formatDate(item.created_at)}</span>
                    <div className="history-stats">
                      <span className="stat-badge">{item.original_length} → {item.summary_length} chars</span>
                      <span className="stat-badge highlight">
                        {Math.round((1 - item.summary_length / item.original_length) * 100)}% reduced
                      </span>
                    </div>
                    <button
                      className="btn-icon"
                      onClick={() => handleDeleteHistoryItem(item.id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="history-content">
                    <div className="history-original">
                      <label>Original:</label>
                      <p>{item.original_text}</p>
                    </div>
                    <div className="history-summary">
                      <label>Summary:</label>
                      <p>{item.summary}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    )
  }

  // Render Main App
  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="header-top">
              <div className="logo">
                <span className="logo-icon">✨</span>
                <h1>AI Notes Summariser</h1>
              </div>
              <div className="header-actions">
                <span className="user-badge">👤 {user?.username}</span>
                <button className="btn btn-secondary" onClick={handleShowHistory}>
                  📜 History
                </button>
                <button className="theme-toggle" onClick={toggleTheme} title="Toggle Dark Mode">
                  {theme === 'light' ? '🌙' : '☀️'}
                </button>
                <button className="btn btn-secondary" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>
            <p className="tagline">Transform lengthy content into concise, meaningful summaries using AI</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main container">
        <div className="summarizer-grid">
          {/* Input Section */}
          <section className="input-section card fade-in">
            <div className="section-header">
              <h2>📝 Input</h2>
              <div className="tabs">
                <button
                  className={`tab ${activeTab === 'text' ? 'active' : ''}`}
                  onClick={() => setActiveTab('text')}
                >
                  Paste Text
                </button>
                <button
                  className={`tab ${activeTab === 'file' ? 'active' : ''}`}
                  onClick={() => setActiveTab('file')}
                >
                  Upload File
                </button>
              </div>
            </div>

            {activeTab === 'text' ? (
              <div className="input-area">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste your notes, article, or any text you want to summarize..."
                  rows={12}
                />
                <div className="char-count">{inputText.length} characters</div>
              </div>
            ) : (
              <div className="file-upload">
                <div className="file-upload-icon">📄</div>
                <p>{selectedFile ? selectedFile.name : 'Drop a .txt file here or click to browse'}</p>
                <span className="file-hint">Only .txt files are supported</span>
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileChange}
                />
              </div>
            )}

            <div className="options-row">
              <div className="option">
                <label htmlFor="numSentences">Summary Length</label>
                <div className="sentence-control">
                  <button
                    className="sentence-btn"
                    onClick={() => setNumSentences(Math.max(1, numSentences - 1))}
                  >
                    −
                  </button>
                  <span className="sentence-value">{numSentences} sentences</span>
                  <button
                    className="sentence-btn"
                    onClick={() => setNumSentences(Math.min(10, numSentences + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="action-buttons">
              <button
                className="btn btn-primary"
                onClick={activeTab === 'text' ? handleTextSubmit : handleFileSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="spinner"></div>
                    Summarizing...
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    Summarize Now
                  </>
                )}
              </button>
              <button className="btn btn-secondary" onClick={handleClear}>
                Clear
              </button>
            </div>

            {error && (
              <div className="error-message fade-in">
                <span>⚠️</span> {error}
              </div>
            )}
          </section>

          {/* Output Section */}
          <section className="output-section card fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="section-header">
              <h2>📋 Results</h2>
              <div className="tabs">
                <button
                  className={`tab ${viewMode === 'summary' ? 'active' : ''}`}
                  onClick={() => setViewMode('summary')}
                >
                  Summary
                </button>
                <button
                  className={`tab ${viewMode === 'flashcards' ? 'active' : ''}`}
                  onClick={() => setViewMode('flashcards')}
                  disabled={!flashcards.length}
                >
                  Flashcards ({flashcards.length})
                </button>
              </div>
              {summary && viewMode === 'summary' && (
                <button className="btn btn-secondary copy-btn" onClick={handleCopySummary}>
                  📋 Copy
                </button>
              )}
            </div>

            {stats && (
              <div className="stats-bar fade-in">
                <div className="stat">
                  <span className="stat-value">{stats.original}</span>
                  <span className="stat-label">Original chars</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{stats.summarized}</span>
                  <span className="stat-label">Summary chars</span>
                </div>
                <div className="stat highlight">
                  <span className="stat-value">{stats.reduction}%</span>
                  <span className="stat-label">Reduced</span>
                </div>
              </div>
            )}

            <div className="output-area">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner large"></div>
                  <p>Analyzing and summarizing your content...</p>
                </div>
              ) : summary ? (
                viewMode === 'summary' ? (
                  <div className="summary-wrapper fade-in">
                    {keywords.length > 0 && (
                      <div className="keywords-container">
                        {keywords.map((k, i) => (
                          <span key={i} className="keyword-badge">#{k}</span>
                        ))}
                      </div>
                    )}
                    <div className="summary-content">
                      <p>{summary}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flashcards-grid fade-in">
                    {flashcards.map((card, i) => (
                      <div
                        key={i}
                        className="flashcard"
                        onClick={(e) => e.currentTarget.classList.toggle('flipped')}
                      >
                        <div className="flashcard-inner">
                          <div className="flashcard-front">
                            <div className="flashcard-question">
                              <p>{card.question}</p>
                            </div>
                          </div>
                          <div className="flashcard-back">
                            <div className="flashcard-answer">
                              <p>{card.answer}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🎯</div>
                  <p>Your summarized content will appear here</p>
                  <span>Enter text or upload a file and click "Summarize Now"</span>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Features Section */}
        <section className="features-section">
          <h2 className="text-center">Why Use AI Notes Summariser?</h2>
          <div className="features-grid">
            <div className="feature-card card">
              <div className="feature-icon">🚀</div>
              <h3>Fast & Efficient</h3>
              <p>Get instant summaries powered by advanced NLP algorithms</p>
            </div>
            <div className="feature-card card">
              <div className="feature-icon">🎯</div>
              <h3>Accurate Results</h3>
              <p>Extracts the most important sentences while preserving meaning</p>
            </div>
            <div className="feature-card card">
              <div className="feature-icon">📚</div>
              <h3>Study Smart</h3>
              <p>Perfect for students preparing for exams and quick revisions</p>
            </div>
            <div className="feature-card card">
              <div className="feature-icon">💼</div>
              <h3>Professional Use</h3>
              <p>Ideal for professionals reviewing documents and reports</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>© 2026 AI Notes Summariser • Built with React & Python</p>
        </div>
      </footer>
    </div>
  )
}

export default App
