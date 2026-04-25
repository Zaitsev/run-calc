# Privacy Policy

**Last updated:** 2026-04-25

Run-Calc is a privacy-focused, local-first desktop calculator application. We believe your data belongs to you, and our privacy policy reflects this "offline-first" philosophy. 

## 1. Summary
*   **No Accounts:** You do not need to create an account to use the app.
*   **Local Processing:** Calculations are performed exclusively on your own device.
*   **No Data Collection:** We do not operate any servers for this app. We do not collect, track, sell, or share your personal information, worksheet content, or usage habits.

## 2. Data Stored Locally
To provide core functionality, Run-Calc stores the following data **only on your local device**:
*   **Worksheet Content:** Your current and saved calculations and notes.
*   **User Preferences:** Theme settings, decimal delimiters, window behavior, and custom shortcuts.
*   **Security Credentials:** If you use AI features, your API keys are safely stored using your operating system's native secure storage (e.g., macOS Keychain, Windows Credential Manager, or Linux Secret Service).

## 3. Artificial Intelligence (BYOK)
Run-Calc includes optional AI-powered features. To use these, you must provide your own API key ("Bring Your Own Key" or BYOK) from a third-party provider (e.g., OpenAI, Anthropic).

*   **Transmission:** When you use AI features, your prompts are sent directly from your device to the AI provider. Run-Calc does not intercept, log, or "man-in-the-middle" this data.
*   **Storage:** Because we do not operate a backend, we never see or store your API keys. They remain strictly on your device.
*   **Third-Party Policies:** When using AI features, your data is subject to the privacy policy of the AI provider you have chosen. We encourage you to review their specific privacy terms.

## 4. Network Usage
Run-Calc does not communicate with any developer-operated backend services. Network activity is strictly limited to user-initiated actions and essential functional checks:
*   **AI Requests:** Occurs only if you have configured and actively use AI features.
*   **Theme Downloads:** If you choose to browse or download themes from within the app, it connects to the **Open VSX Registry**.
*   **Update Checks:** The app may periodically check our official GitHub repository to see if a new release is available.

## 5. Third-Party Services
The Run-Calc application itself contains no internal tracking code (e.g., no telemetry, Google Analytics, Sentry, or advertising SDKs). However, depending on how you use the app, it interacts with these third-party services:
*   **AI Providers:** (e.g., OpenAI, Anthropic) when utilizing AI features.
*   **Open VSX Registry:** When browsing or downloading themes, Open VSX may collect standard server logs (such as your IP address and request metadata) as governed by the [Eclipse Foundation Privacy Policy](https://www.eclipse.org/legal/privacy.php).

## 6. Security
We take the security of your local data seriously:
*   API keys are stored in OS-level secure vaults rather than plain text configuration files.
*   Because the app operates locally, the overall security of your data depends on the security practices of your personal device.

## 7. Data Retention and Deletion
You have complete control over your data. You can completely remove all your information by:
1.  Clearing your worksheets within the app.
2.  Removing your API key from the app's settings.
3.  Uninstalling the application and deleting the local application data folders created by your operating system.

## 8. Children’s Privacy
Run-Calc does not knowingly collect any personal information from anyone. Because no data is transmitted back to us, we have no ability to identify users, including children under 13.

## 9. Changes to This Policy
We may update this policy if we introduce new features that change how the app interacts with external services. The "Last updated" date at the top will always reflect the most recent changes.

## 10. Contact
If you have questions about this policy or the app's privacy practices, please open an issue on our official repository:
[https://github.com/Zaitsev/run-calc/issues](https://github.com/Zaitsev/run-calc/issues)