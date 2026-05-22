import { LatestNewsDashboard } from "@/components/latest-news-dashboard";
import { getNewsPreviews, type NewsPreviewArticle } from "@/lib/api";

export default async function LatestNewsPage() {
  let articles: NewsPreviewArticle[] = [];
  let error: string | null = null;

  try {
    articles = await getNewsPreviews("Business", 9);
    articles = [...articles].sort((left, right) => Number(Boolean(right.image_url)) - Number(Boolean(left.image_url)));
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load latest news.";
  }

  return <LatestNewsDashboard initialArticles={articles} initialError={error} />;
}
