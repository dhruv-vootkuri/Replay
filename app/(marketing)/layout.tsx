import Header from "@/app/components/Header";

// Footer is rendered inside WaitlistForm (the last section of Landing),
// not here — it needs to share that section's relatively-positioned
// container so the atmospheric video can span behind it too.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
    </>
  );
}
