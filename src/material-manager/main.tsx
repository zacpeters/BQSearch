import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { AdminApp } from './AdminApp';
import './admin.css';
import '../design-tokens.css';
import './retrieval.css';
createRoot(document.getElementById('root')!).render(<StrictMode><AdminApp /></StrictMode>);
