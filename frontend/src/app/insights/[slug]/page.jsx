import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import { normalizeArticle } from "@/lib/dataSource";
import { formatDate } from "@/lib/format";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";

// Rendered on demand so publishing or editing in the admin shows up immediately.
export const dynamic = "force-dynamic";

async function getArticle(slug) {
  try {
    const { article } = await apiRequest(`/api/v1/articles/${encodeURIComponent(slug)}`, { cache: "no-store" });
    return normalizeArticle(article);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.excerpt,
  };
}

export default async function InsightArticlePage({ params }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  return (
    <PageShell>
      <article className="py-8 sm:py-12">
        <Container className="max-w-3xl">
          <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
            <Link href="/#insights" className="hover:text-primary">
              Insights
            </Link>{" "}
            / <span className="text-text">{article.title}</span>
          </nav>

          <p className="mt-4 text-sm text-text-muted">{formatDate(article.publishedAt)}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{article.title}</h1>
          <p className="mt-3 text-lg text-text-muted">{article.excerpt}</p>

          <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-2xl bg-bg">
            <Image
              src={article.image.src}
              alt={article.image.alt}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              priority
              className="object-cover"
            />
          </div>

          <div className="mt-8 flex flex-col gap-4 text-base leading-relaxed text-text">
            {(article.content || article.excerpt)
              .split(/\n{2,}/)
              .filter(Boolean)
              .map((paragraph, i) => (
                <p key={i} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            <p>
              Have a question this article didn&apos;t answer? Visit the{" "}
              <Link href="/help" className="text-primary hover:underline">
                help centre
              </Link>{" "}
              or{" "}
              <Link href="/contact" className="text-primary hover:underline">
                contact us
              </Link>
              .
            </p>
          </div>
        </Container>
      </article>
    </PageShell>
  );
}
