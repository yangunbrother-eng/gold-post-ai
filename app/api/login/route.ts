import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

function matches(received: unknown, expected: string) {
  if (typeof received !== "string") return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const expectedName = process.env.SITE_LOGIN_NAME || "";
  const expectedPassword = process.env.SITE_LOGIN_PASSWORD || "";
  const sessionToken = process.env.SITE_LOGIN_TOKEN || "";
  if (!expectedName || !expectedPassword || !sessionToken) {
    return NextResponse.json({ message: "로그인 설정이 아직 완료되지 않았어요." }, { status: 503 });
  }

  let input: { name?: unknown; password?: unknown };
  try { input = await request.json(); }
  catch { return NextResponse.json({ message: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 }); }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ message: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  if (!matches(input.name, expectedName) || !matches(input.password, expectedPassword)) {
    return NextResponse.json({ message: "아이디 또는 비밀번호가 맞지 않아요." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
