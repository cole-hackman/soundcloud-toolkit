import type { FAQ } from "@/components/StructuredData";

const siteUrl = "https://www.soundcloudtoolkit.com";

export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SC Toolkit",
    url: siteUrl,
    logo: `${siteUrl}/SC%20Toolkit%20Icon.png`,
    description:
      "SC Toolkit helps SoundCloud power users organize, merge, and clean playlists.",
  };
}

export function getSoftwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SC Toolkit",
    applicationCategory: "MusicApplication",
    operatingSystem: "Web",
    description:
      "Powerful playlist management tools for SoundCloud. Merge playlists, remove duplicates, organize tracks, and more.",
    url: siteUrl,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

export function getWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "SC Toolkit",
    url: siteUrl,
    description:
      "SC Toolkit helps SoundCloud power users organize, merge, and clean playlists. Remove duplicates, manage tracks, and build better playlists faster.",
  };
}

export function getFaqSchema(faqs: FAQ[]) {
  if (faqs.length === 0) return null;

  return {
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
  };
}
