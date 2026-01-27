
import React, { useState, useMemo } from 'react';
import { ResponsibilityMatrixEntry, Practice, CompanyProfile } from '../types';
import { generateSrmPdf } from '../services/srmGenerator';
import { ShieldCheck, Download, Save } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';

interface ResponsibilityMatrixPageProps {
  responsibilityMatrix: ResponsibilityMatrixEntry[];
  updateResponsibilityMatrixEntry: (id: string, updates: Partial<ResponsibilityMatrixEntry>) => void;
  allPractices: Practice[];
  companyProfile: CompanyProfile | null;
}

const STATIC_OWNERS = ["In-House IT", "Outsourced MSP", "Management", "CFO", "Security Officer"];

const ResponsibilityRow: React.FC<{ 
  entry: ResponsibilityMatrixEntry; 
  onUpdate: (updates: Partial<ResponsibilityMatrixEntry>) => void;
  ownerOptions: string[];
}> = ({ entry, onUpdate, ownerOptions }) => {
    const [customOwner, setCustomOwner] = useState(
        !ownerOptions.includes(entry.internalOwner || '') ? entry.internalOwner || '' : ''
    );
    const [showCustomOwnerInput, setShowCustomOwnerInput] = useState(
        !ownerOptions.includes(entry.internalOwner || '') && !!entry.internalOwner
    );

    const handleOwnerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'Custom...') {
            setShowCustomOwnerInput(true);
            onUpdate({ internalOwner: customOwner });
        } else {
            setShowCustomOwnerInput(false);
            setCustomOwner('');
            onUpdate({ internalOwner: value });
        }
    };

    const handleCustomOwnerBlur = () => {
        onUpdate({ internalOwner: customOwner });
    };
    
    return (
        <tr className="border-b text-sm">
            <td className="p-2 align-top"><p className="font-semibold">{entry.practiceId}</p><p className="text-xs text-gray-600">{entry.practiceName}</p></td>
            <td className="p-2 align-top">
                <div className="flex flex-col space-y-1">
                    {['customer', 'provider', 'shared'].map(type => (
                        <label key={type} className="flex items-center">
                            <input type="radio" name={`resp-${entry.id}`} value={type} checked={entry.responsibility === type} onChange={e => onUpdate({ responsibility: e.target.value as any })} className="mr-2 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"/>
                            <span className="capitalize">{type}</span>
                        </label>
                    ))}
                </div>
            </td>
            <td className="p-2 align-top">
                <input type="text" value={entry.providerName || ''} onChange={e => onUpdate({ providerName: e.target.value })} className="w-full border p-1.5 rounded bg-white text-black" placeholder="e.g., Microsoft 365"/>
            </td>
            <td className="p-2 align-top">
                <select value={showCustomOwnerInput ? 'Custom...' : entry.internalOwner || ''} onChange={handleOwnerChange} className="w-full border p-1.5 rounded bg-white text-black mb-1">
                    <option value="">-- Select Owner --</option>
                    {ownerOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    <option value="Custom...">Custom...</option>
                </select>
                {showCustomOwnerInput && (
                    <input type="text" value={customOwner} onChange={e => setCustomOwner(e.target.value)} onBlur={handleCustomOwnerBlur} placeholder="Enter custom owner" className="w-full border p-1.5 rounded bg-white text-black"/>
                )}
            </td>
            <td className="p-2 align-top"><input type="text" value={entry.notes || ''} onChange={e => onUpdate({ notes: e.target.value })} className="w-full border p-1.5 rounded bg-white text-black"/></td>
        </tr>
    );
};


export const ResponsibilityMatrixPage: React.FC<ResponsibilityMatrixPageProps> = ({
  responsibilityMatrix,
  updateResponsibilityMatrixEntry,
  allPractices,
  companyProfile
}) => {
    const [primaryProvider, setPrimaryProvider] = useState('');
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    const groupedByDomain = useMemo(() => {
        return responsibilityMatrix.reduce((acc, entry) => {
            (acc[entry.domain] = acc[entry.domain] || []).push(entry);
            return acc;
        }, {} as Record<string, ResponsibilityMatrixEntry[]>);
    }, [responsibilityMatrix]);
    
    const ownerOptions = useMemo(() => {
        const userNames = companyProfile?.users.map(u => u.fullName) || [];
        return [...new Set([...STATIC_OWNERS, ...userNames])];
    }, [companyProfile]);

    const handleUpdate = (id: string, updates: Partial<ResponsibilityMatrixEntry>) => {
        const currentEntry = responsibilityMatrix.find(e => e.id === id);
        if ((updates.responsibility === 'provider' || updates.responsibility === 'shared') && primaryProvider && !currentEntry?.providerName) {
            updates.providerName = primaryProvider;
        }
        updateResponsibilityMatrixEntry(id, updates);
        setLastSaved(new Date().toLocaleTimeString());
        setTimeout(() => setLastSaved(null), 2000);
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-lg shadow-md border flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center"><ShieldCheck className="h-7 w-7 mr-3 text-blue-600"/>Shared Responsibility Matrix (SRM)</h1>
                    <p className="mt-2 text-gray-600 max-w-3xl">Assign responsibility for each CMMC practice between your organization (Customer) and your service providers. You can also specify an internal owner for accountability.</p>
                </div>
                <button onClick={() => generateSrmPdf({ matrix: responsibilityMatrix, companyProfile })} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 flex-shrink-0">
                    <Download className="h-5 w-5 mr-2"/> Download SRM PDF
                </button>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-md border">
                <label className="font-semibold text-gray-700 mr-2">Primary Cloud Provider:</label>
                <select value={primaryProvider} onChange={e => setPrimaryProvider(e.target.value)} className="border p-2 rounded bg-white text-black">
                    <option value="">-- Not Set --</option>
                    <option value="Microsoft 365">Microsoft 365</option>
                    <option value="Google Workspace">Google Workspace</option>
                    <option value="AWS">AWS</option>
                    <option value="On-Prem / No Cloud">On-Prem / No Cloud</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Selecting a provider here will auto-fill the 'Provider Name' for new "Provider" or "Shared" entries.</p>
            </div>
            
            <div className="relative">
                {lastSaved && <div className="absolute top-2 right-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center animate-fadeIn z-10"><Save className="h-3 w-3 mr-1"/>Saved at {lastSaved}</div>}
                {/* FIX: Add explicit type cast for Object.entries results to fix map unknown type error */}
                {(Object.entries(groupedByDomain) as [string, ResponsibilityMatrixEntry[]][]).map(([domain, entries]) => (
                    <div key={domain} className="mb-4">
                        <CollapsibleSection title={domain}>
                            <div className="overflow-x-auto border-t">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-left text-xs uppercase">
                                        <tr>
                                            <th className="p-2 w-[25%]">Practice</th>
                                            <th className="p-2 w-[15%]">Responsibility</th>
                                            <th className="p-2 w-[20%]">Provider Name</th>
                                            <th className="p-2 w-[20%]">Internal Owner</th>
                                            <th className="p-2 w-[20%]">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.map(entry => (
                                            <ResponsibilityRow key={entry.id} entry={entry} onUpdate={(updates) => handleUpdate(entry.id, updates)} ownerOptions={ownerOptions} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CollapsibleSection>
                    </div>
                ))}
            </div>
        </div>
    );
};
