import React from 'react';
import { notFound } from 'next/navigation';
import { getBlogPost, getAllBlogPosts } from '@/lib/blogData';

// This generates static params for all blog posts
export function generateStaticParams() {
  const posts = getAllBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  // Convert markdown-style content to JSX
  const renderContent = (content: string) => {
    const lines = content.trim().split('\n');
    const elements: React.ReactElement[] = [];
    let key = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // H2
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={key++} style={{
            fontSize: '32px',
            fontWeight: 650,
            color: 'var(--color-black)',
            marginTop: '48px',
            marginBottom: '20px',
            lineHeight: 1.2
          }}>
            {line.replace('## ', '')}
          </h2>
        );
      }
      // H3
      else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={key++} style={{
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--color-black)',
            marginTop: '36px',
            marginBottom: '16px',
            lineHeight: 1.3
          }}>
            {line.replace('### ', '')}
          </h3>
        );
      }
      // Unordered list item
      else if (line.startsWith('- ')) {
        const listItems = [line];
        while (i + 1 < lines.length && lines[i + 1].startsWith('- ')) {
          i++;
          listItems.push(lines[i]);
        }
        elements.push(
          <ul key={key++} style={{
            listStyle: 'none',
            marginBottom: '24px',
            paddingLeft: 0
          }}>
            {listItems.map((item, idx) => {
              const text = item.replace('- ', '');
              // Handle bold **text**
              const parts = text.split(/(\*\*.*?\*\*)/g);
              return (
                <li key={idx} style={{
                  fontSize: '17px',
                  lineHeight: 1.7,
                  color: 'var(--color-gray-700)',
                  marginBottom: '12px',
                  paddingLeft: '28px',
                  position: 'relative'
                }}>
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    color: 'var(--color-black)',
                    fontWeight: 600
                  }}>•</span>
                  {parts.map((part, partIdx) => 
                    part.startsWith('**') && part.endsWith('**') ? (
                      <strong key={partIdx} style={{ fontWeight: 600, color: 'var(--color-black)' }}>
                        {part.slice(2, -2)}
                      </strong>
                    ) : (
                      part
                    )
                  )}
                </li>
              );
            })}
          </ul>
        );
      }
      // Paragraph with potential formatting
      else if (line.trim() !== '') {
        // Handle links [text](url)
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = linkRegex.exec(line)) !== null) {
          // Add text before link
          if (match.index > lastIndex) {
            const textBefore = line.substring(lastIndex, match.index);
            // Handle bold in text
            const boldParts = textBefore.split(/(\*\*.*?\*\*)/g);
            boldParts.forEach((part, idx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                parts.push(
                  <strong key={`${key}-${idx}`} style={{ fontWeight: 600, color: 'var(--color-black)' }}>
                    {part.slice(2, -2)}
                  </strong>
                );
              } else if (part) {
                parts.push(part);
              }
            });
          }
          // Add link
          parts.push(
            <a 
              key={`${key}-link-${match.index}`} 
              href={match[2]}
              className="blog-content-link"
            >
              {match[1]}
            </a>
          );
          lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < line.length) {
          const remainingText = line.substring(lastIndex);
          const boldParts = remainingText.split(/(\*\*.*?\*\*)/g);
          boldParts.forEach((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              parts.push(
                <strong key={`${key}-end-${idx}`} style={{ fontWeight: 600, color: 'var(--color-black)' }}>
                  {part.slice(2, -2)}
                </strong>
              );
            } else if (part) {
              parts.push(part);
            }
          });
        }

        // Determine if it's a special callout (starts with emoji or has arrow)
        if (line.includes('💡') || line.includes('👉') || line.includes('✅') || line.includes('❌')) {
          elements.push(
            <div key={key++} style={{
              backgroundColor: 'var(--color-gray-50)',
              borderLeft: '4px solid var(--color-black)',
              padding: '20px 24px',
              marginBottom: '28px',
              borderRadius: 'var(--radius-md)',
              fontSize: '17px',
              lineHeight: 1.7,
              color: 'var(--color-gray-800)'
            }}>
              {parts.length > 0 ? parts : line}
            </div>
          );
        } else {
          elements.push(
            <p key={key++} style={{
              fontSize: '17px',
              lineHeight: 1.7,
              color: 'var(--color-gray-700)',
              marginBottom: '24px'
            }}>
              {parts.length > 0 ? parts : line}
            </p>
          );
        }
      }
    }

    return elements;
  };

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="container">
          <nav className="nav">
            <a href="/" className="logo">
              <img src="/discortize-logo.png" alt="Discortize" className="logo-img" />
            </a>
            <ul className="nav-links">
              <li><a href="/" className="nav-link">Home</a></li>
              <li><a href="/blogs" className="nav-link" style={{ color: 'var(--color-black)', fontWeight: 600 }}>Blog</a></li>
            </ul>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <a href="/login" className="nav-login">Login</a>
              <a href="/signup" className="nav-cta">Get Started</a>
            </div>
          </nav>
        </div>
      </header>

      {/* Article */}
      <article style={{ maxWidth: '800px', margin: '0 auto', padding: '80px 24px 100px' }}>
        <div>
          {/* Back to Blog */}
          <a 
            href="/blogs"
            className="blog-back-link"
          >
            ← Back to Blog
          </a>

          {/* Meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '6px 14px',
              backgroundColor: 'var(--color-black)',
              color: 'white',
              borderRadius: 'var(--radius-full)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {post.category}
            </span>
            <span style={{ fontSize: '14px', color: 'var(--color-gray-500)' }}>
              {post.date}
            </span>
            <span style={{ fontSize: '14px', color: 'var(--color-gray-400)' }}>•</span>
            <span style={{ fontSize: '14px', color: 'var(--color-gray-500)' }}>
              {post.readTime}
            </span>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: '48px',
            fontWeight: 650,
            color: 'var(--color-black)',
            marginBottom: '24px',
            lineHeight: 1.15,
            letterSpacing: '-0.02em'
          }}>
            {post.title}
          </h1>

          {/* Description */}
          <p style={{
            fontSize: '20px',
            lineHeight: 1.6,
            color: 'var(--color-gray-600)',
            marginBottom: '48px',
            fontWeight: 450
          }}>
            {post.description}
          </p>

          {/* Divider */}
          <div style={{
            height: '1px',
            backgroundColor: 'var(--color-gray-200)',
            marginBottom: '48px'
          }} />

          {/* Content */}
          <div>
            {renderContent(post.content)}
          </div>

          {/* CTA Box */}
          <div style={{
            marginTop: '64px',
            backgroundColor: 'var(--color-black)',
            color: 'white',
            borderRadius: 'var(--radius-2xl)',
            padding: '48px 40px',
            textAlign: 'center'
          }}>
            <h3 style={{
              fontSize: '28px',
              fontWeight: 650,
              marginBottom: '16px',
              color: 'white'
            }}>
              Ready to Launch Your Paid Discord?
            </h3>
            <p style={{
              fontSize: '17px',
              color: 'rgba(255, 255, 255, 0.8)',
              marginBottom: '28px',
              lineHeight: 1.6
            }}>
              Set up automated subscriptions and role management in minutes.
            </p>
            <a 
              href="/signup"
              className="blog-cta-button"
            >
              Get Started — It's Free
            </a>
          </div>
        </div>
      </article>

      {/* Footer */}
      <footer className="footer-section">
        <div className="container">
          <div className="footer-newsletter">
            <div className="newsletter-title">Stay up to date</div>
            <div className="newsletter-subtitle">Get updates on new features and tips to grow your community</div>
            <div className="newsletter-form">
              <input type="email" className="newsletter-input" placeholder="Enter your email" />
              <button className="newsletter-btn">Subscribe</button>
            </div>
            <div className="newsletter-compliance">We care about your data. Read our privacy policy.</div>
          </div>

          <div className="footer-line"></div>

          <div className="footer-bottom">
            <div className="footer-brand">
              <div className="footer-logo">
                <img src="/discortize-logo.png" alt="Discortize" className="footer-logo-img" />
              </div>
              <div className="footer-copyright">© 2026 Discortize. All rights reserved.</div>
            </div>
            <div className="footer-links">
              <a href="/" className="footer-link">Home</a>
              <a href="/#features" className="footer-link">Features</a>
              <a href="/#pricing" className="footer-link">Pricing</a>
              <a href="/blogs" className="footer-link">Blog</a>
              <a href="#" className="footer-link">Privacy</a>
              <a href="#" className="footer-link">Terms</a>
            </div>
            <div className="footer-socials">
              <a href="#" className="social-link">𝕏</a>
              <a href="#" className="social-link">💬</a>
              <a href="#" className="social-link">▶</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
