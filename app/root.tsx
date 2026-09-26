import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import {usePuterStore} from "~/lib/puter";
import {useEffect} from "react";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

// Restricts which origins scripts, styles, images and connections can
// come from. This is a meta-tag CSP, which is better than nothing but
// weaker than a real HTTP header set from the server (it can't cover
// framing/X-Frame-Options and needs 'unsafe-inline' for React Router's
// hydration script since there's no nonce wiring here). For stronger
// protection this should eventually move into entry.server.tsx as a
// response header with a per-request nonce.
//
// NOTE: Puter stores files on regional AWS S3 buckets
// (e.g. puter-mumbai.s3.ap-south-1.amazonaws.com), not just on
// puter.com itself, so *.amazonaws.com must be allowed too or
// uploads/reads get silently blocked by the browser.
const CSP_CONTENT = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.puter.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.puter.com https://*.puter.com https://puter.com wss://*.puter.com https://*.amazonaws.com",
  "frame-src https://puter.com",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

export function Layout({ children }: { children: React.ReactNode }) {
  const { init } = usePuterStore();

  useEffect(() => {
    init()
  }, [init]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="Content-Security-Policy" content={CSP_CONTENT} />
        <Meta />
        <Links />
      </head>
      <body>
        <script src="https://js.puter.com/v2/"></script>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}

