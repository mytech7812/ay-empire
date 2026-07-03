// ===== CONTACT PAGE JAVASCRIPT =====

const contactForm = document.getElementById('contact-form');
const submitBtn = document.getElementById('contact-submit-btn');
const statusDiv = document.getElementById('contact-status');

contactForm.addEventListener('submit', async function(e) {
  e.preventDefault();

  const name = document.getElementById('contact-name').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const subject = document.getElementById('contact-subject').value.trim() || 'Contact Form Inquiry';
  const message = document.getElementById('contact-message').value.trim();

  // Validate
  if (!name || !email || !message) {
    statusDiv.style.display = 'block';
    statusDiv.style.color = '#e74c3c';
    statusDiv.textContent = 'Please fill in all required fields.';
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    statusDiv.style.display = 'block';
    statusDiv.style.color = '#e74c3c';
    statusDiv.textContent = 'Please enter a valid email address.';
    return;
  }

  // Disable button
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  statusDiv.style.display = 'none';

  try {
    const supabaseProjectId = 'iirctokpamybsmgzstnj';
    const functionUrl = `https://${supabaseProjectId}.supabase.co/functions/v1/send-contact-email`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        subject,
        message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send message.');
    }

    // ===== STYLED SUCCESS MESSAGE =====
    statusDiv.style.display = 'block';
    statusDiv.style.color = 'var(--gold-dark)';
    statusDiv.style.background = 'rgba(201, 168, 76, 0.08)';
    statusDiv.style.border = '1px solid var(--gold)';
    statusDiv.style.borderRadius = '4px';
    statusDiv.style.padding = '1rem 1.2rem';
    statusDiv.style.fontSize = '0.95rem';
    statusDiv.style.textAlign = 'center';
    statusDiv.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 32px; height: 32px; margin: 0 auto 0.5rem; display: block; stroke: var(--gold);">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <div style="font-weight: 600; color: var(--brown); margin-bottom: 0.2rem;">Message Sent Successfully!</div>
      <p style="font-size: 0.85rem; color: var(--text-mid); margin: 0;">We've received your message and will get back to you shortly.</p>
    `;
    contactForm.reset();

  } catch (error) {
    console.error('Contact form error:', error);
    statusDiv.style.display = 'block';
    statusDiv.style.color = '#e74c3c';
    statusDiv.style.background = 'rgba(231, 76, 60, 0.08)';
    statusDiv.style.border = '1px solid #e74c3c';
    statusDiv.style.borderRadius = '4px';
    statusDiv.style.padding = '1rem 1.2rem';
    statusDiv.style.fontSize = '0.95rem';
    statusDiv.style.textAlign = 'center';
    statusDiv.innerHTML = `
      <div style="font-weight: 600; color: #e74c3c; margin-bottom: 0.2rem;">Something Went Wrong</div>
      <p style="font-size: 0.85rem; color: var(--text-mid); margin: 0;">Failed to send message. Please try again or email us directly at <a href="mailto:info@ayempire.com" style="color: var(--gold); text-decoration: underline;">info@ayempire.com</a></p>
    `;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Message';
  }
});