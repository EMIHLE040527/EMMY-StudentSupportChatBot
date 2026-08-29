import { useState } from "react";
import Login from "./Login";
import Chatbot from "./Chatbot";
import "./App.css";
import TimedTest from "./TimedTest";



function App() {

    // Holds { userId, firstName } after login; null while signed out.
    const [user, setUser] = useState(null);


    return user ? (

        <Chatbot user={user} onLogout={() => setUser(null)} />

    ) : (

        <Login onLogin={setUser} />

    );

}


export default App;
