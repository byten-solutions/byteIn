# Feature Branching Protocol

When working on any special section, new feature, or major module in byteInn:

1. **Create Feature Branch**:
   - Always branch off `main` before writing code:
     ```bash
     git checkout main
     git pull origin main
     git checkout -b feature/<feature-name>
     ```
2. **Develop & Commit on Feature Branch**:
   - Make all changes, write tests, and commit progress on the feature branch.
3. **Verify All Quality Gates**:
   - Run `npm run validate` and `npm run build` on the branch.
4. **Request Merge Approval**:
   - Once all work is verified on the branch, stop and ask the user explicitly whether they want to merge the feature branch into `main`.
   - Do NOT merge to `main` without explicit confirmation.
