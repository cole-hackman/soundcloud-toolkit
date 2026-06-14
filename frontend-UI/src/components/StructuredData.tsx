// JSON-LD Structured Data for SEO
// This component injects schema.org structured data into the page
import {
  getFaqSchema,
  getOrganizationSchema,
  getSoftwareApplicationSchema,
  getWebsiteSchema,
} from "@/lib/seo/schema";

export interface FAQ {
  question: string;
  answer: string;
}

interface StructuredDataProps {
  faqs?: FAQ[];
}

export function StructuredData({ faqs = [] }: StructuredDataProps) {
  const schemas = [
    getOrganizationSchema(),
    getSoftwareApplicationSchema(),
    getWebsiteSchema(),
    getFaqSchema(faqs),
  ].filter(Boolean);

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema),
          }}
        />
      ))}
    </>
  );
}

export default StructuredData;
