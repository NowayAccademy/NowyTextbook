import React from 'react';
import { Link } from 'react-router-dom';
import NOWAYLogo from "../assets/NOWAYLogo.png";

// ヘッダーコンポーネント
const Header = () => {
  return (
    <header className="flex items-center p-4 bg-main border-b border-accent">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-15 h-15">
            <img
              src={NOWAYLogo}
              alt="NOWAY Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <span
            className="text-2xl text-text"
            style={{
              fontFamily: '"Arimo", sans-serif',
              fontStyle: "italic",
              fontWeight: 700,
            }}
          >
            NOWAY
          </span>
        </Link>
      </div>
    </header>
  );
};

export default Header;
