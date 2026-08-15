import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted so a dashboard deployed on an isolated network still renders
// with its own typography, and no viewer's browser calls out to Google.
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root no encontrado');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
