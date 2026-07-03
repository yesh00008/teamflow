import { verifyToken } from "../lib/auth.js";
import { unauthorized } from "../lib/errors.js";
import { prisma } from "../prisma.js";

// Reads a Bearer token (or httpOnly cookie) and attaches req.user.
export async function authenticate(req, _res, next) {
  try {
    let token = null;
    const header = req.headers.authorization;
    if (header && header.startsWith("Bearer ")) token = header.slice(7);
    else if (req.cookies?.token) token = req.cookies.token;

    if (!token) throw unauthorized("Missing authentication token");

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, theme: true, emailOptOut: true },
    });
    if (!user) throw unauthorized("User no longer exists");

    req.user = user;
    next();
  } catch (err) {
    if (err.status) return next(err);
    next(unauthorized("Invalid or expired token"));
  }
}
