import { NextResponse } from "next/server";
import { google } from "googleapis";
import nodemailer from "nodemailer";

// Backend for the waitlist form (app/components/WaitlistForm.tsx). On
// submit, two things happen in parallel: a row is appended to a Google
// Sheet (the running list) and a notification email is sent (the
// real-time ping). Neither depends on the other, and one failing
// shouldn't block the other — see Promise.allSettled below.
//
// Setup required before this works (all via env vars, none of which are
// committed — see .env.example):
//
// 1. Google Sheet — create a spreadsheet, add a header row
//    (Timestamp | Email | Company | Comments) to a tab, then:
//    - Google Cloud Console → create a project (or reuse one) → enable
//      the "Google Sheets API".
//    - Create a Service Account, then a JSON key for it.
//    - Share the spreadsheet with the service account's email address
//      (found in the JSON key as `client_email`) with Editor access —
//      the sheet is otherwise invisible to it.
//    - Set GOOGLE_SHEET_ID (the long id in the sheet's URL between
//      /d/ and /edit), GOOGLE_SERVICE_ACCOUNT_EMAIL (`client_email`
//      from the key), and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
//      (`private_key` from the key, kept as one env var with literal
//      `\n` sequences — see the .replace() below that un-escapes them).
//
// 2. Notification email — sent via Gmail SMTP through nodemailer.
//    - On the sending Gmail account, turn on 2-Step Verification, then
//      create an "App Password" (myaccount.google.com/apppasswords) —
//      not the account's normal login password, which Gmail's SMTP
//      rejects for third-party apps.
//    - Set EMAIL_USER (the sending Gmail address) and
//      EMAIL_APP_PASSWORD (the 16-character app password).
//    - Set NOTIFY_EMAIL_TO to the inbox that should receive the ping
//      (defaults to EMAIL_USER if unset, so one account can send to
//      itself with no extra config).
//
// Until those env vars are set, both calls below reject and the route
// responds 500 — see the two "not configured" guards.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Submission = {
  email: string;
  company: string;
  comments: string;
  timestamp: string;
};

async function appendToSheet({ email, company, comments, timestamp }: Submission) {
  const { GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY } = process.env;
  if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error("Google Sheets is not configured (missing GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)");
  }

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Env vars can't hold real newlines, so the key is stored with
    // literal "\n" sequences and un-escaped here before use.
    key: GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: "Sheet1!A:D",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[timestamp, email, company, comments]] },
  });
}

async function sendNotificationEmail({ email, company, comments, timestamp }: Submission) {
  const { EMAIL_USER, EMAIL_APP_PASSWORD, NOTIFY_EMAIL_TO } = process.env;
  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    throw new Error("Email notifications are not configured (missing EMAIL_USER / EMAIL_APP_PASSWORD)");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_APP_PASSWORD },
  });

  await transporter.sendMail({
    from: EMAIL_USER,
    to: NOTIFY_EMAIL_TO || EMAIL_USER,
    subject: `New waitlist signup — ${email}`,
    text: [
      `Email: ${email}`,
      `Company: ${company || "(not provided)"}`,
      `Comments: ${comments || "(none)"}`,
      `Submitted: ${timestamp}`,
    ].join("\n"),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const company = typeof body?.company === "string" ? body.company.trim() : "";
  const comments = typeof body?.comments === "string" ? body.comments.trim() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const submission: Submission = { email, company, comments, timestamp: new Date().toISOString() };

  const [sheetResult, emailResult] = await Promise.allSettled([
    appendToSheet(submission),
    sendNotificationEmail(submission),
  ]);

  if (sheetResult.status === "rejected") console.error("[waitlist] Google Sheets append failed:", sheetResult.reason);
  if (emailResult.status === "rejected") console.error("[waitlist] Notification email failed:", emailResult.reason);

  // Only fail the request if BOTH sinks failed — a signup shouldn't be
  // lost to the user just because one of two redundant recording paths
  // had a config issue.
  if (sheetResult.status === "rejected" && emailResult.status === "rejected") {
    return NextResponse.json({ error: "Something went wrong recording your submission. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
