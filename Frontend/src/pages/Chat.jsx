import { useEffect, useMemo, useRef, useState } from "react";
import { askChatQuestion, fetchAllDocuments, refineChatAnswer } from "../api";
import "../App.css";

const refineActions = [
  { type: "simplify", label: "Simplify More" },
  { type: "analogy", label: "Give Analogy" },
  { type: "deeper", label: "Go Deeper" },
];

const getChatErrorMessage = (error, fallbackMessage) => {
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }

  if (error?.code === "ERR_NETWORK") {
    return "Cannot reach the API. Make sure the backend is running on port 5000, or set VITE_API_BASE_URL if the frontend is hosted separately.";
  }

  return fallbackMessage;
};

function TypingText({ text, animate = false, speed = 36, onComplete }) {
  const tokens = useMemo(() => String(text ?? "").split(/(\s+)/), [text]);
  const [visibleCount, setVisibleCount] = useState(animate ? 0 : tokens.length);

  useEffect(() => {
    setVisibleCount(animate ? 0 : tokens.length);
  }, [animate, tokens.length, text]);

  useEffect(() => {
    if (!animate) {
      return undefined;
    }

    if (visibleCount >= tokens.length) {
      onComplete?.();
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setVisibleCount((currentCount) => currentCount + 1);
    }, speed);

    return () => window.clearTimeout(timer);
  }, [animate, onComplete, speed, tokens.length, visibleCount]);

  const renderedText = tokens.slice(0, visibleCount).join("");
  const isComplete = visibleCount >= tokens.length;

  return (
    <div className="chat-message-copy chat-message-typed">
      {renderedText}
      {animate && !isComplete ? <span className="chat-typing-cursor" aria-hidden="true" /> : null}
    </div>
  );
}

