import { useEffect, useMemo, useState } from "react";
import { fetchAllDocuments, generateQuizForDocument } from "../api";
import "../App.css";

export default function Quiz() {
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [quizLoading, setQuizLoading] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const res = await fetchAllDocuments();
        const loadedDocuments = Array.isArray(res?.documents) ? res.documents : [];
        setDocuments(loadedDocuments);

        if (loadedDocuments.length > 0) {
          setSelectedDocumentId(loadedDocuments[0].id);
        }
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to load documents for quiz generation.");
      } finally {
        setDocumentsLoading(false);
      }
    };

    loadDocuments();
  }, []);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  const currentQuestion = quizData?.questions?.[currentQuestionIndex] ?? null;
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = quizData?.questions?.length ?? 0;

  const scoreSummary = useMemo(() => {
    if (!quizData || !isSubmitted) {
      return null;
    }

    let correctCount = 0;

    quizData.questions.forEach((question) => {
      if (answers[question.id] === question.correctAnswer) {
        correctCount += 1;
      }
    });

    return {
      correctCount,
      total: quizData.questions.length,
      percentage: Math.round((correctCount / quizData.questions.length) * 100),
    };
  }, [answers, isSubmitted, quizData]);

  const handleGenerateQuiz = async () => {
    if (!selectedDocumentId) {
      setError("Select a document first.");
      return;
    }

    setQuizLoading(true);
    setError("");
    setQuizData(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setIsSubmitted(false);

    try {
      const res = await generateQuizForDocument(selectedDocumentId);
      setQuizData(res.quiz);
    } catch (quizError) {
      console.error(quizError);
      setError("Could not generate the quiz right now.");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleAnswerSelect = (optionIndex) => {
    if (!currentQuestion || isSubmitted) {
      return;
    }

    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [currentQuestion.id]: optionIndex,
    }));
  };

  const handleSubmitQuiz = () => {
    setIsSubmitted(true);
  };

  const handleResetQuiz = () => {
    setAnswers({});
    setCurrentQuestionIndex(0);
    setIsSubmitted(false);
  };

  return (
    <div className="quiz-page">
      <section className="app-panel notes-library-hero">
        <span className="app-eyebrow">Interactive Quiz</span>
        <div className="notes-library-header">
          <div>
            <h1 className="app-title">Create a quiz directly from an uploaded document.</h1>
            <p className="app-subtitle">
              Choose one upload, let Groq build a focused 10-question test from it,
              then complete the quiz in an interactive session with a final scorecard.
            </p>
          </div>
          <div className="library-count-card">
            <p className="app-meta-label">Question Set</p>
            <p className="library-count-value">{quizData?.questions?.length ?? 10}</p>
          </div>
        </div>
      </section>

      {documentsLoading ? <div className="status-banner warning">Loading documents...</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}

      <div className="quiz-layout">
        <section className="app-panel quiz-sidebar-card">
          <div className="quiz-sidebar-header">
            <h2 className="preview-title">1. Select a document</h2>
            <p className="preview-copy">
              The quiz will only use topics from the chosen upload. No outside content is added.
            </p>
          </div>

          <div className="quiz-document-list">
            {documents.map((document) => (
              <button
                key={document.id}
                type="button"
                className={`quiz-document-card${selectedDocumentId === document.id ? " is-active" : ""}`}
                onClick={() => setSelectedDocumentId(document.id)}
              >
                <span className="quiz-document-title">{document.file_name}</span>
                <span className="quiz-document-copy">
                  Uploaded {new Date(document.created_at).toLocaleString()}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="primary-cta"
            onClick={handleGenerateQuiz}
            disabled={!selectedDocumentId || quizLoading || documentsLoading}
          >
            {quizLoading ? "Generating Quiz..." : "Generate 10-Question Quiz"}
          </button>
        </section>

        <section className="app-panel quiz-main-card">
          {!quizData ? (
            <div className="notes-placeholder">
              <div>
                <strong>Quiz session will appear here.</strong>
                {selectedDocument
                  ? ` Selected document: ${selectedDocument.file_name}`
                  : " Choose a document on the left and generate a quiz to begin."}
              </div>
            </div>
          ) : isSubmitted && scoreSummary ? (
            <div className="quiz-results">
              <div className="quiz-results-hero">
                <p className="app-meta-label">Scoreboard</p>
                <h2 className="preview-title">
                  {scoreSummary.correctCount} / {scoreSummary.total} correct
                </h2>
                <p className="preview-copy">
                  You scored {scoreSummary.percentage}% on this quiz generated from{" "}
                  {selectedDocument?.file_name ?? "the selected document"}.
                </p>
              </div>

              <button type="button" className="primary-cta" onClick={handleResetQuiz}>
                Retake Quiz
              </button>

              <div className="quiz-review-list">
                {quizData.questions.map((question, index) => {
                  const selectedAnswer = answers[question.id];
                  const isCorrect = selectedAnswer === question.correctAnswer;

                  return (
                    <article
                      key={question.id}
                      className={`quiz-review-card${isCorrect ? " is-correct" : " is-wrong"}`}
                    >
                      <p className="app-meta-label">Question {index + 1}</p>
                      <h3 className="quiz-question-title">{question.question}</h3>
                      <p className="quiz-review-line">
                        Your answer: {selectedAnswer !== undefined ? question.options[selectedAnswer] : "Not answered"}
                      </p>
                      <p className="quiz-review-line">
                        Correct answer: {question.options[question.correctAnswer]}
                      </p>
                      <p className="quiz-review-explanation">{question.explanation}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="quiz-session">
              <div className="preview-header">
                <div>
                  <h2 className="preview-title">{quizData.title}</h2>
                  <p className="preview-copy">{quizData.description}</p>
                </div>
                <div className="preview-chip">
                  Question {currentQuestionIndex + 1} / {totalQuestions}
                </div>
              </div>

              <div className="quiz-progress-row">
                <div className="quiz-progress-track">
                  <div
                    className="quiz-progress-fill"
                    style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                  />
                </div>
                <span className="quiz-progress-copy">{answeredCount} answered</span>
              </div>

              {currentQuestion ? (
                <div className="quiz-question-card">
                  <p className="app-meta-label">Current Question</p>
                  <h3 className="quiz-question-title">{currentQuestion.question}</h3>

                  <div className="quiz-options">
                    {currentQuestion.options.map((option, optionIndex) => (
                      <button
                        key={`${currentQuestion.id}-${optionIndex}`}
                        type="button"
                        className={`quiz-option${answers[currentQuestion.id] === optionIndex ? " is-selected" : ""}`}
                        onClick={() => handleAnswerSelect(optionIndex)}
                      >
                        <span className="quiz-option-index">{String.fromCharCode(65 + optionIndex)}</span>
                        <span>{option}</span>
                      </button>
                    ))}
                  </div>

                  <div className="quiz-actions">
                    <button
                      type="button"
                      className="secondary-cta"
                      onClick={() => setCurrentQuestionIndex((index) => Math.max(0, index - 1))}
                      disabled={currentQuestionIndex === 0}
                    >
                      Previous
                    </button>

                    {currentQuestionIndex === totalQuestions - 1 ? (
                      <button
                        type="button"
                        className="primary-cta"
                        onClick={handleSubmitQuiz}
                      >
                        Finish Quiz
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="primary-cta"
                        onClick={() => setCurrentQuestionIndex((index) => Math.min(totalQuestions - 1, index + 1))}
                      >
                        Next Question
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
