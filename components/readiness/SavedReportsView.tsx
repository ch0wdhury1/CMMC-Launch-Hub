import React, { useState, useEffect } from 'react';
import { SavedReport } from '../../types';
import { SAVED_REPORTS_KEY } from '../../constants';
import { Archive, Calendar, FileText, Percent, Eye } from 'lucide-react';

interface SavedReportsViewProps {
  savedReports: SavedReport[];
}

export const SavedReportsView: React.FC<SavedReportsViewProps> = ({ savedReports: initialReports }) => {
  const [savedReports, setSavedReports] = useState<SavedReport[]>(initialReports || []);

  useEffect(() => {
    try {
      const storedReports = localStorage.getItem(SAVED_REPORTS_KEY);
      if (storedReports) {
        // Sort by most recent first
        const reports = JSON.parse(storedReports) as SavedReport[];
        reports.sort((a, b) => new Date(b.dateGenerated).getTime() - new Date(a.dateGenerated).getTime());
        setSavedReports(reports);
      }
    } catch (error) {
      console.error('Failed to load saved reports:', error);
    }
  }, []);
  
  const handleViewPdf = (pdfDataURL: string) => {
    const newWindow = window.open();
    if (newWindow) {
        newWindow.document.write(`<iframe src="${pdfDataURL}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    } else {
        alert('Please allow pop-ups for this site to view the PDF.');
    }
  };

  return (
    <div className="animate-fadeIn space-y-8">
      {savedReports.length === 0 ? (
        <div className="text-center bg-white p-10 rounded-xl shadow-md border border-gray-200 max-w-2xl mx-auto">
          <Archive className="mx-auto h-14 w-14 text-gray-400" />
          <h2 className="mt-4 text-2xl font-bold text-gray-800">No Saved Reports Yet</h2>
          <p className="mt-3 text-gray-600">
            Generate a report using the "Security Analyzer" and click "Save Report" to store it here for future reference.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-700">PDF Reports:</h2>
          {savedReports.map(report => (
            <div key={report.id} className="bg-white p-4 rounded-lg shadow-md border flex flex-col sm:flex-row justify-between sm:items-center">
              <div className="flex-1 mb-3 sm:mb-0">
                <div className="flex items-center text-gray-700 font-semibold mb-2">
                    <Calendar className="h-4 w-4 mr-2 text-blue-600"/>
                    Date Generated: {new Date(report.dateGenerated).toLocaleString()}
                </div>
                 <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                    <div className="flex items-center">
                        <Percent className="h-4 w-4 mr-2 text-green-600"/>
                        Readiness Score: <span className="font-bold ml-1">{report.readinessScore}%</span>
                    </div>
                    <div className="flex items-center">
                        <Percent className="h-4 w-4 mr-2 text-yellow-600"/>
                        Compliance Score: <span className="font-bold ml-1">{report.complianceScore}%</span>
                    </div>
                </div>
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={() => handleViewPdf(report.pdfDataURL)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Eye className="h-4 w-4 mr-2"/>
                  View PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
