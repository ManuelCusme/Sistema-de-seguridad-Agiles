# Contributing Guide

Thanks for contributing to Sistema de Seguridad UTA. This document summarizes the expected workflow for backend, web panel, and mobile app changes.

## Workflow

1. Create a short and descriptive branch from the main branch.
   - Examples: `feature/login-admin`, `fix/signalr-reconnect`, `docs/readme-update`.
2. Keep changes focused on a single task per branch.
3. Run the relevant checks before opening a pull request.
4. Clearly describe the problem, the solution, and the impact in the PR.

## Code Style

- Backend .NET:
  - Follow the existing style in `Program.cs`, controllers, and services.
  - Use descriptive names and explicit input validation.
  - Prefer `async` and `await` when the flow touches database or network code.
  - Do not break the routes or JSON contracts used by the web panel or mobile app.
- React web panel:
  - Keep components functional and props clear.
  - Respect the existing palette, typography, and visual structure.
  - Do not change endpoints or storage keys without checking the rest of the system.
- React Native mobile app:
  - Keep Expo compatibility.
  - Verify the local IP configuration when changing backend calls.

## Minimum Checks

Before sending a PR, run the checks that apply to your change:

- Backend: `dotnet test tests/UtaSecurity.Services.Incidents.Tests/UtaSecurity.Services.Incidents.Tests.csproj`
- Web panel: `cd AdminWeb && npm run lint && npm run build`
- Mobile app: `cd Frontend && npm test`

If your change touches networking or SignalR, also verify the connection between the gateway, the web panel, and the mobile app.

## Pull Requests

Include the following:

- Short summary of the change.
- Test evidence or screenshots if the UI changes.
- Notes about migrations, endpoints, or contract changes if applicable.
- Reference to the related issue, task, or sprint.

## Good Practices

- Do not upload secrets, private keys, or real credentials.
- Do not change ports or base URLs without documenting it.
- Avoid mixing large refactors with functional fixes in the same PR.
- If a change breaks compatibility, state it clearly.