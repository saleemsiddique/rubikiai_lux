# 🏠 RubikiAI Lux - Complete Setup Guide

---

## 🚨 CRITICAL: READ THIS FIRST - HOW THE TRANSITION WORKS

### The Website is CURRENTLY LIVE and Working

**The website https://rubikiailux.lt is currently running and functional** using the developer's accounts (Firebase, Vercel, Stripe, Montonio, Resend).

**This means:**
- ✅ Customers can make reservations RIGHT NOW
- ✅ Payments are being processed
- ✅ Emails are being sent
- ✅ Everything works

### Your Goal: Set Up a PARALLEL System

You will set up your own accounts and configuration as a **completely separate, parallel system**. This does NOT affect the current live website.

**Think of it like this:**
```
CURRENT (Working)              YOUR SETUP (New)
─────────────────              ────────────────
Developer's Firebase    →      Your new Firebase
Developer's Vercel      →      Your new Vercel
Developer's Resend      →      Your new Resend
rubikiailux.lt (LIVE)   →      your-project.vercel.app (testing)
```

### ⚠️ IMPORTANT: Do NOT Touch DNS Until the Final Step!

**The domains (rubikiailux.lt, rubikiai.lt) currently point to the developer's servers.**

If you change DNS records before everything is ready:
- ❌ The website will GO DOWN
- ❌ Customers cannot make reservations
- ❌ Payments will fail
- ❌ You will lose business

### The Correct Order (Summary)

| Phase | What You Do | Affects Live Site? |
|-------|-------------|-------------------|
| **Phase 1** | Create accounts (GitHub, Firebase, Vercel, Resend) | ❌ No |
| **Phase 2** | Install project locally, configure everything | ❌ No |
| **Phase 3** | Deploy to YOUR Vercel (get a `.vercel.app` URL) | ❌ No |
| **Phase 4** | Test EVERYTHING on your `.vercel.app` URL | ❌ No |
| **Phase 5** | Create your admin account, verify all works | ❌ No |
| **Phase 6** | **FINAL TRANSITION** - Coordinate with developer | ✅ YES |

### Phase 6: The Final Transition (Last Step)

**Only when EVERYTHING is working perfectly on your `.vercel.app` URL:**

1. **Contact the developer** to coordinate the transition
2. **Import the database** (developer will export fresh data)
3. **Change DNS records** in Hostinger (this switches the live site to YOUR servers)
4. **Update Stripe/Montonio webhooks** to point to your domain
5. **Verify everything works** on the real domain

**This transition should take less than 1 hour if everything is prepared.**

---

## ⚠️ IMPORTANT NOTICE - YOUR RESPONSIBILITIES

**After the transition, this project is fully under your control and responsibility.**

This means:
- ✅ You have complete ownership of the source code
- ⚠️ You are responsible for ALL future changes, updates, and maintenance
- ⚠️ You must configure and manage ALL external services yourself
- ⚠️ You must handle ALL technical issues that arise
- ⚠️ If you change ANY technology or service, things WILL break and you'll need to fix them

**⚠️ CRITICAL: The technologies used in this project are:**
- Next.js 15.5.7
- React 19.1.0
- Node.js 20+
- TypeScript 5+
- Firebase 12.2.1
- And many other dependencies with specific versions

**If you update ANY of these packages, the project may stop working. Only update if you know what you're doing or have a developer to help you.**

---

## 📋 Table of Contents

