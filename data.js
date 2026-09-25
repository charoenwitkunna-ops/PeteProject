(() => {
// Clean database configuration.
// No mock seed items — all records load from the Firestore database.
const GENERIC_FALLBACK_IMG = "data:image/svg+xml;utf8," + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="375" viewBox="0 0 600 375" fill="#f1e6f3">
    <rect width="600" height="375" fill="#F4EBF6"/>
    <g transform="translate(250, 120)" fill="#7A2885" opacity="0.6">
      <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z" transform="scale(4.2) translate(-3,-2)"/>
    </g>
    <text x="300" y="245" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="600" fill="#6B4B72" text-anchor="middle">No Image Available</text>
  </svg>
`.trim());

const INITIAL_ITEMS = [];

const AUTHORITY_WHITELIST = [
  "kru.jane@amnuaysilpa.ac.th",
  "kru.jane@school.ac.th",
  "reception@amnuaysilpa.ac.th",
  "admin@amnuaysilpa.ac.th"
];

window.FOUND_ANS_DATA = { GENERIC_FALLBACK_IMG, INITIAL_ITEMS, AUTHORITY_WHITELIST };
})();
