import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import Textbook from './pages/Textbook';

function App() {
  return (
    <Router>
      <div className="h-screen flex flex-col overflow-hidden bg-main text-text">
        <Header />
        <div className="flex min-h-0 flex-1 flex-col">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/course/:courseId" element={<Textbook />} />
            <Route path="/course/:courseId/:lessonId" element={<Textbook />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App
