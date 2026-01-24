'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState } from 'react';

export default function Home() {
  const [subscribers, setSubscribers] = useState(480);
  const [price, setPrice] = useState('29.99');

  const calculateEarnings = () => {
    const earnings = subscribers * parseFloat(price || '0');
    return earnings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <>
      {/* Pendulum */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          right: '10%',
          width: '3px',
          height: '500px',
          backgroundColor: 'black',
          transformOrigin: 'top center',
          zIndex: 50,
        }}
        animate={{
          rotate: [0, 20, 0, -20, 0],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: [0.45, 0.05, 0.55, 0.95],
        }}
      >
        <motion.div
          style={{
            position: 'absolute',
            bottom: -70,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            backgroundColor: 'white',
            border: '6px solid black',
            boxShadow: '0 15px 40px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img 
            src="/discortize-logo.png" 
            alt="Discortize" 
            width="110"
            height="110"
            style={{
              width: '110px',
              height: 'auto',
              objectFit: 'contain',
            }}
          />
        </motion.div>
      </motion.div>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Discortize',
            applicationCategory: 'BusinessApplication',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            description: 'Launch paid Discord communities, manage subscriptions, automate access, accept payments, and grow recurring revenue.',
            url: 'https://discortize.com',
            screenshot: 'https://discortize.com/og-image.png',
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.8',
              ratingCount: '120',
            },
          }),
        }}
      />

      {/* Header */}
      <header className="header">
        <div className="container">
          <nav className="nav">
            <a href="#" className="logo">
              <img src="/discortize-logo.png" alt="Discortize" className="logo-img" />
            </a>
            <ul className="nav-links">
              <li><a href="#features" className="nav-link">Features</a></li>
              <li><a href="#pricing" className="nav-link">Pricing</a></li>
              <li><a href="/blogs" className="nav-link">Blog</a></li>
              <li><a href="#" className="nav-link">About</a></li>
            </ul>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <a href="/login" className="nav-login">Login</a>
              <a href="/signup" className="nav-cta">Start Free →</a>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <h1 className="headline">
            Monetize your <span className="black-bg">Discord</span><br />
            community <span className="black-bg">in seconds</span>
          </h1>
          <p className="subline">
            <span className="bold">Launch paid communities</span> on Discord, manage <span className="bold">subscriptions</span>,<br className="desktop-br" />
            <span className="bold">automate access</span>, accept payments, and grow recurring revenue.
          </p>

          <div className="input-container">
            <label htmlFor="server-name" className="input-prefix">discortize.com/</label>
            <input 
              id="server-name"
              type="text" 
              className="input-field" 
              placeholder="yourname"
              aria-label="Your server name"
            />
            <button className="cta-btn">Get Started — it&apos;s free</button>
          </div>

          <div className="metrics-container">
            <div className="metrics">💪  Automate your discord with crypto</div>
            <div className="circles">
              <div className="circle"></div>
              <div className="circle"></div>
              <div className="circle"></div>
              <div className="circle"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="integrations-section">
        <div className="container">
          <h2 className="integrations-title">Works with your favorite platforms</h2>
          <div className="integrations-grid">
            <div className="integration-logo">Discord</div>
            <div className="integration-logo">Stripe</div>
            <div className="integration-logo">PayPal</div>
            <div className="integration-logo">Telegram</div>
            <div className="integration-logo">WhatsApp</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <motion.h2 
            className="section-title"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            Everything you need to monetize
          </motion.h2>
          <div className="features-grid">
            {[
              {
                number: '01',
                title: 'Easy Payments',
                desc: 'Accept credit cards, PayPal, and crypto. Get paid instantly with secure payment processing.'
              },
              {
                number: '02',
                title: 'Auto Access Control',
                desc: 'Automatically grant and revoke Discord roles based on subscription status. Zero manual work.'
              },
              {
                number: '03',
                title: 'Analytics Dashboard',
                desc: 'Track revenue, member growth, and engagement with beautiful real-time analytics.'
              },
              {
                number: '04',
                title: 'Custom Landing Pages',
                desc: 'Create stunning sales pages that convert visitors into paying members.'
              },
              {
                number: '05',
                title: 'Email Automation',
                desc: 'Send welcome emails, renewal reminders, and marketing campaigns automatically.'
              },
              {
                number: '06',
                title: 'Affiliate Program',
                desc: 'Let your members promote your community and earn commissions on referrals.'
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                className="feature-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: "easeOut"
                }}
                whileHover={{ 
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
                drag
                dragConstraints={{ top: -400, left: -400, right: 400, bottom: 400 }}
                dragElastic={0}
                dragTransition={{ power: 0.3, timeConstant: 200 }}
                dragMomentum={true}
                whileDrag={{ 
                  scale: 1.05,
                  rotate: 2,
                  cursor: "grabbing",
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)"
                }}
                viewport={{ once: true, margin: "-50px" }}
                style={{ cursor: "grab" }}
              >
                <motion.div 
                  className="feature-number"
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ 
                    duration: 0.4,
                    delay: index * 0.1 + 0.2
                  }}
                  viewport={{ once: true }}
                >
                  {feature.number}
                </motion.div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-desc">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Calculator Section */}
      <section className="calculator-section" id="calculator_id">
        <div className="calculator-container" id="calculator_id">
          <div className="calculator-subtitle">You could be earning</div>
          <div className="calculator-value">
            <span className="calculator-amount">${calculateEarnings()}</span>
            <span className="calculator-suffix">/ per month.</span>
          </div>
          <div className="calculator-row-subtitle">
            <div className="calculator-row-input">
              <span>With</span>
              <span className="calculator-highlight" style={{ backgroundColor: '#B76FFF', color: '#000000' }}>{subscribers}</span>
              <span>subscribers at</span>
              <div className="calculator-input-wrapper">
                <span className="calculator-prefix">$</span>
                <input
                  spellCheck="false"
                  type="text"
                  placeholder="0.00"
                  autoComplete="off"
                  className="calculator-input"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="select-background-dropdown" style={{ pointerEvents: 'none' }}></div>
              <div className="select-container">
                <div className="select-button">
                  <span className="select-button-text">Monthly<span></span></span>
                </div>
              </div>
              <div className="select-background-dropdown" style={{ pointerEvents: 'none' }}></div>
              <div className="select-container">
                <div className="select-button">
                  <span className="select-button-text">Free plan<span></span></span>
                </div>
              </div>
            </div>
          </div>
          <div className="slider-maxi-container">
            <div className="slider-container">
              <div className="slider-background-progress"></div>
              <div 
                className="slider-fill" 
                style={{ width: `${(subscribers / 6000) * 100}%`, backgroundColor: '#B76FFF' }}
              ></div>
              <input
                type="range"
                min="0"
                max="6000"
                value={subscribers}
                onChange={(e) => setSubscribers(parseInt(e.target.value))}
                className="slider-thumb"
              />
              <div 
                className="slider-info" 
                style={{ 
                  display: 'block', 
                  left: `calc(${(subscribers / 6000) * 100}% - 35px)`, 
                  backgroundColor: '#B76FFF', 
                  color: 'black' 
                }}
              >
                {subscribers}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="pricing-section">
        <div className="container">
          <h2 className="section-title">Simple, transparent pricing</h2>
          <p className="section-subtitle">Start for free. Pay as you grow.</p>

          <div className="pricing-grid">
            <div className="pricing-col">
              <div className="pricing-header">
                <div className="plan-name">Starter</div>
                <div className="plan-about">Perfect for getting started</div>
              </div>
              <div className="plan-price">
                <span className="price-amount">$0</span>
                <span className="price-suffix">/month</span>
              </div>
              <button className="plan-cta">Get Started</button>
              <div className="plan-features">
                <div className="plan-feature">Up to 100 members</div>
                <div className="plan-feature">Basic analytics</div>
                <div className="plan-feature">Discord integration</div>
                <div className="plan-feature">5% transaction fee</div>
              </div>
            </div>

            <div className="pricing-col popular">
              <div className="popular-tag">Most Popular</div>
              <div className="pricing-header">
                <div className="plan-name">Pro</div>
                <div className="plan-about">For growing communities</div>
              </div>
              <div className="plan-price">
                <span className="price-amount">$29</span>
                <span className="price-suffix">/month</span>
              </div>
              <button className="plan-cta active">Start Free Trial</button>
              <div className="plan-features">
                <div className="plan-feature">Unlimited members</div>
                <div className="plan-feature">Advanced analytics</div>
                <div className="plan-feature">Custom landing pages</div>
                <div className="plan-feature">Email automation</div>
                <div className="plan-feature">Affiliate program</div>
                <div className="plan-feature">2% transaction fee</div>
              </div>
            </div>

            <div className="pricing-col">
              <div className="pricing-header">
                <div className="plan-name">Enterprise</div>
                <div className="plan-about">For large operations</div>
              </div>
              <div className="plan-price">
                <span className="price-amount">Custom</span>
              </div>
              <button className="plan-cta">Contact Sales</button>
              <div className="plan-features">
                <div className="plan-feature">Everything in Pro</div>
                <div className="plan-feature">Dedicated support</div>
                <div className="plan-feature">Custom integrations</div>
                <div className="plan-feature">SLA guarantee</div>
                <div className="plan-feature">0% transaction fee</div>
              </div>
            </div>
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
              <a href="#" className="footer-link">Features</a>
              <a href="#" className="footer-link">Pricing</a>
              <a href="#" className="footer-link">About</a>
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
