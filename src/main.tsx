import { render } from 'preact';
import '@fontsource/cormorant/cyrillic-700.css';
import '@fontsource/cormorant/latin-700.css';
import './ui/styles.css';
import { applyDocumentLang } from './i18n/index.ts';
import { Shell } from './shell/Shell.tsx';

applyDocumentLang();
render(<Shell />, document.getElementById('app')!);
