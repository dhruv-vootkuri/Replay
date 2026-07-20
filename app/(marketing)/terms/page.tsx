import LegalDoc from "@/app/components/LegalDoc";

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated="July 2026"
      sections={[
        {
          heading: "Acceptance of Terms",
          body: [
            "By accessing this website or joining the Floe early access waitlist, you agree to these Terms of Service. If you don't agree, please don't use the site.",
          ],
        },
        {
          heading: "Description of Service",
          body: [
            "Floe is an early-access developer tool for tracing, replaying, and diffing AI agent runs. This website is used to introduce the product and collect signups for early access.",
          ],
        },
        {
          heading: "Early Access / Beta",
          body: [
            "Floe is currently in early access. Features, behavior, and availability may change significantly, without notice, before general availability.",
          ],
        },
        {
          heading: "Acceptable Use",
          body: [
            "You agree not to misuse this site — including attempting to interfere with its normal operation, scraping it at scale, or using it for any unlawful purpose.",
          ],
        },
        {
          heading: "Intellectual Property",
          body: [
            "All content on this site, including the Floe name, logo, and product screenshots, belongs to Floe or its licensors and may not be used without permission.",
          ],
        },
        {
          heading: "Disclaimer of Warranties",
          body: [
            "This site and any early-access product are provided “as is,” without warranties of any kind, express or implied, including fitness for a particular purpose.",
          ],
        },
        {
          heading: "Limitation of Liability",
          body: [
            "To the fullest extent permitted by law, Floe is not liable for any indirect, incidental, or consequential damages arising from your use of this site or any early-access product.",
          ],
        },
        {
          heading: "Termination",
          body: [
            "We may suspend or end early access to the product for any user at any time, for any reason, including misuse of the service.",
          ],
        },
        {
          heading: "Governing Law",
          body: [
            "These terms are governed by the laws of the jurisdiction in which Floe operates, without regard to conflict-of-law principles.",
          ],
        },
        {
          heading: "Changes to These Terms",
          body: [
            "We may update these terms from time to time. Continued use of the site after changes means you accept the updated terms.",
          ],
        },
        {
          heading: "Contact",
          body: ["Questions about these terms can be sent to hello@floe.dev."],
        },
      ]}
    />
  );
}
