
import React from 'react';
import { X, ShieldCheck, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, onUpgrade }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] animate-fadeIn" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100" 
        onClick={e => e.stopPropagation()}
      >
        <header className="bg-blue-800 p-8 text-white relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-blue-200 hover:text-white transition-colors">
                <X size={24} />
            </button>
            <div className="flex items-center space-x-4 mb-4">
                <div className="bg-blue-600 p-3 rounded-xl">
                    <ShieldCheck className="h-10 w-10 text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Unlock CMMC Level 2</h2>
                    <p className="text-blue-200 text-sm">Comprehensive CUI Readiness</p>
                </div>
            </div>
        </header>

        <div className="p-8 space-y-6">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start space-x-3">
                <Zap className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-blue-800 text-sm leading-relaxed">
                    Level 2 expands your assessment to include <strong>110 required practices</strong> (89 additional controls) covering Incident Response, Risk Assessment, and Audit Management.
                </p>
            </div>

            <div className="space-y-3">
                <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">What you get:</h3>
                <ul className="space-y-3">
                    {[
                        "All 110 NIST SP 800-171 Rev 2 controls",
                        "AI-Powered Level 2 Evidence Miner",
                        "Granular Objective-Level Tracking",
                        "Assessor-Defensible SSP Generation",
                        "Shared Responsibility (SRM) Exports"
                    ].map((feature, i) => (
                        <li key={i} className="flex items-center text-gray-700 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                            {feature}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="pt-4 border-t">
                <p className="text-xs text-gray-500 mb-6 italic text-center">
                    "All Level 1 work carries forward automatically. No rework required."
                </p>
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 border border-gray-300 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        Maybe Later
                    </button>
                    <button 
                        onClick={() => {
                            onUpgrade();
                            onClose();
                        }}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center"
                    >
                        Upgrade Now
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                </div>
                <button className="w-full mt-4 text-xs font-bold text-blue-600 hover:underline uppercase tracking-widest py-2">
                    Contact Compliance Expert
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
