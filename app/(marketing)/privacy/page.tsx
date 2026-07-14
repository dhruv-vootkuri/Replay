import LegalDoc from "@/app/components/LegalDoc";

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="July 2026"
      sections={[
        {
          heading: "Overview",
          body: [
            "This policy explains what information Floe (“we,” “our,” “us”) collects when you use this website or join the early access waitlist, and how that information is used.",
          ],
        },
        {
          heading: "Information We Collect",
          body: [
            "Waitlist signups: when you submit the early access form, we collect the email address you provide.",
            "Usage data: like most websites, we may collect basic technical information such as browser type, device type, and pages visited, typically through standard server logs or analytics tooling.",
          ],
        },
        {
          heading: "How We Use Your Information",
          body: [
            "We use your email address to contact you about early access to Floe, product updates, and related announcements. We use aggregate usage data to understand how the site is used and to improve it.",
          ],
        },
        {
          heading: "Data Sharing",
          body: [
            "We do not sell your personal information. We may share data with service providers who help us operate the waitlist and this website (for example, hosting or email delivery providers), bound by obligations to protect your information.",
          ],
        },
        {
          heading: "Cookies",
          body: [
            "This site may use minimal, functional cookies necessary for the site to work correctly. We do not use third-party advertising cookies.",
          ],
        },
        {
          heading: "Data Retention",
          body: [
            "We retain waitlist email addresses for as long as necessary to fulfill the purpose they were collected for, or until you ask us to delete them.",
          ],
        },
        {
          heading: "Your Rights",
          body: [
            "You can ask us to access, correct, or delete the personal information we hold about you at any time by reaching out through the contact link below.",
          ],
        },
        {
          heading: "Security",
          body: [
            "We take reasonable technical and organizational measures to protect the information we collect, though no method of transmission or storage is ever 100% secure.",
          ],
        },
        {
          heading: "Changes to This Policy",
          body: [
            "We may update this policy from time to time. We'll update the “last updated” date above when we do.",
          ],
        },
        {
          heading: "Contact",
          body: ["Questions about this policy can be sent to hello@floe.dev."],
        },
      ]}
    />
  );
}
