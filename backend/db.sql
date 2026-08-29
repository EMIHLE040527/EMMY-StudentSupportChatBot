CREATE DATABASE IF NOT EXISTS EmmyStudentSupportChatBot;
USE EmmyStudentSupportChatBot;

CREATE TABLE Users (
    UserID INT AUTO_INCREMENT PRIMARY KEY,
    FirstName VARCHAR(50) NOT NULL,
    LastName VARCHAR(50) NOT NULL,
    Email VARCHAR(100) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    DateCreated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- One profile per student. The UNIQUE key on UserID is what lets /profile save
-- with a single INSERT ... ON DUPLICATE KEY UPDATE instead of a read-then-write.
CREATE TABLE UserProfiles (
    ProfileID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    Course VARCHAR(100),
    YearLevel INT,
    PreferredLanguage VARCHAR(20),
    UNIQUE KEY uq_userprofiles_user (UserID),
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
    ON DELETE CASCADE
);

-- One row per conversation shown in the sidebar. Title is seeded from the
-- first user message. UpdatedDate bumps on each new message so the most
-- recently used chat sorts to the top of the list.
CREATE TABLE ChatSessions (
    SessionID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    Title VARCHAR(120) NOT NULL DEFAULT 'New chat',
    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
    ON DELETE CASCADE
);

-- One row per exchange (a user message and emmy's reply), tied to the session
-- it belongs to so a conversation can be reloaded in order.
CREATE TABLE ChatHistory (
    ChatID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    SessionID INT NOT NULL,
    UserMessage TEXT NOT NULL,
    BotResponse TEXT NOT NULL,
    ChatDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
    ON DELETE CASCADE,
    FOREIGN KEY (SessionID) REFERENCES ChatSessions(SessionID)
    ON DELETE CASCADE
);

CREATE TABLE Reminders (
    ReminderID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    ReminderTitle VARCHAR(100) NOT NULL,
    ReminderDescription TEXT,
    ReminderDate DATETIME NOT NULL,
    Status VARCHAR(20) DEFAULT 'Pending',
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
    ON DELETE CASCADE
);

-- One word of the day per student per day. The UNIQUE key on (UserID, WordDate)
-- is the whole point: it makes today's word stable no matter how often the pane
-- is opened, and stops a second DeepSeek call being paid for on a refresh.
CREATE TABLE DailyWords (
    WordID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    WordDate DATE NOT NULL,
    Term VARCHAR(60) NOT NULL,
    Meaning VARCHAR(255) NOT NULL,
    Example VARCHAR(255) NOT NULL,
    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dailywords_user_date (UserID, WordDate),
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
    ON DELETE CASCADE
);

CREATE TABLE UploadedNotes (
    NoteID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    FileName VARCHAR(255) NOT NULL,
    FilePath VARCHAR(255),
    UploadDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
    ON DELETE CASCADE
);

CREATE TABLE Feedback (
    FeedbackID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    Rating INT,
    Comment TEXT,
    FeedbackDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
    ON DELETE CASCADE
);

CREATE TABLE GeneratedQuizzes (
    QuizID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    NoteID INT,
    Question TEXT NOT NULL,
    Answer TEXT,
    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
    ON DELETE CASCADE,
    FOREIGN KEY (NoteID) REFERENCES UploadedNotes(NoteID)
    ON DELETE CASCADE
);
