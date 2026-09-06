import { useState } from "react";
import axios from "axios";

const API = "https://emmy-backend-7i0m.onrender.com";


function Login({ onLogin }) {

    const [mode, setMode] = useState("signin"); // "signin" | "register"

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);


    const switchMode = (next) => {
        setMode(next);
        setError("");
        setNotice("");
    };


    const handleSignIn = async (e) => {

        e.preventDefault();

        if (!email.trim() || !password) {
            setError("Enter your email and password to sign in.");
            return;
        }

        setBusy(true);
        setError("");

        try {

            const response = await axios.post(`${API}/login`, {
                Email: email.trim(),
                Password: password
            });

            onLogin({
                userId: response.data.UserID,
                firstName: response.data.FirstName
            });

        } catch (err) {

            if (err.response?.status === 401) {
                setError("That email and password don't match — try again?");
            } else {
                setError("Can't reach the server — is the backend running on port 5000?");
            }

        } finally {
            setBusy(false);
        }

    };


    const handleRegister = async (e) => {

        e.preventDefault();

        if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
            setError("Fill in every field to create your account.");
            return;
        }

        setBusy(true);
        setError("");

        try {

            await axios.post(`${API}/register`, {
                FirstName: firstName.trim(),
                LastName: lastName.trim(),
                Email: email.trim(),
                Password: password
            });

            setMode("signin");
            setPassword("");
            setNotice("Account created — sign in to start studying.");

        } catch (err) {

            setError(
                "Couldn't create the account — that email may already be registered."
            );

        } finally {
            setBusy(false);
        }

    };


    const registering = mode === "register";


    return (
        <div className="login-stage">

            <form
                className="login-card"
                onSubmit={registering ? handleRegister : handleSignIn}
            >

                <div className="wordmark login-logo">
                    emmy<span className="dot">.</span>
                </div>

                <p className="login-tag">
                    {registering
                        ? "Create your account — it takes a minute."
                        : "Welcome back. Let's get studying."}
                </p>

                {registering && (
                    <div className="name-fields">
                        <div className="field">
                            <label htmlFor="firstName">First name</label>
                            <input
                                id="firstName"
                                type="text"
                                placeholder="Ntlaka"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="lastName">Last name</label>
                            <input
                                id="lastName"
                                type="text"
                                placeholder="Mgaguli"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <div className="field">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        placeholder="you@university.ac.za"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="field">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                {error && <p className="form-error">{error}</p>}
                {notice && !error && <p className="form-notice">{notice}</p>}

                <button className="btn-primary" type="submit" disabled={busy}>
                    {busy
                        ? "One moment…"
                        : registering
                            ? "Create account"
                            : "Sign in"}
                </button>

                <div className="login-alt">
                    {registering ? (
                        <>
                            Already registered?{" "}
                            <button
                                type="button"
                                className="link-btn"
                                onClick={() => switchMode("signin")}
                            >
                                Sign in
                            </button>
                        </>
                    ) : (
                        <>
                            New here?{" "}
                            <button
                                type="button"
                                className="link-btn"
                                onClick={() => switchMode("register")}
                            >
                                Create an account
                            </button>
                        </>
                    )}
                </div>

            </form>

        </div>
    );

}


export default Login;
