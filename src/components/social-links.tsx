// Shown in the marketing footers as a trust signal — an active, linked
// social presence reassures a first-time visitor this is a real business,
// not a throwaway site. Inline SVGs because this project's lucide-react
// version doesn't ship brand icons (Instagram/Facebook) — see AGENTS.md.
function InstagramIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-8.2h2.75l.41-3.19h-3.16V7.6c0-.92.26-1.55 1.57-1.55h1.68V3.2C15.99 3.14 15.02 3 13.9 3 11.55 3 9.94 4.44 9.94 7.3v2.31H7.18v3.19h2.76V21h3.56z" />
    </svg>
  );
}

export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <a
        href="https://www.instagram.com/botprofesionalcrm/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="ByBluee en Instagram"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-primary hover:text-primary"
      >
        <InstagramIcon />
      </a>
      <a
        href="https://www.facebook.com/botprofesionalcrm"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="ByBluee en Facebook"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-primary hover:text-primary"
      >
        <FacebookIcon />
      </a>
    </div>
  );
}
