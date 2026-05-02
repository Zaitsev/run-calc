import { HelpLayout } from '../components/HelpLayout';

export function PrivacyPage() {
    return (
        <HelpLayout title="Privacy and Legal" subtitle="Policy links and data handling summary.">
            <section className="panel">
                <h2>Privacy Summary</h2>
                <ul>
                    <li>Run-Calc stores worksheet and settings data locally on your machine.</li>
                    <li>AI mode is opt-in and BYOK only. Your requests are sent to the provider you configure.</li>
                    <li>No bundled paid AI subscription or hidden backend proxy is included.</li>
                </ul>
            </section>

            <section className="panel">
                <h2>Legal Links</h2>
                <ul>
                    <li>Repository privacy policy file: PRIVACY_POLICY.md (available in the app repository root).</li>
                    <li><a href="https://github.com/Zaitsev/run-calc/blob/main/PRIVACY_POLICY.md">Privacy policy on GitHub</a>.</li>
                    <li><a href="https://github.com/Zaitsev/run-calc/blob/main/LICENSE">License</a>.</li>
                </ul>
            </section>
        </HelpLayout>
    );
}
