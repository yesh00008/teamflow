import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

export const signToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email, name: user.name }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

export const verifyToken = (token) => jwt.verify(token, config.jwt.secret);
