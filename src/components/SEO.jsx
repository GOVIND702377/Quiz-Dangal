import React from 'react';
import { Helmet } from 'react-helmet-async';

/**
 * SEO component
 * Props:
 * - title: string (required)
 * - description: string
 * - canonical: absolute URL (preferred)
 * - robots: e.g. "index, follow" or "noindex, nofollow"
 * - image: absolute URL for og:image/twitter:image
 * - type: og:type (website/article/profile etc)
 * - keywords: string[] list – optional (search engines mostly ignore but useful for some engines)
 */
export default function SEO({
  title = 'Quiz Dangal',
  description = 'Play opinion-based quizzes, refer & earn, and win rewards on Quiz Dangal.',
  canonical = 'https://quizdangal.com/',
  robots = 'index, follow',
  image = 'https://quizdangal.com/refer-earn-poster.png?v=1',
  type = 'website',
  keywords = [],
}) {
  const keywordsContent = Array.isArray(keywords) && keywords.length
    ? keywords.join(', ')
    : undefined;

  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {keywordsContent && <meta name="keywords" content={keywordsContent} />}
      {canonical && <link rel="canonical" href={canonical} />}
      {robots && <meta name="robots" content={robots} />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Quiz Dangal" />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      {canonical && <meta property="og:url" content={canonical} />} 
      {image && <meta property="og:image" content={image} />} 
      {image && <meta property="og:image:secure_url" content={image} />} 
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}
    </Helmet>
  );
}
