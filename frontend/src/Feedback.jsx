
import { useState } from "react";
import axios from "axios";
import "./Feedback.css";

const API = "http://127.0.0.1:5000";

const FEATURES = [
  "Overall Chatbot Experience",
  "Chat Responses",
  "Notes Upload",
  "Summary",
  "Flashcards",
  "Quiz",
  "Listen & Learn",
  "Timed Test",
  "Study Timer",
  "Coloring Game",
  "Bursary Finder",
  "Reminders",
  "Daily Motivation"
];

export default function Feedback({ user }) {
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [ratings, setRatings] = useState({});
  const [comment, setComment] = useState("");
  const [hoverRatings, setHoverRatings] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const toggleFeature = (feature) => {
    setError("");

    if (selectedFeatures.includes(feature)) {
      setSelectedFeatures((previous) =>
        previous.filter((item) => item !== feature)
      );

      setRatings((previous) => {
        const updated = { ...previous };
        delete updated[feature];
        return updated;
      });

      setHoverRatings((previous) => {
        const updated = { ...previous };
        delete updated[feature];
        return updated;
      });
    } else {
      setSelectedFeatures((previous) => [
        ...previous,
        feature
      ]);
    }
  };

  const setFeatureRating = (feature, rating) => {
    setRatings((previous) => ({
      ...previous,
      [feature]: rating
    }));

    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (selectedFeatures.length === 0) {
      setError("Please select at least one feature.");
      return;
    }

    const unrated = selectedFeatures.filter(
      (feature) =>
        !Number.isInteger(ratings[feature]) ||
        ratings[feature] < 1 ||
        ratings[feature] > 5
    );

    if (unrated.length > 0) {
      setError(
        "Please give a star rating to every selected feature."
      );
      return;
    }

    if (!comment.trim()) {
      setError("Please write your feedback before submitting.");
      return;
    }

    const featureRatings = selectedFeatures.map(
      (feature) => ({
        feature,
        rating: ratings[feature]
      })
    );

    try {
      setSubmitting(true);

      await axios.post(`${API}/feedback`, {
        user_id: user?.userId ?? null,
        feature_ratings: featureRatings,
        comment: comment.trim()
      });

      setSuccess(true);
      setSelectedFeatures([]);
      setRatings({});
      setHoverRatings({});
      setComment("");
    } catch (err) {
      console.error("Feedback submission error:", err);

      setError(
        err.response?.data?.error ||
        "Unable to submit feedback. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSuccess(false);
    setError("");
    setSelectedFeatures([]);
    setRatings({});
    setHoverRatings({});
    setComment("");
  };

  return (
    <main className="emmy-feedback-page">
      <section className="emmy-feedback-card">
        <div className="emmy-feedback-icon">
          ♡
        </div>

        {success ? (
          <div className="emmy-feedback-thanks">
            <div className="emmy-feedback-success-icon">
              ✓
            </div>

            <h2>Thank You for Your Feedback!</h2>

            <p>
              Your feedback and feature ratings have
              been submitted successfully. Thank you
              for helping us improve emmy.
            </p>

            <button
              type="button"
              className="emmy-feedback-submit"
              onClick={resetForm}
            >
              Submit More Feedback
            </button>
          </div>
        ) : (
          <>
            <h2>Share Your Feedback</h2>

            <p className="emmy-feedback-intro">
              Tell us about your experience using emmy.
              Select the features you want to review,
              rate each one and share your suggestions.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="emmy-feedback-field">
                <label>
                  Which features are you reviewing?
                  <span className="required"> *</span>
                </label>

                <p className="emmy-feedback-help">
                  Select one or more features.
                </p>

                <div className="emmy-feature-grid">
                  {FEATURES.map((feature) => {
                    const selected =
                      selectedFeatures.includes(feature);

                    return (
                      <label
                        key={feature}
                        className={
                          "emmy-feature-option" +
                          (selected ? " selected" : "")
                        }
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            toggleFeature(feature)
                          }
                        />

                        <span>{feature}</span>
                      </label>
                    );
                  })}
                </div>

                <p className="emmy-feedback-selection-count">
                  {selectedFeatures.length}{" "}
                  {selectedFeatures.length === 1
                    ? "feature"
                    : "features"}{" "}
                  selected
                </p>
              </div>

              {selectedFeatures.length > 0 && (
                <div className="emmy-feedback-field">
                  <label>
                    Rate your selected features
                    <span className="required"> *</span>
                  </label>

                  <p className="emmy-feedback-help">
                    Give each selected feature a rating
                    from 1 to 5 stars.
                  </p>

                  <div className="emmy-feature-ratings">
                    {selectedFeatures.map((feature) => {
                      const selectedRating =
                        ratings[feature] || 0;

                      const visibleRating =
                        hoverRatings[feature] ||
                        selectedRating;

                      return (
                        <div
                          className="emmy-feature-rating-card"
                          key={feature}
                        >
                          <div className="emmy-feature-rating-header">
                            <strong>{feature}</strong>

                            <span>
                              {selectedRating
                                ? `${selectedRating}/5`
                                : "Not rated"}
                            </span>
                          </div>

                          <div
                            className="emmy-feedback-stars"
                            role="group"
                            aria-label={`Rate ${feature}`}
                          >
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                aria-label={`${star} star${
                                  star === 1 ? "" : "s"
                                } for ${feature}`}
                                aria-pressed={
                                  selectedRating === star
                                }
                                className={
                                  star <= visibleRating
                                    ? "selected"
                                    : ""
                                }
                                onMouseEnter={() =>
                                  setHoverRatings(
                                    (previous) => ({
                                      ...previous,
                                      [feature]: star
                                    })
                                  )
                                }
                                onMouseLeave={() =>
                                  setHoverRatings(
                                    (previous) => ({
                                      ...previous,
                                      [feature]: 0
                                    })
                                  )
                                }
                                onFocus={() =>
                                  setHoverRatings(
                                    (previous) => ({
                                      ...previous,
                                      [feature]: star
                                    })
                                  )
                                }
                                onBlur={() =>
                                  setHoverRatings(
                                    (previous) => ({
                                      ...previous,
                                      [feature]: 0
                                    })
                                  )
                                }
                                onClick={() =>
                                  setFeatureRating(
                                    feature,
                                    star
                                  )
                                }
                              >
                                ★
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="emmy-feedback-field">
                <label htmlFor="emmy-feedback-comment">
                  Tell us about your experience
                  <span className="required"> *</span>
                </label>

                <textarea
                  id="emmy-feedback-comment"
                  value={comment}
                  maxLength={2000}
                  rows={5}
                  onChange={(event) =>
                    setComment(event.target.value)
                  }
                  placeholder="What worked well? Which features could be improved?"
                />

                <span className="emmy-feedback-char-count">
                  {comment.length}/2000 characters
                </span>
              </div>

              {error && (
                <div
                  className="emmy-feedback-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="emmy-feedback-submit"
                disabled={submitting}
              >
                {submitting
                  ? "Submitting Feedback..."
                  : "✉ Submit Feedback"}
              </button>
            </form>

            <p className="emmy-feedback-footer">
              Your feedback helps improve emmy's
              features and overall student experience.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
