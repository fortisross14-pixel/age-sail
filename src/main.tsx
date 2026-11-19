import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/im-fell-english/latin-400.css';
import '@fontsource/im-fell-english/latin-400-italic.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-500.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '@fontsource/alegreya/latin-500.css';
import '@fontsource/alegreya/latin-700.css';
import '@fontsource/alegreya/latin-800.css';
import '@fontsource/alegreya/latin-500-italic.css';
import '@fontsource/alegreya-sc/latin-500.css';
import '@fontsource/alegreya-sc/latin-700.css';
import './styles.css';
import './ui/theme/admiralty.css';
import { App } from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
