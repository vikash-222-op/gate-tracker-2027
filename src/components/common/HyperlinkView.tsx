import React from 'react';
import { ExternalLink } from 'lucide-react';
import { LinkField } from '../../types';

interface Props {
  value: LinkField | undefined | null;
  defaultLabel?: string;
  className?: string;
}

export const HyperlinkView: React.FC<Props> = ({ value, defaultLabel = 'Open', className = '' }) => {
  if (!value) return <span className="text-slate-400 dark:text-slate-500 italic text-xs">—</span>;

  let url = '';
  let displayText = defaultLabel;

  if (typeof value === 'object' && value !== null && 'url' in value) {
    url = value.url;
    displayText = value.text || defaultLabel;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      url = trimmed;
      displayText = trimmed.length > 30 ? trimmed.substring(0, 27) + '...' : trimmed;
    } else {
      // Plain text or keyword like 'Start'
      return <span className={className}>{trimmed}</span>;
    }
  }

  if (!url) {
    return <span className={className}>{String(value)}</span>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline font-medium ${className}`}
      title={url}
    >
      <span>{displayText}</span>
      <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
    </a>
  );
};
