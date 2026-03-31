import { useEffect, useMemo, useState } from "react";
import { fetchQuizAnalysis } from "../api";
import "../App.css";

const chartWidth = 760;
const chartHeight = 260;
const chartPadding = 28;

const formatAttemptDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function buildChartPoints(attempts) {
  if (!attempts.length) {
    return [];
  }

  const safeWidth = chartWidth - chartPadding * 2;
  const safeHeight = chartHeight - chartPadding * 2;

  if (attempts.length === 1) {
    const singleAttempt = attempts[0];
    const y = chartHeight - chartPadding - (Number(singleAttempt.percentage) / 100) * safeHeight;

    return [
      {
        ...singleAttempt,
        x: chartWidth / 2,
        y,
      },
    ];
  }

  return attempts.map((attempt, index) => {
    const x = chartPadding + (index / (attempts.length - 1)) * safeWidth;
    const y = chartHeight - chartPadding - (Number(attempt.percentage) / 100) * safeHeight;

    return {
      ...attempt,
      x,
      y,
    };
  });
}

export default function Analysis() {
  const [analysis, setAnalysis] = useState({ attempts: [], summary: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        const res = await fetchQuizAnalysis();
        setAnalysis({
          attempts: Array.isArray(res?.attempts) ? res.attempts : [],
          summary: res?.summary ?? null,
        });
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to load quiz analysis right now.");
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
  }, []);

  const attempts = analysis.attempts;
  const summary = analysis.summary ?? {
    totalAttempts: 0,
    averagePercentage: 0,
    bestPercentage: 0,
    latestPercentage: 0,
  };

  const chartPoints = useMemo(() => buildChartPoints(attempts), [attempts]);
  const chartPath = useMemo(() => {
    if (!chartPoints.length) {
      return "";
    }

    return chartPoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
  }, [chartPoints]);

  const trendLabel = useMemo(() => {
    if (attempts.length < 2) {
      return "Complete at least two quizzes to see your trend.";
    }

    const latest = Number(attempts[attempts.length - 1].percentage);
    const previous = Number(attempts[attempts.length - 2].percentage);

    if (latest > previous) {
      return `Improved by ${latest - previous}% compared with your previous quiz.`;
    }

    if (latest < previous) {
      return `Down by ${previous - latest}% compared with your previous quiz.`;
    }

    return "Your last two quiz scores are identical.";
  }, [attempts]);

  return (
    <div className="analysis-page">
      <section className="app-panel notes-library-hero">
        <span className="app-eyebrow">Performance Analysis</span>
        <div className="notes-library-header">
          <div>
            <h1 className="app-title">Track quiz marks, consistency, and improvement over time.</h1>
            <p className="app-subtitle">
              This dashboard turns your saved quiz attempts into a quick progress view with a marks graph,
              trend insight, and a history table for every quiz you complete.
            </p>
          </div>
          <div className="library-count-card">
            <p className="app-meta-label">Attempts</p>
            <p className="library-count-value">{summary.totalAttempts}</p>
          </div>
        </div>
      </section>

      {loading ? <div className="status-banner warning">Loading analysis...</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}

      {!loading && !error ? (
        <>
          <section className="analysis-summary-grid">
            <article className="app-panel analysis-summary-card">
              <p className="app-meta-label">Average Score</p>
              <h2 className="analysis-summary-value">{summary.averagePercentage}%</h2>
              <p className="preview-copy">Your overall average across all saved quizzes.</p>
            </article>

            <article className="app-panel analysis-summary-card">
              <p className="app-meta-label">Best Score</p>
              <h2 className="analysis-summary-value">{summary.bestPercentage}%</h2>
              <p className="preview-copy">The highest percentage you have achieved so far.</p>
            </article>

            <article className="app-panel analysis-summary-card">
              <p className="app-meta-label">Latest Score</p>
              <h2 className="analysis-summary-value">{summary.latestPercentage}%</h2>
              <p className="preview-copy">{trendLabel}</p>
            </article>
          </section>

          <section className="analysis-layout">
            <article className="app-panel analysis-chart-panel">
              <div className="preview-header">
                <div>
                  <h2 className="preview-title">Marks History Graph</h2>
                  <p className="preview-copy">
                    Each point represents one quiz result. Higher points mean stronger performance.
                  </p>
                </div>
                <span className="preview-chip">Range: 0% to 100%</span>
              </div>

              {attempts.length ? (
                <div className="analysis-chart-wrap">
                  <div className="analysis-chart-axis-labels">
                    <span>100%</span>
                    <span>75%</span>
                    <span>50%</span>
                    <span>25%</span>
                    <span>0%</span>
                  </div>

                  <svg
                    className="analysis-chart"
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    role="img"
                    aria-label="Quiz marks history graph"
                  >
                    {[0, 25, 50, 75, 100].map((value) => {
                      const y = chartHeight - chartPadding - (value / 100) * (chartHeight - chartPadding * 2);

                      return (
                        <line
                          key={value}
                          x1={chartPadding}
                          y1={y}
                          x2={chartWidth - chartPadding}
                          y2={y}
                          className="analysis-grid-line"
                        />
                      );
                    })}

                    <path d={chartPath} className="analysis-chart-line" />

                    {chartPoints.map((point) => (
                      <g key={point.id}>
                        <circle cx={point.x} cy={point.y} r="7" className="analysis-chart-dot" />
                        <title>{`Attempt ${point.attempt_number}: ${point.percentage}% in ${point.file_name}`}</title>
                      </g>
                    ))}
                  </svg>

                  <div className="analysis-chart-xlabels">
                    {attempts.map((attempt) => (
                      <span key={attempt.id}>#{attempt.attempt_number}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="notes-placeholder">
                  <div>
                    <strong>No quiz attempts yet.</strong>
                    Finish at least one quiz to start building your analysis history.
                  </div>
                </div>
              )}
            </article>

            <article className="app-panel analysis-history-panel">
              <div className="preview-header">
                <div>
                  <h2 className="preview-title">Attempt History</h2>
                  <p className="preview-copy">Review every stored quiz result and its related document.</p>
                </div>
              </div>

              {attempts.length ? (
                <div className="analysis-history-list">
                  {[...attempts].reverse().map((attempt) => (
                    <article key={attempt.id} className="analysis-history-card">
                      <div className="analysis-history-top">
                        <div>
                          <p className="app-meta-label">Attempt #{attempt.attempt_number}</p>
                          <h3 className="analysis-history-title">{attempt.file_name}</h3>
                        </div>
                        <span className="analysis-score-badge">{attempt.percentage}%</span>
                      </div>

                      <div className="analysis-history-meta">
                        <span className="document-tag">{attempt.difficulty}</span>
                        <span className="document-tag">
                          {attempt.score}/{attempt.total_questions} correct
                        </span>
                        <span className="document-tag">{formatAttemptDate(attempt.created_at)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="notes-placeholder">
                  <div>
                    <strong>Your history is empty right now.</strong>
                    Saved quiz results will appear here automatically.
                  </div>
                </div>
              )}
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
