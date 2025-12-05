import React, { useState } from 'react';
import axios from 'axios';

const Export = () => {
  const [downloading, setDownloading] = useState(false);

  const navTo = (url) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const id = prompt('Enter itinerary ID to export (e.g., 1)');
      if (!id) return;
      navTo(`/api/itineraries/${encodeURIComponent(id)}/export/pdf`);
    } finally {
      setDownloading(false);
    }
  };

  const downloadICal = async () => {
    setDownloading(true);
    try {
      const id = prompt('Enter itinerary ID to export (e.g., 1)');
      if (!id) return;
      navTo(`/api/itineraries/${encodeURIComponent(id)}/export/ical`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Export Itinerary</h1>
        <p className="text-gray-600">Download your trip as PDF or iCal, or share with friends</p>
      </div>

      <div className="card">
        <div className="space-y-4">
          <button className="btn btn-primary w-full" onClick={downloadPDF} disabled={downloading}>
            {downloading ? 'Processing...' : 'Download PDF'}
          </button>
          <button className="btn btn-secondary w-full" onClick={downloadICal} disabled={downloading}>
            {downloading ? 'Processing...' : 'Download iCal (.ics)'}
          </button>
          <button className="btn w-full" onClick={() => window.alert('Share link coming soon.')}>Share via Link</button>
        </div>
      </div>
    </div>
  );
};

export default Export;


