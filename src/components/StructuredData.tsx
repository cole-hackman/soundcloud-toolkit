// JSON-LD Structured Data for SEO
// Injects schema.org structured data into the page

export interface FAQ {
  question: string;
  answer: string;
}

interface StructuredDataProps {
  faqs?: FAQ[];
}

export function StructuredData({ faqs = [] }: StructuredDataProps) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SC Toolkit",
    url: "https://www.soundcloudtoolkit.com",
    logo: "https://www.soundcloudtoolkit.com/SC%20Toolkit%20Icon.png",
    description:
      "SC Toolkit helps SoundCloud power users organize, merge, and clean playlists.",
  };

  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SC Toolkit",
    applicationCategory: "MusicApplication",
    operatingSystem: "Web",
    description:
      "Powerful playlist management tools for SoundCloud. Merge playlists, remove duplicates, organize tracks, manage followers, and more.",
    url: "https://www.soundcloudtoolkit.com",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  const webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "SC Toolkit",
    url: "https://www.soundcloudtoolkit.com",
    description:
      "SC Toolkit helps SoundCloud power users organize, merge, and clean playlists. Manage followers, download tracks, and build better playlists faster.",
  };

  const faqSchema =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: faq.answer,
            },
          })),
        }
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webSiteSchema),
        }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqSchema),
          }}
        />
      )}
    </>
  );
}

export default StructuredData;
