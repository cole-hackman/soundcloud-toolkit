# 🛡️ 7 Security Checks for AI-Generated Code

## Overview

[cite_start]AI coding tools build fast, but often introduce vulnerabilities because they reproduce patterns found in public repositories, including hardcoded secrets and broken authentication[cite: 21, 31, 32]. [cite_start]45% of AI-generated code contains security flaws[cite: 21].

## The 15-Minute Checklist

| Check                        | Time  | Goal                                                                         |
| :--------------------------- | :---- | :--------------------------------------------------------------------------- |
| **1. Secret Scanner**        | 2 min | [cite_start]Find hardcoded API keys and credentials[cite: 37, 46].           |
| **2. Auth Verification**     | 3 min | [cite_start]Ensure every endpoint is protected and authorized[cite: 38, 70]. |
| **3. Input Sanitization**    | 3 min | [cite_start]Prevent XSS, SQLi, and Log Injection[cite: 39, 101].             |
| **4. Dependency Audit**      | 2 min | [cite_start]Catch "slopsquatting" and fake packages[cite: 39, 138].          |
| **5. Dev/Prod Separation**   | 2 min | [cite_start]Isolate AI tools from production data[cite: 39, 163].            |
| **6. Error Handling**        | 2 min | [cite_start]Prevent internal info leaks via stack traces[cite: 42, 197].     |
| **7. Destructive Ops Audit** | 1 min | [cite_start]Review all DELETE and bulk UPDATE logic[cite: 42, 221].          |

---

## 🔍 Detailed Security Rubrics

### Check 1: Secret Scanner

- [cite_start]**The Risk**: AI often hardcodes Stripe keys, DB passwords, and tokens because it saw them in training data[cite: 47, 48].
- **Audit Steps**:
  - [cite_start]Search codebase for: `sk_live`, `api_key`, `password`, `secret`, `token`, `PRIVATE KEY`, and `DATABASE URL`[cite: 50].
  - [cite_start]**FAIL**: If any of these appear outside of `.env` files[cite: 51, 63].
- [cite_start]**Tools**: TruffleHog (scans git history) or GitGuardian[cite: 53, 57].

### Check 2: Auth Verification

- [cite_start]**The Risk**: AI builds working features but forgets to check if the specific user has permission to see the requested data[cite: 71, 72].
- **Audit Steps**:
  - [cite_start]Verify authentication is required for every API endpoint[cite: 75].
  - [cite_start]Verify the user's identity via valid token[cite: 76].
  - [cite_start]**Resource-Level Auth**: Ensure User A cannot see User B's data by simply changing the ID in the URL[cite: 85, 87].
  - [cite_start]Check for admin endpoints that lack role-based checks[cite: 89, 92].
  - [cite_start]Check JWTs for expiration (`exp`) fields; tokens should not last forever[cite: 94, 96, 97].

### Check 3: Input Sanitization

- [cite_start]**The Risk**: AI misses XSS prevention 86% of the time and Log Injection 88% of the time[cite: 103, 107].
- **Audit Steps**:
  - **XSS**: Identify use of `innerHTML` or `dangerouslySetInnerHTML`. [cite_start]Fix by using `textContent` or DOMPurify[cite: 119, 121].
  - **SQLi**: Look for string concatenation in database queries. [cite_start]Fix by using parameterized queries (ORMs like Prisma/SQLAlchemy)[cite: 123, 125, 126].
  - [cite_start]**Log Injection**: Ensure user input is sanitized (strip newlines/control characters) before logging[cite: 128, 129].
  - [cite_start]**Path Traversal**: Validate filenames and strip directory traversal characters from user-provided paths[cite: 130, 132, 133].

### Check 4: Dependency Audit

- [cite_start]**The Risk**: "Slopsquatting"—AI recommends non-existent packages which attackers then register with malicious code[cite: 139, 142].
- **Audit Steps**:
  - [cite_start]Check `package.json` or `requirements.txt` for unrecognized names[cite: 144, 145].
  - [cite_start]Verify package existence and download volume on npmjs.com or pypi.org[cite: 145, 146].
  - [cite_start]Run `npm audit` or `pip-audit`[cite: 147].
  - [cite_start]Enable GitHub Dependabot for automated scanning[cite: 157].

### Check 5: Separate Dev from Prod

- [cite_start]**The Risk**: AI agents running destructive commands on production databases (e.g., the Replit disaster)[cite: 164, 165].
- **Audit Steps**:
  - [cite_start]Ensure the AI tool does **not** have production database credentials[cite: 175].
  - [cite_start]Require human approval for all production deployments[cite: 176, 192].
  - [cite_start]Use a **read-only** database user for AI agents so they can understand schema without destroying data[cite: 189, 190].

### Check 6: Error Handling

- [cite_start]**The Risk**: Full stack traces or raw DB errors sent to the user leak internal architecture to hackers[cite: 199, 201, 211, 212].
- **Audit Steps**:
  - [cite_start]Search for `catch` blocks that send the error directly to the response[cite: 205].
  - [cite_start]**The Fix**: Log real errors internally; return generic "Something went wrong" messages with a Request ID to the user[cite: 213, 214, 215].

### Check 7: Destructive Operation Audit

- [cite_start]**The Risk**: AI logic deleting the wrong records or recreating entire environments (e.g., Amazon's lost orders)[cite: 225, 226].
- **Audit Steps**:
  - [cite_start]Identify all `DELETE` or destructive API calls[cite: 230].
  - [cite_start]**Safeguards**: Use "soft deletes" (timestamping `deleted_at`) instead of hard deletes[cite: 236, 237].
  - [cite_start]Rate-limit destructive endpoints (e.g., 10 deletes per minute)[cite: 240].

---
