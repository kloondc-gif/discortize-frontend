'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { getAllBlogPosts } from '@/lib/blogData';

const blogPosts = getAllBlogPosts();

export default function BlogsPage() {
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

      {/* Hero Section */}
      <section className="hero-section" style={{ paddingTop: '80px', paddingBottom: '60px' }}>
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ textAlign: 'center' }}
          >
            <h1 className="headline" style={{ marginBottom: '20px' }}>
              Discord Monetization <span className="black-bg">Blog</span>
            </h1>
            <p className="subline" style={{ maxWidth: '700px', margin: '0 auto' }}>
              Learn how to monetize your Discord community, build recurring revenue, and grow your subscription business.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Blog Grid */}
      <section style={{ padding: '60px 0 100px' }}>
        <div className="container">
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
            gap: '32px',
            maxWidth: '1100px',
            margin: '0 auto'
          }}>
            {blogPosts.map((post, index) => (
              <motion.article
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                style={{
                  border: '1px solid var(--color-gray-200)',
                  borderRadius: 'var(--radius-2xl)',
                  padding: '32px',
                  backgroundColor: 'white',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}
                whileHover={{ 
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
                  transform: 'translateY(-4px)'
                }}
              >
                <Link href={`/blogs/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
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
                    <span style={{ fontSize: '13px', color: 'var(--color-gray-500)' }}>
                      {post.readTime}
                    </span>
                  </div>
                  
                  <h2 style={{ 
                    fontSize: '22px', 
                    fontWeight: 650,
                    lineHeight: 1.3,
                    color: 'var(--color-black)', 
                    marginBottom: '16px'
                  }}>
                    {post.title}
                  </h2>
                  
                  <p style={{ 
                    fontSize: '15px',
                    lineHeight: 1.6,
                    color: 'var(--color-gray-600)', 
                    marginBottom: '24px',
                    flex: 1
                  }}>
                    {post.description}
                  </p>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    paddingTop: '20px',
                    borderTop: '1px solid var(--color-gray-100)'
                  }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-gray-500)' }}>
                      {post.date}
                    </span>
                    <span style={{ 
                      fontSize: '14px',
                      color: 'var(--color-black)', 
                      fontWeight: 550,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      Read more →
                    </span>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

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
