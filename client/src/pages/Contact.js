import React, { useState } from 'react';

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      window.alert('Thanks for your feedback! We will get back to you soon.');
      setForm({ name: '', email: '', message: '' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Contact Us</h1>
        <p className="text-gray-600">Send feedback or reach support</p>
      </div>

      <form className="card space-y-4" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={form.name} onChange={(e) => handleChange('name', e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">Message</label>
          <textarea className="form-textarea" rows="4" value={form.message} onChange={(e) => handleChange('message', e.target.value)} required />
        </div>
        <div className="text-right">
          <button className="btn btn-primary" type="submit" disabled={sending}>
            {sending ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Contact;


