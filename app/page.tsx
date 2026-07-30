import { LdzHeader } from "@/components/ldz/LdzHeader";
import { LdzFooter } from "@/components/ldz/LdzFooter";
import { AvatarExperience } from "@/components/ldz/AvatarExperience";
import { ExternalCtaSection } from "@/components/ldz/ExternalCtaSection";

export default function HomePage() {
  return (
    <div className="ldz-shell">
      <LdzHeader />
      <main id="main" className="ldz-main">
        <AvatarExperience />
        <ExternalCtaSection />
      </main>
      <LdzFooter />
    </div>
  );
}
