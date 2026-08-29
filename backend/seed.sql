-- Seed data so a fresh install can sign in immediately.
-- Safe to run more than once: each insert is skipped if the email already
-- exists. Passwords are plain text (known tech debt, K1), so this is a demo
-- account only. Do not reuse a real password here.

USE EmmyStudentSupportChatBot;

INSERT INTO Users (FirstName, LastName, Email, Password)
SELECT 'Demo', 'Student', 'demo@example.com', 'changeme'
WHERE NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'demo@example.com');