export default function Chat() {
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [selectedDocumentId, setSelectedDocumentId] = useState("all");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [refiningState, setRefiningState] = useState({ messageId: null, type: "" });
  const [retryRefinePayload, setRetryRefinePayload] = useState(null);
  const [animatingMessageIds, setAnimatingMessageIds] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const res = await fetchAllDocuments();
        setDocuments(Array.isArray(res?.documents) ? res.documents : []);
      } catch (loadError) {
        console.error(loadError);
        setError(getChatErrorMessage(loadError, "Unable to load your uploaded documents for chat."));
      } finally {
        setDocumentsLoading(false);
      }
    };

    loadDocuments();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, animatingMessageIds]);

  const registerAnimatingMessage = (messageId) => {
    setAnimatingMessageIds((currentIds) =>
      currentIds.includes(messageId) ? currentIds : [...currentIds, messageId]
    );
  };

  const completeAnimatingMessage = (messageId) => {
    setAnimatingMessageIds((currentIds) => currentIds.filter((id) => id !== messageId));
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === messageId
          ? { ...message, animate: false }
          : message
      )
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setError("Enter a question before sending.");
      return;
    }

    const nextUserMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedQuestion,
    };

    setMessages((currentMessages) => [...currentMessages, nextUserMessage]);
    setQuestion("");
    setError("");
    setRetryRefinePayload(null);
    setIsSending(true);

    try {
      const res = await askChatQuestion({
        question: trimmedQuestion,
        documentId: selectedDocumentId === "all" ? undefined : Number(selectedDocumentId),
      });

      const assistantMessageId = `assistant-${Date.now()}`;
      registerAnimatingMessage(assistantMessageId);

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: assistantMessageId,
          role: "assistant",
          content: res.answer,
          sources: Array.isArray(res.sources) ? res.sources : [],
          question: trimmedQuestion,
          documentId: selectedDocumentId === "all" ? null : Number(selectedDocumentId),
          animate: true,
        },
      ]);
    } catch (sendError) {
      console.error(sendError);
      setError(getChatErrorMessage(sendError, "Could not get an answer right now."));
    } finally {
      setIsSending(false);
    }
  };

  const handleRefine = async ({ message, type }) => {
    if (!message?.content || !message?.question) {
      return;
    }

    const payload = {
      type,
      question: message.question,
      answer: message.content,
      documentId: message.documentId ?? undefined,
    };

    setError("");
    setRetryRefinePayload(null);
    setRefiningState({ messageId: message.id, type });

    try {
      const res = await refineChatAnswer(payload);

      const assistantMessageId = `assistant-refine-${Date.now()}`;
      registerAnimatingMessage(assistantMessageId);

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: assistantMessageId,
          role: "assistant",
          content: res.answer,
          sources: Array.isArray(res.sources) ? res.sources : [],
          question: message.question,
          documentId: message.documentId ?? null,
          refinementType: type,
          animate: true,
        },
      ]);
    } catch (refineError) {
      console.error(refineError);
      setError(getChatErrorMessage(refineError, "Could not refine the answer right now."));
      setRetryRefinePayload({ message, type });
    } finally {
      setRefiningState({ messageId: null, type: "" });
    }
  };

  return (
    <div className="chat-page">
      <section className="app-panel notes-library-hero">
        <span className="app-eyebrow">Study Chat</span>
        <div className="notes-library-header">
          <div>
            <h1 className="app-title">Ask questions about your own uploaded study material.</h1>
            <p className="app-subtitle">
              This chat keeps things simple. Ask a question, and it will answer using the
              most relevant uploaded document content when available.
            </p>
          </div>
          <div className="library-count-card">
            <p className="app-meta-label">Available Docs</p>
            <p className="library-count-value">{documents.length}</p>
          </div>
        </div>
      </section>

      {documentsLoading ? <div className="status-banner warning">Preparing your chat workspace...</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}
      {retryRefinePayload ? (
        <button
          type="button"
          className="secondary-cta chat-retry-button"
          onClick={() => handleRefine(retryRefinePayload)}
          disabled={Boolean(refiningState.messageId)}
        >
          Retry last follow-up
        </button>
      ) : null}

      <div className="chat-layout">
        <section className="app-panel chat-sidebar-card">
          <div className="quiz-sidebar-header">
            <h2 className="preview-title">Document scope</h2>
            <p className="preview-copy">
              Ask across all uploads or narrow the chat to one specific document.
            </p>
          </div>

          <label className="chat-filter-field">
            <span className="app-meta-label">Search scope</span>
            <select
              className="chat-select"
              value={selectedDocumentId}
              onChange={(event) => setSelectedDocumentId(event.target.value)}
              disabled={documentsLoading || isSending}
            >
              <option value="all">All documents</option>
              {documents.map((document) => (
                <option key={document.id} value={String(document.id)}>
                  {document.file_name}
                </option>
              ))}
            </select>
          </label>

          {documents.length === 0 && !documentsLoading ? (
            <div className="status-banner info">
              No uploaded documents yet. The chat will answer more generally until you upload one.
            </div>
          ) : null}
        </section>

        <section className="app-panel chat-main-card">
          <div className="chat-history">
            {messages.length === 0 ? (
              <div className="notes-placeholder">
                <div>
                  <strong>Your study chat will appear here.</strong>
                  Ask about a concept, definition, formula, or doubt, and the response will stay focused on that question.
                </div>
              </div>
            ) : (
              <div className="chat-thread">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`chat-message chat-message-${message.role}`}
                  >
                    <p className="app-meta-label">
                      {message.role === "user" ? "You" : "Study Assistant"}
                    </p>
                    {message.role === "assistant" ? (
                      <TypingText
                        text={message.content}
                        animate={Boolean(message.animate)}
                        onComplete={() => completeAnimatingMessage(message.id)}
                      />
                    ) : (
                      <div className="chat-message-copy">{message.content}</div>
                    )}
                    {message.role === "assistant" && !message.animate && message.sources?.length ? (
                      <div className="chat-sources">
                        <p className="app-meta-label">Sources</p>
                        {message.sources.map((source) => (
                          <div key={`${message.id}-${source.id}`} className="chat-source-card">
                            <strong>{source.fileName}</strong>
                            <p>{source.excerpt}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {message.role === "assistant" && !message.animate ? (
                      <div className="chat-message-actions">
                        {refineActions.map((action) => {
                          const isLoading =
                            refiningState.messageId === message.id &&
                            refiningState.type === action.type;

                          return (
                            <button
                              key={`${message.id}-${action.type}`}
                              type="button"
                              className="secondary-cta chat-action-button"
                              onClick={() => handleRefine({ message, type: action.type })}
                              disabled={
                                isSending ||
                                Boolean(refiningState.messageId) ||
                                animatingMessageIds.length > 0 ||
                                !message.content ||
                                !message.question
                              }
                            >
                              {isLoading ? "Loading..." : action.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                ))}
                {isSending ? (
                  <article className="chat-message chat-message-assistant chat-message-thinking">
                    <p className="app-meta-label">Study Assistant</p>
                    <div className="chat-thinking-row">
                      <span className="chat-thinking-label">Thinking</span>
                      <span className="chat-thinking-dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                    <div className="chat-message-copy chat-thinking-copy">
                      Searching your documents and preparing a response...
                    </div>
                  </article>
                ) : null}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <form className="chat-input-form" onSubmit={handleSubmit}>
            <textarea
              className="chat-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a question about your uploaded documents..."
                rows={4}
                disabled={isSending || animatingMessageIds.length > 0}
              />
            <div className="chat-form-actions">
              <p className="chat-form-copy">
                The chat uses matching document context when it finds it, then answers directly.
              </p>
              <button
                type="submit"
                className="primary-cta"
                disabled={isSending || animatingMessageIds.length > 0}
              >
                {isSending ? "Thinking..." : animatingMessageIds.length > 0 ? "Typing..." : "Send"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
