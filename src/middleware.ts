import { withAuth } from "next-auth/middleware";

// Protect authenticated app pages, redirecting to the custom /login page. API routes
// enforce their own auth via requireProjectAccess so they can return JSON 401/403
// instead of an HTML redirect.
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/", "/projects/:path*", "/settings/:path*", "/security-guidance"],
};
