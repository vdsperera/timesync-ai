# Changelog
All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed
- Hardcoded fallback values for `Main Type` in Notion category fetcher to explicitly use user-provided list: `ATGO`, `FINGO`, `FAMGO`, `PHYGO`, `EDGO`, `PLEAGO`, `CARGO`.
- Injected semantic definitions for all `Main Type` acronyms into the Gemini system prompt to ensure highly accurate categorization.
- Added a comprehensive list of fallback Sub Types for all categories (`ATGO`, `FINGO`, etc.) and injected their definitions into the Gemini prompt for high accuracy.
- Updated the Web UI to dynamically filter the `Sub Type` dropdown based on the selected `Main Type` in the row.
- Updated AI prompt to extract dates directly from log entries and format them as `YYYY-MM-DD`.
- Implemented `localStorage` auto-drafting in the Web UI to persist manual edits before syncing.
- Fixed a Notion sync bug (`502 Bad Gateway`) by correcting the exact case-sensitive column name for `"Regular hours"`.
- Added a `Delete` button to each row in the interactive table so users can easily remove individual entries before syncing.
- Added a full **Draft Library** system allowing users to manually save un-synced tables by date, load them later from the home screen, and manage them cleanly.
- Added an **"Auto-cleanup on sync"** toggle switch so users can choose whether drafts are automatically removed after syncing.
- Implemented a **"Daily Overwrite Sync Strategy"**; the backend now automatically finds all existing Notion entries for the incoming dates and permanently archives them *before* syncing new entries to entirely prevent duplicates.

## [1.0.0] - 2026-08-18

### Added
- Express backend for secure API proxying and key management (TASK-001)
- `/api/categories` endpoint to dynamically fetch Notion schema (TASK-003)
- `/api/parse` endpoint to categorize raw text using Gemini AI (TASK-004)
- `/api/sync` endpoint with partial failure handling for Notion API (TASK-005)
- Vanilla JS Frontend with a premium dark-mode aesthetic (TASK-006)
- Interactive review table to validate and modify AI suggestions (TASK-007)
- Robust error handling and DOM sanitization for AI outputs (TASK-008)
- Automated API test suite using Jest and Supertest

### Security
- Masked raw SDK `error.message` from API responses (SEC-001)
- Implemented payload length validation (Max 50) for batch API endpoints
