import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Diagnostics } from './components/Diagnostics';
import './index.css';

// `?diag` answers the one question the game itself cannot: does anything this site
// writes survive the browser being quit? It is not linked from anywhere.
const diag = new URLSearchParams(window.location.search).has('diag');

createRoot(document.getElementById('root')!).render(
  <StrictMode>{diag ? <Diagnostics /> : <App />}</StrictMode>,
);
