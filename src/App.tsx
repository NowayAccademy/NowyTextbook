import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import Textbook from './pages/Textbook';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-main flex flex-col text-text">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/course/:courseId" element={<Textbook />} />
          <Route path="/course/:courseId/:lessonId" element={<Textbook />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App
