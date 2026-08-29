import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://127.0.0.1:5000";

// South Africa's official languages, English first because it is the language
// most courses are taught in. Every name fits UserProfiles.PreferredLanguage
// (VARCHAR 20). "" means the student has not chosen, and emmy just follows
// whatever language they write in.
const LANGUAGES = [
    "English",
    "isiZulu",
    "isiXhosa",
    "Afrikaans",
    "Sepedi",
    "Setswana",
    "Sesotho",
    "Xitsonga",
    "siSwati",
    "Tshivenda",
    "isiNdebele"
];

const YEARS = [1, 2, 3, 4, 5, 6];


function Profile({ user, onSaved }) {

    const [profile, setProfile] = useState(null);
    const [course, setCourse] = useState("");
    const [yearLevel, setYearLevel] = useState("");
    const [language, setLanguage] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");


    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const res = await axios.get(`${API}/profile`, {
                    params: { user_id: user.userId }
                });

                if (cancelled) return;

                setProfile(res.data);
                setCourse(res.data.course || "");
                setYearLevel(res.data.year_level ? String(res.data.year_level) : "");
                setLanguage(res.data.preferred_language || "");

            } catch {
                if (!cancelled) {
                    setError("I couldn't load your profile. Check that the backend is running, then try again.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [user.userId]);


    const save = async (e) => {
        e.preventDefault();

        if (saving) return;

        setSaving(true);
        setError("");
        setNotice("");

        try {
            const res = await axios.put(`${API}/profile`, {
                user_id: user.userId,
                course,
                year_level: yearLevel,
                preferred_language: language
            });

            setNotice("Saved.");
            onSaved?.(res.data.preferred_language);

        } catch (err) {
            setError(err.response?.data?.error || "I couldn't save your profile. Try again?");
        } finally {
            setSaving(false);
        }
    };


    return (
        <div className="tool-main">

            <div className="chat-head">
                <h1>Profile</h1>
                <span className="status">{profile?.email}</span>
            </div>

            <div className="tool-scroll">

                {loading ? (
                    <p className="tool-empty">Loading your profile…</p>
                ) : (
                    <form className="tool-card" onSubmit={save}>

                        <div className="tool-label">Your account</div>

                        <p className="prof-static">
                            {profile ? `${profile.first_name} ${profile.last_name}` : user.firstName}
                            {profile?.email && <span className="prof-email">{profile.email}</span>}
                        </p>

                        <div className="tool-label">Your studies</div>

                        <div className="field">
                            <label htmlFor="prof-course">Course</label>
                            <input
                                id="prof-course"
                                type="text"
                                placeholder="BSc Computer Science"
                                value={course}
                                onChange={(e) => setCourse(e.target.value)}
                                maxLength={100}
                                autoComplete="off"
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="prof-year">Year of study</label>
                            <select
                                id="prof-year"
                                value={yearLevel}
                                onChange={(e) => setYearLevel(e.target.value)}
                            >
                                <option value="">Not set</option>
                                {YEARS.map((y) => (
                                    <option key={y} value={y}>Year {y}</option>
                                ))}
                            </select>
                        </div>

                        <div className="field">
                            <label htmlFor="prof-language">Preferred language</label>
                            <select
                                id="prof-language"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                            >
                                <option value="">No preference</option>
                                {LANGUAGES.map((l) => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                            <p className="field-hint">
                                emmy starts new answers in this language. Write to her in any other
                                language and she switches to that one.
                            </p>
                        </div>

                        {error && <p className="form-error">{error}</p>}
                        {notice && <p className="form-notice">{notice}</p>}

                        <button className="btn-tool" type="submit" disabled={saving}>
                            {saving ? "Saving…" : "Save profile"}
                        </button>

                    </form>
                )}

            </div>

        </div>
    );

}


export default Profile;
