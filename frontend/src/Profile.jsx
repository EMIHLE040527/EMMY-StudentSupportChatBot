import { useEffect, useState } from "react";
import axios from "axios";

const API = "https://emmy-backend-7i0m.onrender.com";

// South Africa's official languages, English first because it is the language
// most courses are taught in. Every name fits UserProfiles.PreferredLanguage
// (VARCHAR 20). "" means the student has not chosen, and emmy just follows
// whatever language they write in.


// South Africa's official languages
const LANGUAGES = [
    "English",
    "isiZulu",
    "isiXhosa",
    "Afrikaans",
    "Sepedi",
    "Setswana",
    "Sesotho",
    "itsonga",
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

    const [location, setLocation] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");


    // Load profile
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
                setYearLevel(
                    res.data.year_level
                        ? String(res.data.year_level)
                        : ""
                );
                setLanguage(res.data.preferred_language || "");

                setLocation(res.data.location || "");
                setLatitude(res.data.latitude || "");
                setLongitude(res.data.longitude || "");

            } catch {
                if (!cancelled) {
                    setError(
                        "I couldn't load your profile. Check that the backend is running, then try again."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            cancelled = true;
        };

    }, [user.userId]);


    // Get student's current location
    const getCurrentLocation = () => {

        if (!navigator.geolocation) {
            setError(
                "Your browser does not support location services."
            );
            return;
        }

        setError("");
        setNotice("Getting your location...");

        navigator.geolocation.getCurrentPosition(

            async (position) => {

                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                setLatitude(String(lat));
                setLongitude(String(lon));

                try {

                    // Reverse geocoding using BigDataCloud
                    const response = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
                    );

                    const data = await response.json();

                    const place =
                        data.city ||
                        data.locality ||
                        data.principalSubdivision ||
                        "Current location";

                    setLocation(place);

                    setNotice(
                        `Location detected: ${place}. Click "Save profile" to save it.`
                    );

                } catch (err) {

                    console.error(
                        "Location lookup failed:",
                        err
                    );

                    setLocation("Current location");

                    setNotice(
                        "Your location was detected. Click 'Save profile' to save it."
                    );
                }
            },

            (error) => {

                console.error(
                    "Geolocation error:",
                    error
                );

                setNotice("");

                if (error.code === error.PERMISSION_DENIED) {

                    setError(
                        "Location permission was denied. Please allow location access in your browser."
                    );

                } else if (error.code === error.POSITION_UNAVAILABLE) {

                    setError(
                        "Your location is currently unavailable. Please try again."
                    );

                } else if (error.code === error.TIMEOUT) {

                    setError(
                        "The location request timed out. Please try again."
                    );

                } else {

                    setError(
                        "I couldn't determine your location. Please try again."
                    );
                }
            },

            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    };


    // Save profile
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
 
    preferred_language: language, 
 
    location, 
 
    latitude, 
 
    longitude 
});


// Save the student's location for the weather
localStorage.setItem("emmy_location", location);
localStorage.setItem("emmy_latitude", latitude);
localStorage.setItem("emmy_longitude", longitude);
 
 
setProfile((prev) => ({ 
    ...prev, 
    course, 
    year_level: yearLevel, 
    preferred_language: language, 
    location, 
    latitude, 
    longitude 
})); 

            setNotice("Profile saved successfully.");

            onSaved?.(res.data.preferred_language);

        } catch (err) {

            setError(
                err.response?.data?.error ||
                "I couldn't save your profile. Try again?"
            );

        } finally {

            setSaving(false);
        }
    };


    return (
        <div className="tool-main">

            <div className="chat-head">

                <h1>Profile</h1>

                <span className="status">
                    {profile?.email}
                </span>

            </div>


            <div className="tool-scroll">

                {loading ? (

                    <p className="tool-empty">
                        Loading your profile…
                    </p>

                ) : (

                    <form
                        className="tool-card"
                        onSubmit={save}
                    >

                        <div className="tool-label">
                            Your account
                        </div>


                        <p className="prof-static">

                            {profile
                                ? `${profile.first_name} ${profile.last_name}`
                                : user.firstName
                            }

                            {profile?.email && (
                                <span className="prof-email">
                                    {profile.email}
                                </span>
                            )}

                        </p>


                        <div className="tool-label">
                            Your studies
                        </div>


                        {/* Course */}

                        <div className="field">

                            <label htmlFor="prof-course">
                                Course
                            </label>

                            <input
                                id="prof-course"
                                type="text"
                                placeholder="BSc Computer Science"
                                value={course}
                                onChange={(e) =>
                                    setCourse(e.target.value)
                                }
                                maxLength={100}
                                autoComplete="off"
                            />

                        </div>


                        {/* Year */}

                        <div className="field">

                            <label htmlFor="prof-year">
                                Year of study
                            </label>

                            <select
                                id="prof-year"
                                value={yearLevel}
                                onChange={(e) =>
                                    setYearLevel(e.target.value)
                                }
                            >

                                <option value="">
                                    Not set
                                </option>

                                {YEARS.map((y) => (

                                    <option
                                        key={y}
                                        value={y}
                                    >
                                        Year {y}
                                    </option>

                                ))}

                            </select>

                        </div>


                        {/* Location */}

                        <div className="field">

                            <label htmlFor="prof-location">
                                Location
                            </label>

                            <input
                                id="prof-location"
                                type="text"
                                placeholder="Enter your city or location"
                                value={location}
                                onChange={(e) =>
                                    setLocation(e.target.value)
                                }
                                maxLength={100}
                                autoComplete="off"
                            />


                            <button
                                type="button"
                                className="location-button"
                                onClick={getCurrentLocation}
                            >
                                Use my current location
                            </button>


                            <p className="field-hint">
                                Emmy will use your location to show the weather for where you are.
                            </p>

                        </div>


                        {/* Preferred language */}

                        <div className="field">

                            <label htmlFor="prof-language">
                                Preferred language
                            </label>

                            <select
                                id="prof-language"
                                value={language}
                                onChange={(e) =>
                                    setLanguage(e.target.value)
                                }
                            >

                                <option value="">
                                    No preference
                                </option>

                                {LANGUAGES.map((l) => (

                                    <option
                                        key={l}
                                        value={l}
                                    >
                                        {l}
                                    </option>

                                ))}

                            </select>


                            <p className="field-hint">
                                emmy starts new answers in this language.
                                Write to her in any other language and she
                                switches to that one.
                            </p>

                        </div>


                        {/* Messages */}

                        {error && (
                            <p className="form-error">
                                {error}
                            </p>
                        )}

                        {notice && (
                            <p className="form-notice">
                                {notice}
                            </p>
                        )}


                        {/* Save */}

                        <button
                            className="btn-tool"
                            type="submit"
                            disabled={saving}
                        >
                            {saving
                                ? "Saving…"
                                : "Save profile"
                            }
                        </button>

                    </form>

                )}

            </div>

        </div>
    );
}


export default Profile;