import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import AppLayout from "./layouts/AppLayout";
import Notes from "./pages/Notes";
import ComingSoon from "./pages/ComingSoon";
import NotesList from "./pages/NotesList";
import Documents from "./pages/Documents";
import Quiz from "./pages/Quiz";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import OnboardingUpload from "./pages/OnboardingUpload";
import DocumentViewer from "./pages/DocumentViewer";
import Chat from "./pages/Chat";
import ProtectedRoute from "./components/ProtectedRoute";



function App() {
  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingUpload />
          </ProtectedRoute>
        }
      />

      {/* App layout with sidebar */}
      <Route path="/app" element={
        <ProtectedRoute>
            <AppLayout />
        </ProtectedRoute>
        }>
        <Route path="notes" element={<Notes />} />
        <Route path="notes/list" element={<NotesList />} />
        <Route path="documents" element={<Documents />} />
        <Route path="documents/:id/view" element={<DocumentViewer />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="chat" element={<Chat />} />
      </Route>
    </Routes>
  );
}

export default App;