### Phase 1-2: Setup (Does NOT affect live site)
1. [Prerequisites](#1-prerequisites)
2. [Required Services Setup](#2-required-services-setup)
3. [Project Installation](#3-project-installation)
4. [Environment Variables Configuration](#4-environment-variables-configuration)
5. [Firebase Setup](#5-firebase-setup) *(Create project, rules, indexes - NO data import yet)*
6. [Resend Email Setup](#6-resend-email-setup) *(Get API key only - NO DNS changes yet)*

### Phase 3: Deployment (Does NOT affect live site)
7. [Stripe Payment Setup](#7-stripe-payment-setup) *(Already configured)*
8. [Montonio Payment Setup](#8-montonio-payment-setup) *(Already configured)*
9. [Vercel Deployment](#9-vercel-deployment) *(Deploy to .vercel.app URL)*

### Phase 4-5: Testing (Does NOT affect live site)
10. [Admin Account Setup](#10-admin-account-setup)
11. [Testing Everything](#11-testing-everything)
12. [Automated Tasks (Cron Jobs)](#12-automated-tasks-cron-jobs)
13. [Google Analytics Setup](#13-google-analytics-setup)

### Phase 6: FINAL TRANSITION (Affects live site - do LAST!)
14. [Pre-Transition Checklist](#14-pre-transition-checklist)
15. [Database Import](#15-database-import)
16. [Domain Configuration (DNS Changes)](#16-domain-configuration-dns-changes)
17. [Final Verification](#17-final-verification)

### Reference Sections
18. [Troubleshooting](#18-troubleshooting)
19. [Important Files and Folders](#19-important-files-and-folders)
20. [Going Live Checklist](#20-going-live-checklist)
21. [Maintenance and Updates](#21-maintenance-and-updates)
22. [Important Notes](#22-important-notes)
23. [Final Words](#23-final-words)
24. [Glossary of Technical Terms](#24-glossary-of-technical-terms)
25. [How to Modify Translations](#25-how-to-modify-translations)
26. [Managing Your Website (Admin Panel)](#26-managing-your-website-admin-panel)
27. [Common Tasks (Quick Reference)](#27-common-tasks-quick-reference)
28. [Quick Start Summary](#28-quick-start-summary-one-page-reference)

---

## 1. Prerequisites

Before starting, make sure you have:

### Software Requirements
- **Node.js version 20 or higher** - [Download here](https://nodejs.org/)
  - To check your version: Open terminal/command prompt and type: `node --version`
  - Must show v20.x.x or higher
- **npm** (comes with Node.js)
  - To check: `npm --version`
- **Git** (optional but recommended) - [Download here](https://git-scm.com/)
- A code editor (VS Code recommended) - [Download here](https://code.visualstudio.com/)

### Accounts You MUST Create
You will need to create accounts on these services (all have free tiers):

1. **GitHub** - https://github.com/ (to store your code and connect with Vercel)
2. **Firebase** - https://firebase.google.com/ (database and authentication)
3. **Vercel** - https://vercel.com/ (website hosting)
4. **Resend** - https://resend.com/ (email sending)
5. **Hostinger** - You already have this (domain provider)

**⚠️ You do NOT need to create accounts for:**
- **Stripe** - Already configured with owner's account
- **Montonio** - Already configured with owner's account

⚠️ **IMPORTANT**: Keep all passwords and API keys in a secure place. You'll need them later.

---

## 2. Required Services Setup

### 2.1 Create a Firebase Project

1. Go to https://firebase.google.com/
2. Click "Get Started" or "Go to Console"
3. Click "Add project" or "Create a project"
4. Enter project name: `rubikiai-lux` (or any name you want)
5. Click "Continue"
6. **Disable Google Analytics for now** (you can enable later if needed)
7. Click "Create project"
8. Wait for the project to be created (takes 30-60 seconds)
9. Click "Continue" when it's ready

**✅ Keep this browser tab open - you'll need it soon**

### 2.2 Create a Vercel Account

1. Go to https://vercel.com/
2. Click "Sign Up"
3. Sign up with your GitHub, GitLab, or Bitbucket account (recommended)
   - Or use email if you prefer
4. Complete the verification process
5. You'll see your Vercel dashboard

**✅ Keep this browser tab open**

### 2.3 Create a Resend Account

1. Go to https://resend.com/
2. Click "Start Building"
3. Sign up with email or GitHub
4. Verify your email address
5. You'll see your Resend dashboard

**✅ Keep this browser tab open**

### 2.4 Create a GitHub Account (If you don't have one)

1. Go to https://github.com/
2. Click "Sign up"
3. Enter your email
4. Create a password
5. Choose a username
6. Verify your email
7. Complete the setup

**✅ Keep this browser tab open**

⚠️ **About Stripe and Montonio**: These payment systems are **already configured** with the owner's account. You do NOT need to create accounts for them unless you want to use your own payment accounts (see Sections 7 and 8).

---

## 3. Project Installation

### 3.1 Extract the Project

1. Locate the `.zip` file you received
2. Right-click and "Extract All" (Windows) or double-click (Mac)
3. Extract to a location you can easily find (e.g., Desktop or Documents)
4. Remember where you extracted it!

### 3.2 Open the Project

1. Open your terminal/command prompt:
   - **Windows**: Press `Win + R`, type `cmd`, press Enter
   - **Mac**: Press `Cmd + Space`, type `terminal`, press Enter
2. Navigate to the project folder:
   ```bash
   cd path/to/your/project
   ```
   - Example Windows: `cd C:\Users\YourName\Desktop\rubikiai_lux`
   - Example Mac: `cd ~/Desktop/rubikiai_lux`

### 3.3 Install Dependencies

⚠️ **THIS IS CRITICAL - Don't skip this step**

In the terminal, run:
```bash
npm install
```

This will take 2-5 minutes depending on your internet speed. You'll see a lot of text scrolling - this is normal.

**✅ Wait until you see "added XXX packages" or similar message**

**❌ If you see errors:**
- Make sure you're in the correct folder (you should see `package.json` if you type `dir` on Windows or `ls` on Mac)
- Make sure Node.js is installed correctly (`node --version` should work)
- Make sure you have internet connection

---

## 4. Environment Variables Configuration

Environment variables are like secret passwords and configuration for your website. You need to set these up correctly or NOTHING will work.

⚠️ **IMPORTANT**: In this section you will create the file and copy the template. You will fill in the actual values as you complete the following sections (Firebase, Resend, etc.). Don't worry if the values are empty for now.

### 4.1 Create the .env.local File

1. In your project folder, create a new file called `.env.local`
   - **Important**: The dot (.) at the beginning is required
   - **Important**: Use `.env.local` NOT `.env`
2. Open this file with a text editor (Notepad, VS Code, etc.)

### 4.2 Copy This Template

Copy and paste this entire template into your `.env.local` file.
**Leave the values empty for now** - you will fill them in as you complete each section:

```env
# ═══════════════════════════════════════════════════════════════════════
# APPLICATION URL
# ═══════════════════════════════════════════════════════════════════════
# Change this to your domain after deployment
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ═══════════════════════════════════════════════════════════════════════
# FIREBASE CLIENT SDK (Public - safe to expose in browser)
# Get these from Firebase Console → Project Settings → Your Apps
# ═══════════════════════════════════════════════════════════════════════
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# ═══════════════════════════════════════════════════════════════════════
# FIREBASE ADMIN SDK (Private - keep secret!)
# Get these from Firebase Console → Project Settings → Service Accounts
# ═══════════════════════════════════════════════════════════════════════
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# ═══════════════════════════════════════════════════════════════════════
# STRIPE PAYMENT GATEWAY
# ⚠️ ALREADY CONFIGURED - Don't change unless using your own account
# ═══════════════════════════════════════════════════════════════════════
STRIPE_SECRET_KEY=sk_live_... (already configured in Vercel)
STRIPE_WEBHOOK_SECRET=whsec_... (already configured in Vercel)

# ═══════════════════════════════════════════════════════════════════════
# MONTONIO PAYMENT GATEWAY
# ⚠️ ALREADY CONFIGURED - Don't change unless using your own account
# ═══════════════════════════════════════════════════════════════════════
MONTONIO_ENVIRONMENT=production
MONTONIO_ACCESS_KEY=your_access_key (already configured in Vercel)
MONTONIO_SECRET_KEY=your_secret_key (already configured in Vercel)
MONTONIO_WEBHOOK_SECRET=your_webhook_secret (already configured in Vercel)

# ═══════════════════════════════════════════════════════════════════════
# EMAIL SERVICE (Resend)
# ═══════════════════════════════════════════════════════════════════════
RESEND_API_KEY=re_...

# Owner email - receives notifications about new bookings
OWNER_EMAIL=info@rubikiailux.lt

# ═══════════════════════════════════════════════════════════════════════
# ADMIN SECURITY
# ═══════════════════════════════════════════════════════════════════════
# Used ONCE to create the first admin account via /admin/bootstrap
# Change this after creating admin account for security
ADMIN_BOOTSTRAP_TOKEN=create_a_random_secure_string_here

# ═══════════════════════════════════════════════════════════════════════
# CRON JOBS (Optional but recommended)
# ═══════════════════════════════════════════════════════════════════════
# Secret to protect the reminder cron endpoint (optional)
CRON_SECRET=your_cron_secret_here

# Fallback language for reminder emails (optional, default: lt)
CRON_LANG=lt
```

**Summary of what you need to configure:**

| Variable | You Need To Configure? | Notes |
|----------|------------------------|-------|
| `NEXT_PUBLIC_APP_URL` | ✅ Yes | Your domain URL |
| `NEXT_PUBLIC_FIREBASE_*` | ✅ Yes | Get from Firebase Console |
| `FIREBASE_*` (Admin) | ✅ Yes | Get from Firebase Service Account |
| `STRIPE_*` | ❌ No | Already configured |
| `MONTONIO_*` | ❌ No | Already configured |
| `RESEND_API_KEY` | ✅ Yes | Get from Resend Dashboard |
| `OWNER_EMAIL` | ✅ Yes | Your email for notifications |
| `ADMIN_BOOTSTRAP_TOKEN` | ✅ Yes | Create a random secure string |
| `CRON_SECRET` | ⚪ Optional | Extra security for cron jobs |
| `CRON_LANG` | ⚪ Optional | Default language for emails |

Now let's fill in each value. **Follow the sections in order** - each section will tell you which variables to fill in.

### 4.3 When to Fill Each Variable

| Variable | Fill it in... | Section |
|----------|---------------|---------|
| `NEXT_PUBLIC_APP_URL` | Now (use `http://localhost:3000`) | Here |
| `NEXT_PUBLIC_FIREBASE_*` | After completing Firebase setup | Section 5.5 |
| `FIREBASE_*` (Admin) | After completing Firebase setup | Section 5.5 |
| `STRIPE_*` | Already configured (don't change) | - |
| `MONTONIO_*` | Already configured (don't change) | - |
| `RESEND_API_KEY` | After creating Resend account | Section 6.1 |
| `OWNER_EMAIL` | Now | Here |
| `ADMIN_BOOTSTRAP_TOKEN` | Now (create random string) | Here |
| `CRON_SECRET` | Now (optional) | Here |
| `CRON_LANG` | Now (optional) | Here |

### 4.4 Variables You Can Fill Now

Fill these variables immediately:

**NEXT_PUBLIC_APP_URL:**
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
(You'll update this later after deploying to Vercel)

**OWNER_EMAIL:**
```
OWNER_EMAIL=info@rubikiailux.lt
```
(Use your business email that should receive booking notifications)

**ADMIN_BOOTSTRAP_TOKEN:**
```
ADMIN_BOOTSTRAP_TOKEN=MySecretToken2024_RandomString_XYZ123
```
(Create a long random string - you'll use this once to create your admin account)

**CRON_SECRET (optional):**
```
CRON_SECRET=AnotherRandomString_ForCronJobs_ABC456
```

**CRON_LANG (optional):**
```
CRON_LANG=lt
```

### 4.5 Variables You'll Fill Later

**Leave these EMPTY for now** - you'll fill them after completing the corresponding sections:

```env
# Fill after Section 5 (Firebase Setup):
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Fill after Section 6 (Resend Setup):
RESEND_API_KEY=
```

**Save the file** and continue to Section 5.

---

### 4.6 Reference Guide: How to Get EACH Variable (Detailed)

⚠️ **Don't do these steps now!** This is a reference guide. Complete Section 5 first, then come back here if you need detailed instructions.

---

### Firebase Client Variables (NEXT_PUBLIC_FIREBASE_*)

**What they are:** Public configuration to connect your website to Firebase.

**How to get ALL of them:**

1. Go to https://console.firebase.google.com/
2. Select your project
3. Click the **gear icon ⚙️** (top left, next to "Project Overview")
4. Click **"Project settings"**
5. Scroll down to **"Your apps"** section
6. If no app exists:
   - Click **"Add app"**
   - Click the **Web icon** (`</>`)
   - Enter nickname: `RubikiAI Lux`
   - DON'T check "Firebase Hosting"
   - Click **"Register app"**
7. You'll see a code block like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD...",           // → NEXT_PUBLIC_FIREBASE_API_KEY
  authDomain: "xxx.firebaseapp.com",  // → NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  projectId: "your-project-id",       // → NEXT_PUBLIC_FIREBASE_PROJECT_ID
  storageBucket: "xxx.appspot.com",   // → NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "123456789",     // → NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:123:web:abc...",          // → NEXT_PUBLIC_FIREBASE_APP_ID
  measurementId: "G-XXXXXXX"          // → NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID (optional)
};
```

8. Copy each value to the corresponding variable in your `.env.local`

**Example result in .env.local:**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=rubikiai-lux.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=rubikiai-lux
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=rubikiai-lux.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

### Firebase Admin Variables (FIREBASE_*)

**What they are:** Private credentials for server-side Firebase access. KEEP THESE SECRET!

**How to get ALL of them:**

1. Go to https://console.firebase.google.com/
2. Select your project
3. Click the **gear icon ⚙️** → **"Project settings"**
4. Click the **"Service accounts"** tab
5. Click **"Generate new private key"**
6. Click **"Generate key"** in the confirmation popup
7. A JSON file will download (save it securely!)
8. Open the JSON file with a text editor (Notepad, VS Code)
9. You'll see something like:

```json
{
  "type": "service_account",
  "project_id": "rubikiai-lux",          // → FIREBASE_PROJECT_ID
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n",  // → FIREBASE_PRIVATE_KEY
  "client_email": "firebase-adminsdk-xxxxx@rubikiai-lux.iam.gserviceaccount.com",  // → FIREBASE_CLIENT_EMAIL
  "client_id": "123456789",
  ...
}
```

10. Copy each value:

**FIREBASE_PROJECT_ID:**
- Copy the `project_id` value
- Example: `rubikiai-lux`

**FIREBASE_CLIENT_EMAIL:**
- Copy the `client_email` value
- Example: `firebase-adminsdk-xxxxx@rubikiai-lux.iam.gserviceaccount.com`

**FIREBASE_PRIVATE_KEY:**
- Copy the ENTIRE `private_key` value INCLUDING the `-----BEGIN...` and `-----END...` parts
- Include all the `\n` characters (they represent line breaks)
- Wrap it in double quotes
- Example: `"-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...very long string...\n-----END PRIVATE KEY-----\n"`

⚠️ **CRITICAL for FIREBASE_PRIVATE_KEY:**
- Must be wrapped in double quotes `"..."`
- Must include ALL the `\n` characters exactly as shown
- Must include `-----BEGIN PRIVATE KEY-----` at the start
- Must include `-----END PRIVATE KEY-----\n` at the end

**Example result in .env.local:**
```env
FIREBASE_PROJECT_ID=rubikiai-lux
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@rubikiai-lux.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...very long string here...\n-----END PRIVATE KEY-----\n"
```

---

### STRIPE_SECRET_KEY

**What it is:** Secret key to process Stripe payments.

**⚠️ ALREADY CONFIGURED** - You don't need to change this unless using your own Stripe account.

**If you need to get your own (Section 7.2):**

1. Go to https://dashboard.stripe.com/
2. Log in to your Stripe account
3. In the top right, make sure you're in **LIVE mode** (or TEST mode for testing)
4. Click **"Developers"** in the top menu
5. Click **"API keys"**
6. Find **"Secret key"** and click **"Reveal"**
7. Copy the key (starts with `sk_live_` or `sk_test_`)

**Example:** `sk_live_51ABC...xyz`

---

### STRIPE_WEBHOOK_SECRET

**What it is:** Secret to verify that webhook calls really come from Stripe.

**⚠️ ALREADY CONFIGURED** - You don't need to change this unless using your own Stripe account.

**If you need to get your own (Section 7.2):**

1. Go to https://dashboard.stripe.com/
2. Click **"Developers"** → **"Webhooks"**
3. Click on your webhook endpoint
4. Find **"Signing secret"** and click **"Reveal"**
5. Copy the secret (starts with `whsec_`)

**Example:** `whsec_abc123xyz...`

---

### MONTONIO_* Variables

**What they are:** Credentials for Montonio bank transfer payments.

**⚠️ ALREADY CONFIGURED** - You don't need to change these unless using your own Montonio account.

**If you need to get your own (Section 8.2):**

1. Log in to your Montonio merchant dashboard
2. Go to **Settings** or **API** section
3. Find your:
   - **Access Key** → `MONTONIO_ACCESS_KEY`
   - **Secret Key** → `MONTONIO_SECRET_KEY`
   - **Webhook Secret** → `MONTONIO_WEBHOOK_SECRET`
4. For environment:
   - Testing: `MONTONIO_ENVIRONMENT=sandbox`
   - Production: `MONTONIO_ENVIRONMENT=production`

---

### RESEND_API_KEY

**What it is:** API key to send emails through Resend.

**How to get it:**

1. Go to https://resend.com/
2. Click **"Sign In"** or **"Sign Up"** (create account if needed)
3. Once logged in, click **"API Keys"** in the left sidebar
4. Click **"Create API Key"**
5. Enter a name: `RubikiAI Lux`
6. Permission: **"Sending access"**
7. Click **"Add"**
8. **COPY THE KEY IMMEDIATELY** (you won't see it again!)
9. The key starts with `re_`

**Example:** `re_abc123xyz...`

⚠️ **If you lose the key**, you'll need to create a new one.

---

### OWNER_EMAIL

**What it is:** Email address that receives notifications about new bookings.

**How to set it:**
- Use your business email
- Example: `info@rubikiailux.lt`

This email will receive:
- New booking notifications
- Payment confirmations
- Any system alerts

---

### ADMIN_BOOTSTRAP_TOKEN

**What it is:** A secret password used ONCE to create the first admin account.

**How to create it:**
1. Think of a random, long string that nobody can guess
2. Use a mix of letters, numbers, and special characters
3. Make it at least 20 characters long

**Example:** `MySecretToken_2024_RubikiAI_XYZ123!@#`

**How to generate a secure one:**
- Go to https://passwordsgenerator.net/
- Generate a 32-character password
- Use that as your token

⚠️ **IMPORTANT:**
- You'll use this token ONCE to create your admin account
- After creating the admin account, CHANGE this token to something else
- Anyone with this token can create admin accounts!

---

### CRON_SECRET (Optional)

**What it is:** Extra security for the automated reminder emails.

**How to set it:**
- Create another random string (like ADMIN_BOOTSTRAP_TOKEN)
- Example: `CronJobSecret_2024_ABC123`

**If not set:** The cron job will still work, just without extra verification.

---

### CRON_LANG (Optional)

**What it is:** Fallback language for reminder emails.

**How to set it:**
- `lt` for Lithuanian
- `en` for English
- `ru` for Russian

**If not set:** Defaults to `lt` (Lithuanian).

**Note:** Each reservation stores its own language, so this is only a fallback.

---

## 5. Firebase Setup

Firebase is your database where all reservation data, user accounts, and other information is stored.

⚠️ **NOTE**: In this section you will CREATE your Firebase project and configure it. You will NOT import data yet - the database import happens in **Phase 6 (Final Transition)** to ensure you get the most recent data at the time of transition.

**What you'll do now:**
- Create Firebase project
- Enable authentication
- Create database
- Configure security rules
- Create indexes
- Get your API keys

**What you'll do LATER (Phase 6):**
- Import the database (houses, reservations, prices, etc.)

### 5.1 Enable Firebase Authentication

1. Go back to your Firebase Console (https://console.firebase.google.com/)
2. Select your project
3. In the left sidebar, click "Authentication"
4. Click "Get started"
5. Click on "Email/Password"
6. **Enable** the first toggle (Email/Password)
7. **Leave disabled** the second toggle (Email link)
8. Click "Save"

**✅ Authentication is now enabled**

### 5.2 Create Firestore Database

1. In the left sidebar, click "Firestore Database"
2. Click "Create database"
3. Select **"Start in production mode"** (we'll add rules next)
4. Click "Next"
5. Choose your location (select the one closest to your users - for Europe, choose `europe-west1` or similar)
6. Click "Enable"
7. Wait 1-2 minutes for the database to be created

### 5.3 Configure Firestore Security Rules

⚠️ **CRITICAL SECURITY STEP - Don't skip this!**

These rules are specifically designed for this project. They allow:
- **Public read** for `houses` (to display property information)
- **Public read** for `reservations` (to check availability in the booking calendar)
- **Everything else is closed** - all writes and other reads go through the admin API

1. In Firestore Database, click on the "Rules" tab
2. **Delete everything** in the rules editor
3. Copy and paste these rules **EXACTLY**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ═══════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    // Check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Check if user is admin (has document in admins collection)
    function isAdmin() {
      return isAuthenticated() &&
             exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC READ COLLECTIONS (used by client-side JavaScript)
    // ═══════════════════════════════════════════════════════════════════════

    // Houses - PUBLIC READ (needed to display property info on the website)
    // Write is blocked - admin API handles all modifications
    match /houses/{houseId} {
      allow read: if true;
      allow write: if false;
    }

    // Reservations - PUBLIC READ (needed to show occupied dates in calendar)
    // Write is blocked - admin API and webhooks handle all modifications
    match /reservations/{reservationId} {
      allow read: if true;
      allow write: if false;

      // Subcollection: checkout_intents under reservations
      match /checkout_intents/{intentId} {
        allow read, write: if false;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN-ONLY COLLECTIONS (accessed only via server-side API)
    // ═══════════════════════════════════════════════════════════════════════

    // Admins collection - only the authenticated user can read their own status
    match /admins/{userId} {
      allow read: if isAuthenticated() && request.auth.uid == userId;
      allow write: if false; // Bootstrap endpoint handles creation
    }

    // Coupons - CLOSED (API handles validation and usage)
    match /coupons/{couponId} {
      allow read, write: if false;

      // Subcollection: movements (usage history)
      match /movements/{movementId} {
        allow read, write: if false;
      }
    }

    // Percentage discounts - CLOSED (API handles validation)
    match /percentage_discounts/{discountId} {
      allow read, write: if false;

      // Subcollection: movements (usage history)
      match /movements/{movementId} {
        allow read, write: if false;
      }
    }

    // Coupon orders - CLOSED (API handles everything)
    match /coupon_orders/{orderId} {
      allow read, write: if false;
    }

    // Stripe customer mapping - CLOSED (API only)
    match /stripe_customer_by_email/{email} {
      allow read, write: if false;
    }

    // Checkout intents (temporary Montonio data) - CLOSED (API only)
    match /checkout_intents/{intentId} {
      allow read, write: if false;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DEFAULT: DENY ALL OTHER COLLECTIONS
    // ═══════════════════════════════════════════════════════════════════════

    // Any collection not explicitly defined above is denied
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

4. Click "Publish"
5. Wait for "Rules published successfully" message

**✅ Your database is now secure**

#### Why these specific rules?

| Collection | Read | Write | Reason |
|------------|------|-------|--------|
| `houses` | ✅ Public | ❌ Closed | Website needs to display property details |
| `reservations` | ✅ Public | ❌ Closed | Calendar needs to show occupied dates |
| `admins` | 🔒 Own user only | ❌ Closed | User checks if they're admin |
| `coupons` | ❌ Closed | ❌ Closed | Validation happens via API to prevent manipulation |
| `percentage_discounts` | ❌ Closed | ❌ Closed | Same as coupons |
| `coupon_orders` | ❌ Closed | ❌ Closed | Contains sensitive order data |
| `stripe_customer_by_email` | ❌ Closed | ❌ Closed | Contains Stripe customer IDs |
| `checkout_intents` | ❌ Closed | ❌ Closed | Temporary payment data |

⚠️ **All writes go through the Admin SDK** (server-side API routes) which bypasses these rules. The Firebase Admin SDK has full access regardless of rules.

### 5.4 Create Firestore Indexes

Indexes make your database queries fast. You need to create these manually.

1. In Firestore Database, click on the "Indexes" tab
2. Click "Add Index"
3. Create each of these indexes **exactly as shown**:

**Index 1:**
- Collection ID: `reservations`
- Fields:
  1. `houseId` → Ascending
  2. `checkIn` → Ascending
  3. `__name__` → Ascending
- Query scope: Collection
- Click "Create"

**Index 2:**
- Collection ID: `reservations`
- Fields:
  1. `status` → Ascending
  2. `createdAt` → Ascending
  3. `__name__` → Ascending
- Query scope: Collection
- Click "Create"

**Index 3:**
- Collection ID: `reservations`
- Fields:
  1. `houseId` → Ascending
  2. `status` → Ascending
  3. `createdAt` → Ascending
  4. `__name__` → Ascending
- Query scope: Collection
- Click "Create"

**Index 4:**
- Collection ID: `reservations`
- Fields:
  1. `houseId` → Ascending
  2. `checkIn` → Ascending
  3. `checkOut` → Ascending
  4. `__name__` → Ascending
- Query scope: Collection
- Click "Create"

**Index 5:**
- Collection ID: `reservations`
- Fields:
  1. `houseId` → Ascending
  2. `status` → Ascending
  3. `checkIn` → Ascending
  4. `__name__` → Ascending
- Query scope: Collection
- Click "Create"

**Index 6:**
- Collection ID: `reservations`
- Fields:
  1. `status` → Ascending
  2. `checkIn` → Ascending
  3. `__name__` → Ascending
- Query scope: Collection
- Click "Create"

**Index 7:**
- Collection ID: `coupon_orders`
- Fields:
  1. `status` → Ascending
  2. `completedAt` → Ascending
  3. `__name__` → Ascending
- Query scope: Collection
- Click "Create"

⚠️ **Each index takes 5-10 minutes to build**. You'll see "Building" status. Wait until all show "Enabled".

### 5.5 Get Firebase Configuration

Now we need to get the configuration values for your `.env.local` file.

#### For Client SDK (Public Keys):

1. In Firebase Console, click on the gear icon ⚙️ (top left)
2. Click "Project settings"
3. Scroll down to "Your apps"
4. If you don't see any app, click "Add app" → Select the Web icon (`</>`)
5. Register app with nickname: "RubikiAI Lux Web"
6. **Don't check** "Also set up Firebase Hosting"
7. Click "Register app"
8. You'll see a `firebaseConfig` object. Copy these values to your `.env.local`:

```javascript
const firebaseConfig = {
  apiKey: "copy-this-to-NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "copy-this-to-NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "copy-this-to-NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "copy-this-to-NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "copy-this-to-NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "copy-this-to-NEXT_PUBLIC_FIREBASE_APP_ID",
  measurementId: "copy-this-to-NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"
};
```

#### For Admin SDK (Private Keys):

1. Still in Project Settings, click on the "Service accounts" tab
2. Click "Generate new private key"
3. Click "Generate key"
4. A JSON file will download - **KEEP THIS FILE SECURE**
5. Open the JSON file with a text editor
6. Copy these values to your `.env.local`:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

⚠️ **IMPORTANT for `FIREBASE_PRIVATE_KEY`**:
- The private key has line breaks (`\n`)
- You must keep these `\n` in the value
- Wrap the entire key in quotes
- Example: `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIB...\n-----END PRIVATE KEY-----\n"`

---

### ⚠️ IMPORTANT: Now Go Back and Fill Your Variables!

You now have all the Firebase values. **Go back to your `.env.local` file** and fill in:

1. All `NEXT_PUBLIC_FIREBASE_*` variables (from Client SDK config)
2. All `FIREBASE_*` variables (from Admin SDK JSON file)

**Save the file** and continue to Section 6.

---

### 5.6 Database Import - SKIP FOR NOW!

⚠️ **DO NOT import the database yet!**

The database import will be done in **Section 15 (Phase 6 - Final Transition)**.

**Why wait?**
- The current live website is still receiving new reservations
- If you import now, you'll have OLD data
- The developer will export FRESH data right before the transition

**What to do now:**
→ Continue to **Section 6 (Resend Email Setup)**

**✅ Firebase project is configured and ready. Data will be imported in Phase 6.**

---

### 5.7 (For Project Owner) How to Export Database Before Delivery

⚠️ **This section is for the project owner/developer who is delivering the project.**

If you're the one delivering this project and need to export the database:

### Step 1: Prepare your service account file

1. Go to Firebase Console → Your project → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save the file as `serviceAccountKey.json` in the project folder

### Step 2: Run the export script

We've included an export script (`export-data.js`) in the project:

```bash
node export-data.js
```

This will create a `firestore-backup.json` file with all your data.

### Step 3: Include in delivery

When delivering the project to the client, include:
1. The project `.zip` file
2. The `firestore-backup.json` file
3. This README documentation

⚠️ **Do NOT include your `serviceAccountKey.json`** - the client will create their own.

---

## 6. Resend Email Setup

Resend sends all the confirmation emails, reminders, and notifications to your customers.

### 6.1 Get Resend API Key

1. Go to https://resend.com/ and log in
2. Click on "API Keys" in the left sidebar
3. Click "Create API Key"
4. Name: "RubikiAI Lux Production"
5. Permission: "Sending access"
6. Click "Add"
7. **Copy the API key immediately** (you won't see it again)
8. Paste it in your `.env.local` as `RESEND_API_KEY`

### 6.2 Add Your Domain in Resend (DO NOT Change DNS Yet!)

⚠️ **IMPORTANT**: You will add the domain in Resend to see what DNS records are needed, but you will **NOT change any DNS records yet**. DNS changes happen in **Phase 6 (Final Transition)**.

1. In Resend, click on "Domains" in the left sidebar
2. Click "Add Domain"
3. Enter your domain: `rubikiailux.lt`
4. Click "Add"
5. You'll see DNS records that need to be added - **SAVE THESE FOR LATER**

### 6.3 Note the DNS Records (DO NOT ADD YET!)

Resend will show you 3 DNS records:
- **SPF Record** (Type: TXT)
- **DKIM Record** (Type: TXT)
- **DMARC Record** (Type: TXT)

📝 **Write these down or take a screenshot** - you'll need them in Phase 6.

⚠️ **DO NOT add these DNS records in Hostinger yet!**

**Why?** The current DNS records are pointing to the developer's servers. If you change them now:
- ❌ The live website will stop working
- ❌ Emails from the current system will fail
- ❌ You will lose business

### 6.4 Testing Emails Without Domain Verification

**For testing on your `.vercel.app` URL:**
- Resend allows sending a limited number of emails from their test domain
- OR you can use a different test domain if you have one
- The real domain (`rubikiailux.lt`) will be verified in Phase 6

**Continue to Section 7** - DNS changes happen in Phase 6.

**✅ Resend account is ready. Domain verification will be completed in Phase 6.**

---

## 7. Stripe Payment Setup

### Understanding the Current Situation

| System | Stripe Account | Webhook URL | Status |
|--------|---------------|-------------|--------|
| **Live site** (rubikiailux.lt) | Developer's account | Points to live site | ✅ Working |
| **Your new system** (.vercel.app) | YOUR account | Points to YOUR .vercel.app | 🔧 You configure |

**The developer's Stripe will keep working on the live site until the final transition.**

### 7.1 Get Stripe Credentials for YOUR System

You need to get Stripe credentials that will work with YOUR Vercel deployment.

**Option A: Use the Developer's Credentials (Recommended for testing)**

Ask the developer for the Stripe credentials. They will provide:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

You'll add these to YOUR Vercel environment variables. The webhook will be configured in Phase 6.

**Option B: Create Your Own Stripe Account**

If you want payments to go directly to YOUR bank account:

1. Go to https://stripe.com/
2. Click "Sign up"
3. Complete business verification
4. Once verified, go to **Developers** → **API keys**
5. Copy your **Secret key** (`sk_live_...` or `sk_test_...`)

### 7.2 Set Up Webhook for Testing (Your .vercel.app URL)

⚠️ **For testing ONLY** - you'll change this to the real domain in Phase 6.

1. Go to **Developers** → **Webhooks**
2. Click "Add endpoint"
3. **Endpoint URL**: `https://YOUR-PROJECT.vercel.app/api/stripe/webhook`
   - Use your `.vercel.app` URL, NOT `rubikiailux.lt`
4. **Events to send** - Select these:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Click "Add endpoint"
6. Click "Reveal" next to **Signing secret**
7. Copy the `whsec_...` value

### 7.3 Add to Your Environment Variables

Add these to your `.env.local`:
```env
STRIPE_SECRET_KEY=sk_live_... (or sk_test_...)
STRIPE_WEBHOOK_SECRET=whsec_...
```

**⚠️ Phase 6 Reminder**: The webhook URL will be changed to `https://rubikiailux.lt/api/stripe/webhook` during the final transition.

**✅ Stripe is configured for testing. Webhook URL will be updated in Phase 6.**

---

## 8. Montonio Payment Setup

### Understanding the Current Situation

| System | Montonio Account | Webhook URL | Status |
|--------|-----------------|-------------|--------|
| **Live site** (rubikiailux.lt) | Developer's account | Points to live site | ✅ Working |
| **Your new system** (.vercel.app) | YOUR account | Points to YOUR .vercel.app | 🔧 You configure |

**The developer's Montonio will keep working on the live site until the final transition.**

### 8.1 Get Montonio Credentials for YOUR System

**Option A: Use the Developer's Credentials (Recommended for testing)**

Ask the developer for the Montonio credentials. They will provide:
- `MONTONIO_ACCESS_KEY`
- `MONTONIO_SECRET_KEY`
- `MONTONIO_WEBHOOK_SECRET`

**Option B: Create Your Own Montonio Merchant Account**

If you want payments to go directly to YOUR bank account:

1. Go to https://montonio.com/
2. Contact them to create a merchant account
3. Complete business verification (may take several days)
4. Get your API credentials from the merchant dashboard

### 8.2 Set Up Webhook for Testing (Your .vercel.app URL)

⚠️ **For testing ONLY** - you'll change this to the real domain in Phase 6.

1. In your Montonio dashboard, go to webhook settings
2. Set the webhook URL: `https://YOUR-PROJECT.vercel.app/api/montonio/webhook`
   - Use your `.vercel.app` URL, NOT `rubikiailux.lt`
3. Enable notifications for payment status changes

### 8.3 Add to Your Environment Variables

Add these to your `.env.local`:
```env
MONTONIO_ENVIRONMENT=production
MONTONIO_ACCESS_KEY=your_access_key
MONTONIO_SECRET_KEY=your_secret_key
MONTONIO_WEBHOOK_SECRET=your_webhook_secret
```

**⚠️ Phase 6 Reminder**: The webhook URL will be changed to `https://rubikiailux.lt/api/montonio/webhook` during the final transition.

**✅ Montonio is configured for testing. Webhook URL will be updated in Phase 6.**

---

## 9. Vercel Deployment

Vercel is where your website will be hosted and accessible to the world.

### ⚠️ IMPORTANT: You Will Get a .vercel.app URL

In this section, you will deploy your project and get a URL like:
```
https://your-project-name.vercel.app
```

**You will use this URL for testing.** The custom domain (rubikiailux.lt) will be connected in **Phase 6 (Final Transition)**.

⚠️ **DO NOT add the custom domain in Vercel yet!** This will be done during the final transition.

⚠️ **CRITICAL**: This project is specifically built for Vercel. Using other hosting providers (AWS, Google Cloud, traditional servers) will require significant code changes.

### 9.1 Install Vercel CLI (Optional but Recommended)

In your terminal:
```bash
npm install -g vercel
```

### 9.2 Push Code to Git (Recommended Method)

1. Create a GitHub account if you don't have one: https://github.com/
2. Create a new repository:
   - Go to https://github.com/new
   - Name: `rubikiai-lux`
   - Make it **Private**
   - Don't initialize with README
   - Click "Create repository"
3. In your project folder, run these commands:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rubikiai-lux.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

### 9.3 Import Project to Vercel

1. Go to https://vercel.com/ and log in
2. Click "Add New..." → "Project"
3. Click "Import Git Repository"
4. Select your `rubikiai-lux` repository
5. Click "Import"

### 9.4 Configure Build Settings

Vercel should auto-detect these, but verify:
- **Framework Preset**: Next.js
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Node Version**: 20.x

### 9.5 Add Environment Variables in Vercel

⚠️ **CRITICAL STEP**: Your website won't work without these.

1. In the Vercel project import screen, scroll down to "Environment Variables"
2. Add **ALL** the variables from your `.env.local` file
3. For each variable:
   - Name: (e.g., `NEXT_PUBLIC_FIREBASE_API_KEY`)
   - Value: (paste the value)
   - Environments: Check **Production**, **Preview**, and **Development**
   - Click "Add"

**Special attention to:**
- `NEXT_PUBLIC_APP_URL`: Use `http://localhost:3000` for now (we'll update it after deployment in Section 9.7)
- `FIREBASE_PRIVATE_KEY`: Make sure the `\n` characters are preserved - wrap the entire key in double quotes
- `STRIPE_*` and `MONTONIO_*` variables: These are **already configured** - the owner will provide these values or they're already set in the project handoff

### 9.6 Deploy

1. Click "Deploy"
2. Wait 2-5 minutes for the build to complete
3. You'll see "Congratulations! Your project has been deployed!"
4. Click "Visit" to see your website

### 9.7 Update NEXT_PUBLIC_APP_URL

1. Copy your Vercel deployment URL (e.g., `https://rubikiai-lux.vercel.app`)
2. In Vercel project dashboard, go to "Settings" → "Environment Variables"
3. Find `NEXT_PUBLIC_APP_URL`
4. Click "Edit"
5. Change value to your Vercel URL (e.g., `https://rubikiai-lux.vercel.app`)
6. Save
7. Go to "Deployments" → Click "..." on latest deployment → "Redeploy"

**✅ Your website is now live on your .vercel.app URL!**

Your site is now accessible at something like `https://your-project.vercel.app`.

**Next steps:**
- Test the website thoroughly (Section 11)
- Create your admin account (Section 10)
- After everything works → Proceed to Phase 6 (Final Transition)

---

## 10. Admin Account Setup

You need to create your first admin account to access the admin panel.

⚠️ **Use your .vercel.app URL** - NOT rubikiailux.lt!

### 10.1 Set Bootstrap Token

In your `.env.local` (and Vercel environment variables), set `ADMIN_BOOTSTRAP_TOKEN` to a random, secure string:

Example:
```env
ADMIN_BOOTSTRAP_TOKEN=super_secret_token_12345_nobody_can_guess
```

⚠️ **Make this long and random. Anyone with this token can create admin accounts.**

Make sure this is also set in Vercel environment variables.

### 10.2 Create Admin Account

1. Go to your website: `https://YOUR-PROJECT.vercel.app/en/admin/bootstrap`
   - Use YOUR .vercel.app URL (not rubikiailux.lt!)
   - Replace `/en/` with your locale if different (e.g., `/lt/`, `/ru/`)
2. You'll see a bootstrap form with two fields:
   - **Email**: Enter the email you want to use for admin login
   - **Bootstrap Token**: Enter the exact token from `ADMIN_BOOTSTRAP_TOKEN`
3. Click "Create Admin"
4. You'll receive an email to set your password
5. Click the link in the email
6. Set a strong password
7. Your admin account is now created!

### 10.3 Test Admin Login

1. Go to `https://YOUR-PROJECT.vercel.app/en/admin`
2. Enter your email and password
3. You should see the admin dashboard

### 10.4 Security: Disable Bootstrap (IMPORTANT!)

⚠️ **After creating your admin account**, change the bootstrap token to prevent others from creating admin accounts:

1. In Vercel → Settings → Environment Variables
2. Change `ADMIN_BOOTSTRAP_TOKEN` to a different random string
3. Save and redeploy

**✅ Admin access is now set up and secured**

---

## 11. Testing Everything (On Your .vercel.app URL)

Before proceeding to Phase 6 (Final Transition), test EVERYTHING on your `.vercel.app` URL.

⚠️ **ALL testing happens on your .vercel.app URL** - NOT on rubikiailux.lt!

### 11.1 Frontend Testing

- [ ] Visit your website: `https://YOUR-PROJECT.vercel.app`
- [ ] Navigate through all pages
- [ ] Switch languages (LT, EN, RU)
- [ ] Check all images load
- [ ] Check mobile responsiveness (use Chrome DevTools → F12 → Toggle device toolbar)

### 11.2 Booking Flow Testing

- [ ] Select a house
- [ ] Choose check-in/check-out dates
- [ ] Fill booking form
- [ ] Test payment with Stripe test card:
  - Card number: `4242 4242 4242 4242`
  - Expiry: Any future date
  - CVC: Any 3 digits
  - ZIP: Any 5 digits
- [ ] Complete booking
- [ ] Check if confirmation email arrives
- [ ] Check if booking appears in admin panel

### 11.3 Admin Panel Testing

- [ ] Log in to admin: `https://YOUR-PROJECT.vercel.app/en/admin`
- [ ] View all reservations
- [ ] Edit a reservation
- [ ] Test creating/editing coupons
- [ ] Log out

### 11.4 Email Testing

⚠️ **Note**: Emails from `rubikiailux.lt` won't work yet (DNS not configured). For testing:
- Use Resend's test sending feature, OR
- Emails will fully work after Phase 6 DNS configuration

### 11.5 Payment Testing

**Stripe:**
- [ ] Test successful payment: `4242 4242 4242 4242`
- [ ] Test declined payment: `4000 0000 0000 0002`
- [ ] Check webhook receives events (check Vercel logs)

**Montonio:**
- [ ] Test payment in sandbox mode
- [ ] Check payment status updates

### 11.6 What Must Work Before Phase 6

Before proceeding to Phase 6 (Final Transition), verify:

| Feature | Status |
|---------|--------|
| Website loads correctly | ✅ Must work |
| All pages accessible | ✅ Must work |
| Booking form works | ✅ Must work |
| Stripe payment completes | ✅ Must work |
| Admin panel accessible | ✅ Must work |
| Can create/view reservations | ✅ Must work |

**If any of these don't work, FIX THEM before Phase 6!**

---

## 12. Automated Tasks (Cron Jobs)

The website automatically sends reminder emails to customers 7 days before their check-in date.

### 12.1 How It Works

- **Cron job** = Automated task that runs on a schedule
- This project uses **Vercel Cron Jobs**
- The task runs **every day at 9:00 AM UTC**
- It checks for any reservations with check-in date exactly 7 days from now
- Sends a reminder email to each customer

### 12.2 Configuration

The cron job is already configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/send-reminder",
      "schedule": "0 9 * * *"
    }
  ]
}
```

**Schedule format**: `0 9 * * *` means "At 09:00 UTC every day"
- First `0` = minute (0-59)
- `9` = hour (0-23) in UTC timezone
- First `*` = every day of month
- Second `*` = every month
- Third `*` = every day of week

### 12.3 Vercel Cron Setup

1. In Vercel project dashboard, go to "Settings"
2. Click "Cron Jobs" in the left sidebar
3. You should see: `/api/send-reminder` with schedule `0 9 * * *`
4. If not, your deployment might have failed - check deployment logs

### 12.4 Testing the Cron Job

To test if the reminder emails work:

1. Create a test reservation in your admin panel
2. Set the check-in date to exactly 7 days from today
3. Wait until 9:00 AM UTC the next day (or trigger manually - see below)
4. Check if the customer received the reminder email

**Manual trigger** (for testing):
- Visit: `https://rubikiailux.lt/api/send-reminder`
- This will run the cron job immediately (only works if you're logged in as admin)

### 12.5 Monitoring

- Check Vercel deployment logs to see if cron jobs are running
- In Vercel dashboard → "Deployments" → Click on a deployment → "Functions" → Look for `/api/send-reminder`

⚠️ **IMPORTANT**: Vercel's free tier includes cron jobs, but they only run on production deployments.

**✅ Automated reminders are now working**

---

## 13. Google Analytics Setup

Google Analytics tracks visitor behavior on your website.

### 13.1 How It Works

The website uses Firebase's `measurementId` for Google Analytics. If `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is set, analytics will automatically be enabled.

### 13.2 Enable Google Analytics in Firebase

1. Go to Firebase Console
2. Click the gear icon ⚙️ → "Project settings"
3. Scroll down to "Your apps"
4. Click on your web app
5. Scroll down to "Google Analytics"
6. Click "Enable Google Analytics"
7. Select or create a Google Analytics account
8. Click "Enable"
9. Copy the `measurementId` (looks like `G-XXXXXXXXXX`)
10. Add it to your `.env.local` and Vercel environment variables as `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

### 13.3 Verify Analytics is Working

1. Redeploy your website
2. Visit your website
3. Go to https://analytics.google.com/
4. Select your property
5. Go to "Realtime" → You should see your visit

**✅ Google Analytics is now tracking your website**

---

---

# 🔴 PHASE 6: FINAL TRANSITION

---

## ⚠️ STOP! Before Continuing...

**Have you completed ALL previous sections?**

| Requirement | Check |
|-------------|-------|
| Firebase project created and configured | ☐ |
| Resend account created, API key obtained | ☐ |
| Vercel deployment working on .vercel.app | ☐ |
| Admin account created and working | ☐ |
| All tests passing (Section 11) | ☐ |
| Everything works on your .vercel.app URL | ☐ |

**If ANY of these are not checked, GO BACK and complete them first!**

**⚠️ PHASE 6 WILL AFFECT THE LIVE WEBSITE!**

---

## 14. Pre-Transition Checklist

### 14.1 Contact the Developer

**Before making any DNS changes, contact the developer to coordinate:**

📧 Contact the developer and agree on a transition time.

**What you need to coordinate:**
1. A specific date and time for the transition
2. The developer will export a FRESH database backup
3. You will both be available during the transition (in case issues arise)

### 14.2 What the Developer Will Provide

The developer will send you:
- `firestore-backup.json` - The most recent database export

**This file will contain:**
- All house information
- All existing reservations
- All pricing configurations
- All coupons and discounts
- Everything needed to run the website

### 14.3 What You Need Ready

Before the transition call:

| Item | Ready? |
|------|--------|
| Access to Hostinger DNS settings | ☐ |
| Access to your Vercel dashboard | ☐ |
| Access to your Firebase console | ☐ |
| Resend DNS records saved (from Section 6.3) | ☐ |
| `firestore-backup.json` file received from developer | ☐ |
| Firebase `serviceAccountKey.json` file ready | ☐ |

---

## 15. Database Import

⚠️ **Only do this step when the developer tells you to!**

### 15.1 Prepare the Files

1. Make sure you have received `firestore-backup.json` from the developer
2. Make sure you have your Firebase `serviceAccountKey.json` file
3. Place both files in your project folder

### 15.2 Create the Import Script

Create a new file called `import-data.js` in your project folder:

```javascript
const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function importData() {
  try {
    // Read the backup file
    const data = JSON.parse(fs.readFileSync('./firestore-backup.json', 'utf8'));

    console.log('Starting import...');
    console.log('');

    // Import each collection
    for (const [collectionName, documents] of Object.entries(data)) {
      // Skip metadata
      if (collectionName === '_metadata') continue;

      // Check if this is a subcollection (format: parentCollection_subcollection)
      if (collectionName.includes('_')) {
        const [parentCollection, subcollection] = collectionName.split('_');
        console.log(`Importing subcollection: ${parentCollection}/*/${subcollection}`);

        for (const [parentDocId, subDocs] of Object.entries(documents)) {
          for (const [subDocId, subDocData] of Object.entries(subDocs)) {
            await db.collection(parentCollection)
              .doc(parentDocId)
              .collection(subcollection)
              .doc(subDocId)
              .set(subDocData);
            console.log(`  - ${parentDocId}/${subDocId}`);
          }
        }
      } else {
        // Regular collection
        console.log(`Importing collection: ${collectionName}`);

        for (const [docId, docData] of Object.entries(documents)) {
          await db.collection(collectionName).doc(docId).set(docData);
          console.log(`  - Imported: ${docId}`);
        }
      }
    }

    console.log('');
    console.log('✅ Import completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing data:', error);
    process.exit(1);
  }
}

importData();
```

### 15.3 Run the Import

In your terminal (make sure you're in the project folder):

```bash
node import-data.js
```

You should see output like:
```
Starting import...
Importing collection: houses
  - Imported document: dupleksas
  - Imported document: ezero-namelis
  - Imported document: ...
Importing collection: reservations
  - Imported: abc123
  - Imported: def456
...
✅ Import completed successfully!
```

### 15.4 Verify the Import

1. Go to Firebase Console → Firestore Database
2. You should see collections like `houses`, `reservations`, etc.
3. Click on a house document to verify it has all the data

**Troubleshooting:**

- **"Cannot find module 'firebase-admin'"**: Run `npm install firebase-admin`
- **"Cannot find module './serviceAccountKey.json'"**: Make sure the file is in the same folder
- **"Cannot find module './firestore-backup.json'"**: Make sure you received and placed the backup file

---

## 16. Domain Configuration (DNS Changes)

⚠️ **THIS STEP WILL REDIRECT THE LIVE WEBSITE TO YOUR SERVERS!**

**Only proceed when:**
- Database import is complete (Section 15)
- Developer has confirmed you can proceed

### 16.1 Add Domain in Vercel

1. In your Vercel project dashboard, click **"Settings"**
2. Click **"Domains"** in the left sidebar
3. Type `rubikiailux.lt` and click **"Add"**
4. Also add `www.rubikiailux.lt`
5. Choose **"Redirect www.rubikiailux.lt → rubikiailux.lt"**
6. (Optional) Add `rubikiai.lt` and `www.rubikiai.lt` with redirect

### 16.2 Change DNS Records in Hostinger

**⚠️ THIS IS THE POINT OF NO RETURN - The live site will switch to your servers!**

1. Log in to Hostinger (https://www.hostinger.com/)
2. Go to **"Domains"** → **"Manage"** next to `rubikiailux.lt`
3. Click **"DNS / Nameservers"**

**Delete or edit existing records and add these:**

**Record 1 - Root Domain (A Record):**
| Field | Value |
|-------|-------|
| Type | `A` |
| Name/Host | `@` |
| Points to | `76.76.21.21` |
| TTL | `3600` |

**Record 2 - WWW Subdomain (CNAME Record):**
| Field | Value |
|-------|-------|
| Type | `CNAME` |
| Name/Host | `www` |
| Points to | `cname.vercel-dns.com` |
| TTL | `3600` |

### 16.3 Add Resend DNS Records

Now add the Resend DNS records you saved from Section 6.3:

| Type | Name | Value |
|------|------|-------|
| TXT | `@` | (your SPF record from Resend) |
| TXT | `resend._domainkey` | (your DKIM record from Resend) |
| TXT | `_dmarc` | (your DMARC record from Resend) |

### 16.4 Summary of All DNS Records

Your DNS settings should now look like this:

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| A | `@` | `76.76.21.21` | Vercel |
| CNAME | `www` | `cname.vercel-dns.com` | Vercel |
| TXT | `@` | `v=spf1...` | Resend SPF |
| TXT | `resend._domainkey` | `p=MIG...` | Resend DKIM |
| TXT | `_dmarc` | `v=DMARC1...` | Resend DMARC |

### 16.5 (If using rubikiai.lt) Repeat for Secondary Domain

1. Go to **"Domains"** → **"Manage"** next to `rubikiai.lt`
2. Add the same A and CNAME records

---

## 17. Final Verification

### 17.1 Wait for DNS Propagation

DNS changes can take **10 minutes to 24 hours** to propagate worldwide.

**To check DNS propagation:**
1. Go to https://dnschecker.org/
2. Enter `rubikiailux.lt`
3. Select "A" record type
4. Click "Search"
5. When most locations show `76.76.21.21`, your DNS is propagated

### 17.2 Verify Domain in Vercel

1. Go to Vercel → Settings → Domains
2. Click "Refresh" next to your domain
3. Wait for the green checkmark ✓
4. Vercel will automatically issue SSL certificates

### 17.3 Verify Resend Domain

1. Go to Resend dashboard → Domains
2. Click "Verify Records"
3. Wait for the green checkmark ✓

### 17.4 Update NEXT_PUBLIC_APP_URL

1. In Vercel → Settings → Environment Variables
2. Find `NEXT_PUBLIC_APP_URL`
3. Change from `https://your-project.vercel.app` to `https://rubikiailux.lt`
4. Save and **Redeploy**

### 17.5 Update Stripe Webhook URL

1. Go to Stripe Dashboard → Developers → Webhooks
2. Find your webhook (pointing to .vercel.app)
3. Click "Update details"
4. Change URL to: `https://rubikiailux.lt/api/stripe/webhook`
5. Save

### 17.6 Update Montonio Webhook URL

1. Go to your Montonio dashboard
2. Find webhook settings
3. Change URL to: `https://rubikiailux.lt/api/montonio/webhook`
4. Save

### 17.7 Final Tests on Live Domain

- [ ] Visit `https://rubikiailux.lt` - website loads
- [ ] Visit `https://www.rubikiailux.lt` - redirects to rubikiailux.lt
- [ ] Check padlock icon 🔒 (SSL working)
- [ ] Log in to admin panel
- [ ] Check reservations are visible
- [ ] Test a booking (use Stripe test card)
- [ ] Check confirmation email arrives
- [ ] Check email is from `info@rubikiailux.lt` (not Resend test domain)

### 17.8 Inform the Developer

Once everything is working:

📧 Contact the developer to confirm the transition is complete.

The developer will then disable the old system.

---

**🎉 CONGRATULATIONS!**

**The website is now fully under your control!**

From this point forward:
- All reservations go to YOUR Firebase
- All payments go through YOUR configured accounts
- All emails are sent from YOUR domain
- YOU are responsible for everything

---

# Reference Sections

---

## 18. Troubleshooting

### Common Issues and Solutions

#### Issue: "npm install" fails

**Solution:**
- Make sure Node.js 20+ is installed: `node --version`
- Delete `node_modules` folder and `package-lock.json`
- Run `npm install` again
- If still fails, check error message and Google it

#### Issue: Website shows "Application Error" or blank page

**Solution:**
- Check Vercel deployment logs for errors
- Verify all environment variables are set correctly
- Make sure Firebase, Stripe, and other services are configured
- Check browser console for errors (F12 → Console tab)

#### Issue: Firebase "Permission Denied" errors

**Solution:**
- Verify Firestore security rules are published
- Make sure you're logged in as admin
- Check that admin account exists in `admins` collection in Firestore

#### Issue: Emails not sending

**Solution:**
- Verify Resend domain is verified (green checkmark)
- Check DNS records are correct
- Wait 24 hours for DNS propagation
- Check `RESEND_API_KEY` is set correctly
- Check Resend dashboard for error logs

#### Issue: Payments not working

**Solution:**
- Verify webhook is set up in Stripe (URL: `/api/stripe/webhook`)
- Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- Check `STRIPE_SECRET_KEY` is set correctly in Vercel
- Use Stripe test cards (not real cards in test mode)
- Check Stripe dashboard → Developers → Logs for errors
- For Montonio: Check `MONTONIO_ACCESS_KEY`, `MONTONIO_SECRET_KEY`, and `MONTONIO_WEBHOOK_SECRET`

#### Issue: Cron job not running

**Solution:**
- Verify `vercel.json` exists in project root
- Cron jobs only run on production (not preview deployments)
- Check Vercel → Settings → Cron Jobs
- Check Vercel function logs for errors
- Manually trigger by visiting `/api/send-reminder`

#### Issue: Admin bootstrap not working

**Solution:**
- Verify `ADMIN_BOOTSTRAP_TOKEN` is set in Vercel environment variables
- Make sure token matches exactly (no extra spaces)
- Check browser console for errors
- Verify Firebase Authentication is enabled

#### Issue: Domain not connecting

**Solution:**
- Wait 24-48 hours for DNS propagation
- Verify DNS records are correct in Hostinger
- Use DNS checker: https://dnschecker.org/
- In Vercel, click "Refresh" next to domain
- Check for typos in DNS records

#### Issue: Build fails on Vercel

**Solution:**
- Check Vercel build logs for specific error
- Verify all dependencies are in `package.json`
- Make sure TypeScript types are correct
- Check that all environment variables are set
- Try building locally: `npm run build`

### Getting Help

If you can't solve an issue:

1. **Check the error message carefully** - Google it
2. **Check Vercel logs** - Most issues show up here
3. **Check service dashboards** (Firebase, Stripe, Resend) for errors
4. **Ask AI assistants** (ChatGPT, Claude, etc.) for help with specific errors
5. **Hire a developer** if the issue is beyond your technical skills

**Remember**: You are now responsible for all technical issues. The previous developer is no longer maintaining this project.

---

## 19. Important Files and Folders

### Project Structure

This is the actual structure of your project:

```
rubikiai_lux/
├── src/
│   ├── app/                           # Next.js App Router (pages and APIs)
│   │   ├── api/                       # Global API endpoints (no language prefix)
│   │   │   ├── stripe/webhook/        # Stripe payment webhook
│   │   │   ├── montonio/webhook/      # Montonio payment webhook
│   │   │   └── send-reminder/         # Cron job for email reminders
│   │   ├── [locale]/                  # Language-specific pages (en, lt, ru)
│   │   │   ├── admin/                 # Admin panel
│   │   │   │   ├── bookings/          # Reservation management
│   │   │   │   ├── houses/            # Property management
│   │   │   │   ├── coupons/           # Coupon management
│   │   │   │   ├── discounts/         # Discount management
│   │   │   │   ├── revenue/           # Revenue dashboard
│   │   │   │   ├── bootstrap/         # Admin account creation
│   │   │   │   └── page.tsx           # Admin dashboard
│   │   │   ├── api/                   # Language-specific API routes
│   │   │   │   ├── create-checkout-session/ # Create Stripe payment
│   │   │   │   ├── montonio/          # Montonio payment routes
│   │   │   │   ├── coupons/           # Coupon validation
│   │   │   │   └── reservations/      # Reservation pricing
│   │   │   ├── dupleksas/             # Dupleksas house page
│   │   │   ├── ezero-namelis/         # Lake House page
│   │   │   ├── reservations/          # Booking page
│   │   │   ├── payment/               # Payment pages
│   │   │   ├── checkout-details/      # Checkout form
│   │   │   ├── checkout-complete/     # Payment success handler
│   │   │   ├── thanks/                # Thank you page
│   │   │   ├── cancel/                # Cancellation page
│   │   │   ├── contact/               # Contact page
│   │   │   ├── house-rules/           # House rules page
│   │   │   ├── privacy-policy/        # Privacy policy
│   │   │   ├── faq/                   # FAQ page
│   │   │   └── page.tsx               # Home page
│   │   ├── globals.css                # Global styles
│   │   └── layout.tsx                 # Root layout
│   ├── components/                    # Reusable React components
│   │   ├── Header.tsx                 # Website header
│   │   ├── Footer.tsx                 # Website footer
│   │   ├── ReservationForm.tsx        # Booking calendar and form
│   │   ├── HousePage.tsx              # Property page template
│   │   ├── ImageGallery.tsx           # Photo gallery
│   │   └── house-components/          # Property-specific components
│   ├── context/                       # React context (state management)
│   │   └── HouseContext.tsx           # House data provider
│   ├── i18n/                          # Internationalization config
│   │   ├── config.ts                  # Supported languages (lt, en, ru)
│   │   └── request.ts                 # Language request handling
│   ├── lib/                           # Utility files
│   │   ├── firebase-admin.ts          # Firebase Admin SDK (server-side)
│   │   ├── firebase-auth.ts           # Firebase Auth (client-side)
│   │   ├── firestore.ts               # Firestore client
│   │   ├── checkout-utils.ts          # Price calculation utilities
│   │   ├── emailTemplates.ts          # Email templates
│   │   └── currency.ts                # Currency configuration
│   └── middleware.ts                  # Request middleware
├── public/                            # Static files (images, icons)
│   ├── home/                          # Homepage images
│   ├── dupleksas/                     # Dupleksas house images
│   ├── ezero-namelis/                 # Lake House images
│   ├── manifest.json                  # PWA manifest
│   └── sw.js                          # Service worker (PWA)
├── messages/                          # Translation files
│   ├── lt.json                        # Lithuanian translations
│   ├── en.json                        # English translations
│   └── ru.json                        # Russian translations
├── package.json                       # Project dependencies
├── next.config.ts                     # Next.js configuration
├── vercel.json                        # Vercel settings (cron jobs)
├── tsconfig.json                      # TypeScript configuration
└── README.md                          # This documentation
```

### Critical Files - NEVER Delete These

| File | Purpose |
|------|---------|
| `package.json` | Lists all dependencies. Deleting = project won't run |
| `package-lock.json` | Locks dependency versions. Ensures consistency |
| `next.config.ts` | Next.js settings. Deleting = build fails |
| `vercel.json` | Vercel settings including cron jobs |
| `tsconfig.json` | TypeScript settings. Deleting = build fails |
| `src/middleware.ts` | Handles language routing and webhook exclusions |
| `src/lib/firebase-admin.ts` | Server-side Firebase. Deleting = API fails |
| `src/lib/firestore.ts` | Client-side Firebase. Deleting = website fails |

### Files You CAN Safely Modify

| Location | What You Can Change |
|----------|---------------------|
| `messages/*.json` | Translations (text content) |
| `public/*` | Images and static files |
| `src/components/*.tsx` | UI components (if you know React) |
| `src/app/[locale]/*/page.tsx` | Page content |

### Files You Should NOT Modify

| Location | Why Not? |
|----------|----------|
| `src/lib/firebase-*.ts` | Breaking these breaks the entire backend |
| `src/app/api/*` | Payment and webhook logic - very sensitive |
| `src/lib/checkout-utils.ts` | Price calculations - errors = wrong prices |
| `package.json` versions | Changing versions can break everything |

### Webhook URLs (Important!)

These are the URLs that payment providers use to notify your website:

| Provider | Webhook URL |
|----------|-------------|
| **Stripe** | `https://rubikiailux.lt/api/stripe/webhook` |
| **Montonio** | `https://rubikiailux.lt/api/montonio/webhook` |

⚠️ If you change your domain, you MUST update these URLs in:
1. Stripe Dashboard → Developers → Webhooks
2. Montonio Dashboard → Webhook settings

---

## 20. Going Live Checklist

Use this checklist to verify everything is working before announcing your website.

### Already Done (No Action Needed)

These are already configured and working:

- [x] **Stripe** - Already in LIVE mode with owner's account
- [x] **Montonio** - Already in PRODUCTION mode with owner's account
- [x] **Webhooks** - Already configured and receiving payments

### What YOU Need to Configure

#### Firebase (Required)

- [ ] Create Firebase project (Section 5)
- [ ] Enable Firebase Authentication with Email/Password
- [ ] Create Firestore Database
- [ ] **Publish Security Rules** (copy from Section 5.3)
- [ ] **Create all 7 Indexes** (Section 5.4) - wait for "Enabled" status
- [ ] Get Client SDK config (NEXT_PUBLIC_FIREBASE_* variables)
- [ ] Generate Admin SDK service account JSON
- [ ] Add Firebase variables to Vercel

#### Resend Email (Required)

- [ ] Create Resend account
- [ ] Get API key
- [ ] **Verify your domain** (Section 6.2-6.3)
- [ ] Wait for DNS propagation (up to 24 hours)
- [ ] Add `RESEND_API_KEY` to Vercel

#### Vercel Deployment (Required)

- [ ] Create Vercel account
- [ ] Connect GitHub repository
- [ ] Add ALL environment variables to Vercel
- [ ] Deploy the project
- [ ] Update `NEXT_PUBLIC_APP_URL` with your Vercel URL

#### Domain (Required)

- [ ] Add domain in Vercel
- [ ] Configure DNS records in Hostinger (Section 10.2)
- [ ] Wait for DNS propagation
- [ ] Verify SSL certificate is active (padlock icon)
- [ ] Update `NEXT_PUBLIC_APP_URL` to your domain

#### Admin Account (Required)

- [ ] Set `ADMIN_BOOTSTRAP_TOKEN` in Vercel
- [ ] Go to `/en/admin/bootstrap`
- [ ] Create your admin account
- [ ] Test login at `/en/admin`
- [ ] **Change or remove** `ADMIN_BOOTSTRAP_TOKEN` after creation

### Final Verification

After everything is configured:

- [ ] Visit your website - homepage loads correctly
- [ ] Test language switching (EN, LT, RU)
- [ ] Select a property and check the calendar
- [ ] Fill a test booking (don't complete payment yet)
- [ ] Check admin panel - you can log in
- [ ] View reservations in admin panel
- [ ] Check email - confirmation emails arrive
- [ ] Test a real booking with Stripe (use test card first if nervous)
- [ ] Verify the booking appears in admin panel
- [ ] Check that reminder cron job is configured in Vercel

### Optional but Recommended

- [ ] Enable Google Analytics (Section 13)
- [ ] Set `CRON_SECRET` for extra security
- [ ] Review all page content for accuracy
- [ ] Test on mobile devices
- [ ] Check all images load correctly

**✅ Once all required items are checked, you're ready to go live!**

---

## 21. Maintenance and Updates

### Regular Tasks

**Weekly:**
- Check Vercel deployment logs for errors
- Monitor email delivery in Resend dashboard
- Check Stripe dashboard for payment issues
- Review reservations in admin panel

**Monthly:**
- Review Google Analytics data
- Check Firebase usage (stay within free tier limits)
- Monitor Vercel bandwidth usage
- Review and respond to customer emails

### Updating Dependencies

⚠️ **WARNING: Only update if absolutely necessary**

If you must update packages:

1. **Backup everything first**
2. Update one package at a time
3. Test thoroughly after each update
4. If something breaks, revert immediately

To update:
```bash
npm update package-name
```

To check for updates:
```bash
npm outdated
```

**Do NOT run `npm update` without package name** - it will update everything and likely break things.

### Security Updates

If you receive a security warning from GitHub or npm:

1. Read the security advisory carefully
2. Determine if it affects your project
3. Update only the affected package
4. Test thoroughly before deploying

---

## 22. Important Notes

### What You Own

- ✅ Complete source code
- ✅ All design and assets
- ✅ Database structure and data
- ✅ Email templates
- ✅ Admin panel
- ✅ All intellectual property rights

### What You're Responsible For

- ⚠️ All future changes and updates
- ⚠️ All technical issues and bugs
- ⚠️ Service configuration and maintenance
- ⚠️ Payment processing and disputes
- ⚠️ Data security and privacy compliance
- ⚠️ Server costs and service fees
- ⚠️ Customer support related to technical issues

### Service Costs (Approximate)

- **Vercel**: Free tier should be sufficient for small traffic. $20/month for Pro if needed.
- **Firebase**: Free tier includes 50k reads, 20k writes, 1GB storage per day. Paid plans start at $25/month.
- **Resend**: Free tier: 3,000 emails/month. Paid plans start at $20/month.
- **Stripe**: 2.9% + $0.30 per transaction (no monthly fee)
- **Montonio**: Check with Montonio for their fee structure
- **Domain**: Varies by registrar (~$10-15/year)

**Total estimated cost**: $0-70/month depending on traffic and usage.

### Technologies Used

This project is built with:
- **Next.js 15.5.7** (React framework)
- **React 19.1.0** (UI library)
- **TypeScript 5** (Programming language)
- **Firebase 12.2.1** (Database and authentication)
- **Tailwind CSS 4** (Styling)
- **Stripe** (Payment processing)
- **Resend** (Email delivery)
- **Framer Motion** (Animations)
- **next-intl** (Internationalization)

⚠️ **Changing any of these will require significant code modifications.**

---

## 23. Final Words

**Congratulations!** You now have complete control over your website.

### Remember:

1. **Keep all passwords and API keys secure**
2. **Backup your database regularly** (Firebase auto-backs up, but export important data)
3. **Monitor your service usage** to avoid unexpected bills
4. **Test in test mode before going live**
5. **Don't update packages without testing**
6. **If something breaks, check the logs first**
7. **When in doubt, ask for help** - don't randomly change code

### Need Help?

- Google is your friend - most errors have solutions online
- AI assistants (ChatGPT, Claude) can help explain code and fix issues
- Stack Overflow has answers to common problems
- Consider hiring a developer for complex changes

### Good Luck!

This README contains everything you need to successfully run and maintain your website. Follow the steps carefully, test thoroughly, and you'll do great!

If you have questions about specific features or need clarification on any step, refer back to this document.

**Your website is now in your hands. Make it successful! 🚀**

---

**Document Version**: 1.0
**Last Updated**: January 2026
**Project**: RubikiAI Lux
**Framework**: Next.js 15.5.7
**Node Version Required**: 20+

---

## Quick Command Reference

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Check Node version
node --version

# Check npm version
npm --version

# Update a single package
npm update package-name

# Check for outdated packages
npm outdated
```

---

## 24. Glossary of Technical Terms

If you're not familiar with programming, here's what these terms mean:

| Term | What It Means |
|------|---------------|
| **API** | Application Programming Interface - how different services communicate with each other |
| **API Key** | A secret password that allows your website to use external services |
| **Backend** | The server-side part of your website that users don't see (handles payments, database, etc.) |
| **Build** | The process of converting your code into files that can run on the web |
| **CLI** | Command Line Interface - a text-based way to interact with your computer |
| **Cron Job** | An automated task that runs on a schedule (like sending reminder emails) |
| **Database** | Where all your data is stored (reservations, houses, users, etc.) |
| **Deploy** | Publishing your website so it's accessible on the internet |
| **DNS** | Domain Name System - translates domain names (rubikiailux.lt) to server addresses |
| **Environment Variable** | A secret value stored outside the code (passwords, API keys) |
| **Firebase** | Google's service for databases and user authentication |
| **Firestore** | Firebase's database where all your reservation data is stored |
| **Frontend** | The visual part of your website that users see and interact with |
| **Git** | A tool for tracking changes in code and collaborating with others |
| **GitHub** | A website for storing Git repositories (your code) |
| **Localhost** | Your own computer when running the website for testing |
| **Node.js** | A program that runs JavaScript code on servers |
| **npm** | Node Package Manager - installs and manages code libraries |
| **Production** | The live version of your website that real users see |
| **Repository** | A folder containing your project and its history |
| **SDK** | Software Development Kit - tools for building with a service |
| **SSL Certificate** | Security certificate that enables HTTPS (the padlock icon) |
| **Terminal** | A text-based interface to run commands on your computer |
| **Vercel** | The hosting service where your website runs |
| **Webhook** | A way for external services (Stripe, Montonio) to notify your website of events |

---

## 25. How to Modify Translations

The website supports 3 languages: Lithuanian (lt), English (en), and Russian (ru).

### Where Translations Are Stored

All translations are in the `messages/` folder:
- `messages/lt.json` - Lithuanian
- `messages/en.json` - English
- `messages/ru.json` - Russian

### How to Edit Translations

1. Open the file for the language you want to modify (e.g., `messages/en.json`)
2. Find the text you want to change
3. Modify the text inside the quotes
4. Save the file
5. Redeploy your website (Vercel will automatically redeploy if connected to GitHub)

**Example:**
```json
{
  "home": {
    "title": "Welcome to Our Houses",  // ← Change this text
    "subtitle": "Luxury accommodation"
  }
}
```

⚠️ **Important Rules:**
- NEVER delete the structure (curly braces, colons, commas)
- ONLY change the text inside quotes
- Keep the same keys (left side of the colon)
- If you see `{something}` in the text, DON'T change it - it's a placeholder

---

## 26. Managing Your Website (Admin Panel)

### Accessing the Admin Panel

1. Go to: `https://rubikiailux.lt/en/admin` (or `/lt/admin` for Lithuanian)
2. Log in with your admin email and password

### What You Can Do in Admin

| Section | What You Can Do |
|---------|-----------------|
| **Dashboard** | See overview of recent bookings and revenue |
| **Bookings** | View, edit, and manage all reservations |
| **Houses** | Edit property information, prices, availability |
| **Coupons** | Create and manage discount coupons |
| **Discounts** | Create percentage-based discounts |
| **Revenue** | View income reports and statistics |

### Managing Reservations

1. Go to Admin → Bookings
2. You can:
   - View all reservations
   - Filter by status (pending, confirmed, cancelled)
   - View customer details
   - Change reservation status
   - Block dates manually

### Managing Prices

Property prices are stored in Firebase. To change prices:
1. Go to Admin → Houses
2. Select the property you want to modify
3. Update the pricing information
4. Save changes

---

## 27. Common Tasks (Quick Reference)

### "I need to change the email that receives booking notifications"

1. Go to Vercel → Your Project → Settings → Environment Variables
2. Find `OWNER_EMAIL`
3. Click Edit, change to your new email
4. Save and Redeploy

### "I need to change text on the website"

1. Find the translation file: `messages/en.json` (or lt.json, ru.json)
2. Search for the text you want to change
3. Edit the text inside the quotes
4. Save and redeploy (or push to GitHub)

### "I need to add a new admin user"

1. Make sure `ADMIN_BOOTSTRAP_TOKEN` is set in Vercel
2. Go to `https://rubikiailux.lt/en/admin/bootstrap`
3. Enter the new admin's email and the bootstrap token
4. The new admin will receive an email to set their password

### "The website shows an error"

1. Check Vercel deployment logs (Vercel → Deployments → Latest → Logs)
2. Check browser console (F12 → Console tab)
3. Verify all environment variables are set correctly
4. Make sure Firebase rules are published
5. Check that Firebase indexes are "Enabled" (not "Building")

### "Emails are not being sent"

1. Go to Resend dashboard and check if domain is verified (green checkmark)
2. Check that `RESEND_API_KEY` is set correctly in Vercel
3. Wait up to 24 hours for DNS records to propagate
4. Check Resend logs for any errors

### "Payments are failing"

1. Check Stripe/Montonio dashboard for error logs
2. Verify webhook URLs are correct
3. Make sure `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
4. For test payments, use card: `4242 4242 4242 4242`

---

## 28. Quick Start Summary (One Page Reference)

For those who want a condensed version:

---

### Phase 1-5: Setup and Testing (Does NOT affect live site)

#### Step 1: Create Required Accounts
- [ ] Firebase (https://firebase.google.com)
- [ ] Vercel (https://vercel.com)
- [ ] Resend (https://resend.com)
- [ ] GitHub (https://github.com)

#### Step 2: Configure Firebase (NO data import yet)
- [ ] Create project
- [ ] Enable Authentication (Email/Password)
- [ ] Create Firestore database (europe-west1)
- [ ] Publish security rules (Section 5.3)
- [ ] Create 7 indexes (Section 5.4) - wait for "Enabled"
- [ ] Get Client SDK config
- [ ] Generate Admin SDK service account JSON
- [ ] **Fill Firebase variables in `.env.local`**

#### Step 3: Configure Resend (NO DNS changes yet)
- [ ] Create account
- [ ] Get API key
- [ ] Add domain (rubikiailux.lt) - note the DNS records for later
- [ ] **⚠️ DO NOT add DNS records in Hostinger yet!**

#### Step 4: Deploy to Vercel (Get .vercel.app URL)
- [ ] Push code to GitHub (private repository)
- [ ] Import project in Vercel
- [ ] Add ALL environment variables
- [ ] Deploy → Get your `https://xxx.vercel.app` URL
- [ ] Update `NEXT_PUBLIC_APP_URL` to your .vercel.app URL

#### Step 5: Test Everything on .vercel.app
- [ ] Create admin account on your .vercel.app URL
- [ ] Log in to admin panel
- [ ] Test booking flow (with test card: `4242 4242 4242 4242`)
- [ ] Verify everything works

---

### Phase 6: Final Transition (AFFECTS live site!)

**⚠️ Only proceed when ALL Phase 1-5 tests pass!**

#### Step 6: Contact Developer
- [ ] Coordinate a transition time
- [ ] Receive fresh `firestore-backup.json` from developer

#### Step 7: Import Database
- [ ] Run import script with fresh backup file
- [ ] Verify data in Firebase console

#### Step 8: Change DNS (THIS SWITCHES THE LIVE SITE!)
- [ ] Add domain in Vercel
- [ ] Change DNS in Hostinger (A record, CNAME)
- [ ] Add Resend DNS records (SPF, DKIM, DMARC)
- [ ] Wait for propagation

#### Step 9: Final Configuration
- [ ] Verify domain in Vercel (green checkmark)
- [ ] Verify domain in Resend (green checkmark)
- [ ] Update `NEXT_PUBLIC_APP_URL` to `https://rubikiailux.lt`
- [ ] Update Stripe webhook URL to real domain
- [ ] Update Montonio webhook URL to real domain
- [ ] Redeploy

#### Step 10: Verify & Confirm
- [ ] Test website on `https://rubikiailux.lt`
- [ ] Test admin panel
- [ ] Test booking flow
- [ ] Test email delivery
- [ ] Inform developer transition is complete

---

**🎉 Done! The website is now fully under your control!**

---

**END OF DOCUMENTATION**