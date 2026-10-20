import type { CSSProperties } from 'react';
import { CircleCheck, Info, OctagonX, TriangleAlert } from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="system"
    position="bottom-right"
    duration={5000}
    visibleToasts={3}
    icons={{
      success: <CircleCheck size={16} strokeWidth={1.75} className="text-success" />,
      info: <Info size={16} strokeWidth={1.75} className="text-info" />,
      warning: <TriangleAlert size={16} strokeWidth={1.75} className="text-warning" />,
      error: <OctagonX size={16} strokeWidth={1.75} className="text-danger" />,
    }}
    toastOptions={{ className: 'font-sans shadow-toast' }}
    style={
      {
        '--width': '360px',
        '--normal-bg': 'var(--surface-raised)',
        '--normal-text': 'var(--ink)',
        '--normal-border': 'var(--border)',
        '--border-radius': '10px',
      } as CSSProperties
    }
    {...props}
  />
);

export { Toaster };
