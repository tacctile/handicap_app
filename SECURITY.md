# Security Policy

## Supported Versions

Only the current release version is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| Current | :white_check_mark: |
| Older   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **GitHub Security Advisories (Preferred)**: Use [GitHub's private vulnerability reporting](https://github.com/tacctile/handicap_app/security/advisories/new) to submit a confidential report.

2. **Email**: Send details to the repository maintainers via the contact information in the repository.

### What to Include

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (optional)

### Response Timeline

- **Initial Response**: Within 48 hours of receiving the report
- **Status Update**: Within 7 days with assessment and remediation plan
- **Resolution**: Security patches prioritized based on severity

### What to Expect

- We will acknowledge receipt of your report
- We will investigate and validate the issue
- We will work on a fix and coordinate disclosure timing with you
- We will credit you in the security advisory (unless you prefer anonymity)

## Security Measures

This project implements the following security measures:

- **Automated Dependency Scanning**: Dependabot monitors for vulnerable dependencies
- **CI Security Audits**: npm audit runs in CI pipeline to catch vulnerabilities
- **Regular Updates**: Dependencies are kept up-to-date via automated PRs

## Scope

This security policy applies to the main repository. Third-party dependencies are subject to their own security policies.
