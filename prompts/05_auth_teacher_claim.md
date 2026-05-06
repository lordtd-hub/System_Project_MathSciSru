# Task 05 — Google auth and teacher account claim

Implement Google authentication.

Student:
- must match imported generated email
- domain: student.sru.ac.th

Teacher:
- domain: sru.ac.th
- if not linked to a teacher profile, show claim page
- teacher selects an unclaimed teacher profile
- create PENDING claim
- Admin approves/rejects
- only APPROVED teachers access scoring pages

Admin:
- initial admin may be set by INITIAL_ADMIN_EMAIL env var.
