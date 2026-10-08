import { NextResponse, type NextRequest } from "next/server";
import { decideAuth } from "@/lib/basic-auth";

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "text/plain; charset=utf-8",
  "X-Robots-Tag": "noindex, nofollow",
};

export function proxy(request: NextRequest) {
  const decision = decideAuth(request.headers.get("authorization"), {
    DEMO_USER: process.env.DEMO_USER,
    DEMO_PASS: process.env.DEMO_PASS,
    PERF_PUBLIC: process.env.PERF_PUBLIC,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });

  if (decision === "allow") return NextResponse.next();

  if (decision === "misconfigured") {
    console.error(
      "[proxy] DEMO_USER or DEMO_PASS is unset on a deployed environment; refusing to serve.",
    );
    return new NextResponse(
      "Site unavailable: access credentials are not configured for this deployment. " +
        "Set DEMO_USER and DEMO_PASS, then redeploy.",
      { status: 503, headers: BASE_HEADERS },
    );
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      ...BASE_HEADERS,
      "WWW-Authenticate": 'Basic realm="EnergyX concept", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: [
    // Everything except build assets, optimized images and public media files.
    "/((?!_next/static|_next/image|favicon\\.ico$|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|mp4|webm|spz)$).*)",
  ],
};
