import React, { useState } from "react";
import axios from "axios";
import "./BursarySidebar.css";

const API = "https://emmy-backend-7i0m.onrender.com";

function BursarySidebar() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  /*
   * =====================================================
   * FILE SELECTION
   * =====================================================
   */

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];

    setError("");
    setResult(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const filename = selectedFile.name.toLowerCase();

    if (
      !filename.endsWith(".pdf") &&
      !filename.endsWith(".docx")
    ) {
      setError(
        "Please upload a PDF or Word (.docx) transcript."
      );

      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  /*
   * =====================================================
   * ANALYSE TRANSCRIPT
   * =====================================================
   */

  const analyseTranscript = async () => {
    if (!file) {
      setError(
        "Please upload your academic transcript first."
      );
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();

      /*
       * Send the original file exactly as selected.
       */
      formData.append(
        "transcript",
        file,
        file.name
      );

      console.log(
        "Uploading transcript:",
        file.name
      );

      console.log(
        "File size:",
        file.size,
        "bytes"
      );

      const response = await axios.post(
        `${API}/api/bursaries/analyse`,
        formData
      );

      console.log(
        "Bursary analysis response:",
        response.data
      );

      if (
        response.data &&
        response.data.success
      ) {
        setResult(response.data.data);
      } else {
        setError(
          response.data?.message ||
            "Unable to analyse transcript."
        );
      }
    } catch (error) {
      console.error(
        "Bursary analysis error:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Could not connect to the EMMY server."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * =====================================================
   * RESET
   * =====================================================
   */

  const reset = () => {
    setFile(null);
    setResult(null);
    setError("");
  };

  /*
   * =====================================================
   * BURSARY STATUS
   * =====================================================
   */

  const getBursaryStatus = (bursary) => {
    if (bursary.potential_match) {
      return {
        text: "Potential Match",
        className: "potential",
      };
    }

    if (
      result?.average !== null &&
      bursary.minimum_average !== null &&
      result?.average <
        bursary.minimum_average
    ) {
      return {
        text: "Below Academic Minimum",
        className: "below-minimum",
      };
    }

    return {
      text: "Check Eligibility",
      className: "check-eligibility",
    };
  };

  return (
    <div className="bursary-sidebar">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="bursary-header">

        <div className="bursary-icon">
          🎓
        </div>

        <div>
          <h2>
            Bursary & Funding
          </h2>

          <p>
            Find funding opportunities
            based on your studies.
          </p>
        </div>

      </div>


      {/* =================================================
          UPLOAD SECTION
      ================================================= */}

      {!result && !loading && (

        <div className="bursary-upload-section">

          <div className="upload-box">

            <div className="upload-icon">
              📄
            </div>

            <h3>
              Upload your transcript
            </h3>

            <p>
              Upload your academic transcript
              in PDF or Word format.
            </p>

            <label className="upload-button">

              Choose Transcript

              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
                hidden
              />

            </label>


            {/* SELECTED FILE */}

            {file && (

              <div className="selected-file">

                <span>
                  📎
                </span>

                <span>
                  {file.name}
                </span>

              </div>

            )}

          </div>


          {/* ERROR */}

          {error && (

            <div className="bursary-error">
              ⚠️ {error}
            </div>

          )}


          {/* ANALYSE BUTTON */}

          <button
            className="find-bursaries-button"
            onClick={analyseTranscript}
            disabled={!file || loading}
          >

            {loading
              ? "Analysing Transcript..."
              : "🔍 Find Matching Bursaries"
            }

          </button>

        </div>

      )}


      {/* =================================================
          LOADING
      ================================================= */}

      {loading && (

        <div className="loading-section">

          <div className="spinner"></div>

          <h3>
            EMMY is analysing your transcript
          </h3>

          <p>
            Reading your transcript,
            calculating your average and
            checking funding requirements...
          </p>

        </div>

      )}


      {/* =================================================
          RESULTS
      ================================================= */}

      {result && (

        <div className="bursary-results">


          {/* =================================================
              ACADEMIC SUMMARY
          ================================================= */}

          <div className="student-summary">

            <h3>
              📊 Academic Summary
            </h3>


            <div className="summary-item">

              <span>
                Course
              </span>

              <strong>
                {result.course ||
                  "Not detected"}
              </strong>

            </div>


            <div className="summary-item">

              <span>
                Current Study Level
              </span>

              <strong>
                {result.study_level ===
                "unknown"
                  ? "Not detected"
                  : result.study_level}
              </strong>

            </div>


            {/* TARGET STUDY LEVEL */}

            {result.target_study_level && (

              <div className="summary-item">

                <span>
                  Funding Level
                </span>

                <strong>
                  {result.target_study_level}
                </strong>

              </div>

            )}


            {/* NQF */}

            {result.nqf_level !==
              undefined &&
              result.nqf_level !== null && (

                <div className="summary-item">

                  <span>
                    NQF Level
                  </span>

                  <strong>
                    {result.nqf_level}
                  </strong>

                </div>

              )}


            {/* AVERAGE */}

            <div className="average-box">

              <span>
                Academic Average
              </span>

              <strong>
                {result.average !== null &&
                result.average !==
                  undefined
                  ? `${result.average}%`
                  : "Not calculated"}
              </strong>

            </div>


            {/* MARK COUNT */}

            <div className="marks-found">

              {result.marks_found || 0} marks
              detected

            </div>

          </div>


          {/* =================================================
              RESULTS HEADER
          ================================================= */}

          <div className="results-header">

            <h3>
              🎓 Bursary Opportunities
            </h3>

            <p>
              EMMY found these funding
              opportunities based on your
              detected academic information.
            </p>

          </div>


          {/* =================================================
              BURSARY CARDS
          ================================================= */}

          {result.bursaries &&
            result.bursaries.length > 0 ? (

            result.bursaries.map(
              (bursary) => {

                const status =
                  getBursaryStatus(
                    bursary
                  );

                return (

                  <div
                    className="bursary-card"
                    key={bursary.id}
                  >

                    {/* CARD HEADER */}

                    <div className="bursary-card-header">

                      <div>

                        <h4>
                          {bursary.name}
                        </h4>

                        <p>
                          {bursary.provider}
                        </p>

                      </div>


                      {/* STATUS */}

                      <span
                        className={`match-badge ${status.className}`}
                      >
                        {status.text}
                      </span>

                    </div>


                    {/* DESCRIPTION */}

                    <p className="bursary-description">
                      {bursary.description}
                    </p>


                    {/* MINIMUM AVERAGE */}

                    {bursary.minimum_average !==
                      undefined &&
                      bursary.minimum_average !==
                        null && (

                        <div className="requirement">

                          <strong>
                            Minimum average:
                          </strong>

                          <span>
                            {
                              bursary.minimum_average
                            }%
                          </span>

                        </div>

                      )}


                    {/* USER AVERAGE */}

                    {result.average !==
                      null &&
                      result.average !==
                        undefined && (

                        <div className="your-average">

                          <strong>
                            Your average:
                          </strong>

                          <span>
                            {result.average}%
                          </span>

                          {bursary.minimum_average !==
                            undefined &&
                            bursary.minimum_average !==
                              null && (

                              result.average >=
                              bursary.minimum_average ? (

                                <span className="check">
                                  ✓
                                </span>

                              ) : (

                                <span className="check">
                                  ⚠️
                                </span>

                              )

                            )}

                        </div>

                      )}


                    {/* WHY MATCH */}

                    {bursary.reasons &&
                      bursary.reasons.length >
                        0 && (

                        <div className="why-match">

                          <strong>
                            Information:
                          </strong>

                          <ul>

                            {bursary.reasons.map(
                              (
                                reason,
                                index
                              ) => (

                                <li
                                  key={
                                    index
                                  }
                                >
                                  {reason}
                                </li>

                              )
                            )}

                          </ul>

                        </div>

                      )}


                    {/* BELOW MINIMUM MESSAGE */}

                    {result.average !==
                      null &&
                      bursary.minimum_average !==
                        undefined &&
                      result.average <
                        bursary.minimum_average && (

                        <div className="bursary-warning">

                          ⚠️ Your detected average
                          is below this bursary's
                          stated academic minimum.
                          Check the official
                          requirements before
                          deciding whether to apply.

                        </div>

                      )}


                    {/* ACTION BUTTONS */}

                    <div className="bursary-actions">


                      {/* OFFICIAL LINK */}

                      {(bursary.official_url ||
                        bursary.url) ? (

                        <a
                          href={
                            bursary.official_url ||
                            bursary.url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="view-button"
                        >
                          🌐 View Official Bursary
                        </a>

                      ) : (

                        <button
                          type="button"
                          className="view-button"
                          onClick={() =>
                            alert(
                              "The official bursary link is currently unavailable."
                            )
                          }
                        >
                          🌐 Official Link Unavailable
                        </button>

                      )}


                      {/* REMINDER */}

                      <button
                        type="button"
                        className="reminder-button"
                        onClick={() =>
                          alert(
                            "Reminder feature can be connected to your existing EMMY reminder system."
                          )
                        }
                      >
                        🔔 Set Reminder
                      </button>

                    </div>


                    {/* OFFICIAL LINK NOTE */}

                    {(bursary.official_url ||
                      bursary.url) && (

                      <p className="official-link-note">
                        🔗 Opens the official
                        bursary website in a
                        new tab.
                      </p>

                    )}

                  </div>

                );
              }
            )

          ) : (

            /* =================================================
               NO BURSARIES RETURNED
            ================================================= */

            <div className="no-matches">

              <div>
                🔎
              </div>

              <h3>
                No bursaries returned
              </h3>

              <p>
                EMMY could not find funding
                opportunities from the current
                bursary database.
              </p>

            </div>

          )}


          {/* =================================================
              IMPORTANT NOTE
          ================================================= */}

          <div className="important-note">

            <strong>
              ⚠️ Important
            </strong>

            <p>
              EMMY identifies funding
              opportunities using information
              detected from your transcript.
              Always check the official
              bursary requirements, closing
              dates and eligibility conditions
              before applying.
            </p>

          </div>


          {/* =================================================
              START AGAIN
          ================================================= */}

          <button
            className="start-again"
            onClick={reset}
          >
            ← Upload Another Transcript
          </button>

        </div>

      )}

    </div>
  );
}

export default BursarySidebar;