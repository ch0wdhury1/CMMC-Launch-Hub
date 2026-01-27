import React, { useState, useMemo } from 'react';
import { PoamItem, PoamStatus, PoamPriority, CompanyProfile, Practice, ResponsibilityMatrixEntry } from '../types';
import { generatePoamPdf } from '../services/poamGenerator';
import { Download, PlusCircle, Filter, X, Save, Calendar, User, Tag, ArrowUpCircle, Clock, CheckCircle } from 'lucide-react';

interface PoamProps {
  poamItems: PoamItem[];
  allPractices: Practice[];
  companyProfile: CompanyProfile | null;
  updatePoamItem: (item: PoamItem) => void;
  addPoamItem: (item: Omit<PoamItem, 'id' | 'createdAt' | 'source'>) => void;
  responsibilityMatrix: ResponsibilityMatrixEntry[];
}

// --- PoamItemModal Sub-component ---
interface PoamItemModalProps {
  item: Omit<PoamItem, 'id' | 'createdAt' | 'source'> | PoamItem;
  allPractices: Practice[];
  onClose: () => void;
  onSave: (item: PoamItem | Omit<PoamItem, 'id' | 'createdAt' | 'source'>) => void;
}

const PoamItemModal: React.FC<PoamItemModalProps> = ({ item, allPractices, onClose, onSave }) => {
  const [formData, setFormData] = useState(item);
  const isNew = !('id' in item);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSave = () => {
    if (!formData.title) {
      alert("Title is required.");
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <header className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">{isNew ? 'Add New POA&M Item' : 'Edit POA&M Item'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
        </header>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} className="w-full border p-2 rounded bg-white text-black" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} className="w-full border p-2 rounded bg-white text-black h-24" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full border p-2 rounded bg-white text-black">
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="deferred">Deferred</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Priority</label>
              <select name="priority" value={formData.priority} onChange={handleChange} className="w-full border p-2 rounded bg-white text-black">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select name="category" value={formData.category} onChange={handleChange} className="w-full border p-2 rounded bg-white text-black">
                    <option value="technical">Technical</option>
                    <option value="policy">Policy</option>
                    <option value="process">Process</option>
                    <option value="physical">Physical</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Related Practices</label>
              <select 
                multiple 
                name="relatedPracticeIds" 
                value={formData.relatedPracticeIds} 
                // FIX: Explicitly typed the `option` parameter to `HTMLOptionElement` to resolve an 'unknown' type error.
                onChange={e => setFormData(prev => ({...prev, relatedPracticeIds: Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value)}))} 
                className="w-full border p-2 rounded bg-white text-black h-24"
              >
                {allPractices.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Owner</label>
              <input type="text" name="owner" value={formData.owner || ''} onChange={handleChange} className="w-full border p-2 rounded bg-white text-black" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Target Date</label>
              <input type="date" name="targetDate" value={formData.targetDate || ''} onChange={handleChange} className="w-full border p-2 rounded bg-white text-black" />
            </div>
          </div>
           <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea name="notes" value={formData.notes || ''} onChange={handleChange} className="w-full border p-2 rounded bg-white text-black h-20" />
          </div>
        </div>
        <footer className="flex justify-end p-4 border-t bg-gray-50">
          <button onClick={handleSave} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" /> Save Item
          </button>
        </footer>
      </div>
    </div>
  );
};

// --- Main POA&M Component ---
export const Poam: React.FC<PoamProps> = ({ poamItems, allPractices, companyProfile, updatePoamItem, addPoamItem, responsibilityMatrix }) => {
  const [statusFilter, setStatusFilter] = useState<PoamStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<PoamPriority | 'all'>('all');
  const [selectedItem, setSelectedItem] = useState<PoamItem | 'new' | null>(null);

  const summary = useMemo(() => {
    const open = poamItems.filter(p => p.status === 'open').length;
    const inProgress = poamItems.filter(p => p.status === 'in_progress').length;
    const completed = poamItems.filter(p => p.status === 'completed').length;
    const highPriorityOpen = poamItems.filter(p => p.priority === 'high' && p.status !== 'completed').length;
    return { open, inProgress, completed, highPriorityOpen };
  }, [poamItems]);

  const filteredItems = useMemo(() => {
    return poamItems
      .filter(item => statusFilter === 'all' || item.status === statusFilter)
      .filter(item => priorityFilter === 'all' || item.priority === priorityFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [poamItems, statusFilter, priorityFilter]);
  
  const handleSaveItem = (item: PoamItem | Omit<PoamItem, 'id' | 'createdAt' | 'source'>) => {
    if ('id' in item) {
      updatePoamItem(item);
    } else {
      addPoamItem(item);
    }
  };
  
  const handleDownloadPdf = async () => {
    await generatePoamPdf({ poamItems, companyProfile, responsibilityMatrix });
  };

  const getStatusChip = (status: PoamStatus) => {
    const styles = {
      open: 'bg-red-100 text-red-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      deferred: 'bg-gray-200 text-gray-800',
    };
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${styles[status]}`}>{status.replace('_', ' ').toUpperCase()}</span>;
  };
  
  // FIX: Wrapped icons in a span with a title attribute to resolve TS prop error.
  const getPriorityIcon = (priority: PoamPriority) => {
    if (priority === 'high') return <span title="High Priority"><ArrowUpCircle className="h-5 w-5 text-red-500"/></span>;
    if (priority === 'medium') return <span title="Medium Priority"><Clock className="h-5 w-5 text-yellow-500"/></span>;
    return <span title="Low Priority"><CheckCircle className="h-5 w-5 text-gray-400"/></span>;
  };
  
  // FIX: Set selectedItem to 'new' to trigger modal for a new item, resolving type errors.
  const handleAddItem = () => {
    setSelectedItem('new');
  };

  return (
    <>
      <div className="space-y-6 animate-fadeIn">
        {/* Header and Actions */}
        <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800">Plan of Action & Milestones</h1>
            <div className="flex items-center space-x-2">
                <button onClick={handleAddItem} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">
                    <PlusCircle className="h-5 w-5 mr-2" /> Add Item
                </button>
                <button onClick={handleDownloadPdf} className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md shadow-sm hover:bg-gray-700">
                    <Download className="h-5 w-5 mr-2" /> Download PDF
                </button>
            </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-md border"><h3 className="text-sm font-semibold text-gray-500">Open Items</h3><p className="text-2xl font-bold">{summary.open}</p></div>
            <div className="bg-white p-4 rounded-lg shadow-md border"><h3 className="text-sm font-semibold text-gray-500">In Progress</h3><p className="text-2xl font-bold">{summary.inProgress}</p></div>
            <div className="bg-white p-4 rounded-lg shadow-md border"><h3 className="text-sm font-semibold text-gray-500">Completed</h3><p className="text-2xl font-bold">{summary.completed}</p></div>
            <div className="bg-white p-4 rounded-lg shadow-md border border-red-200"><h3 className="text-sm font-semibold text-red-600">High Priority Open</h3><p className="text-2xl font-bold text-red-700">{summary.highPriorityOpen}</p></div>
        </div>
        
        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-md border flex items-center space-x-4">
            <Filter className="h-5 w-5 text-gray-500"/>
            <div>
                <label className="text-sm font-medium mr-2">Status:</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as PoamStatus | 'all')} className="border p-1.5 rounded text-sm bg-white text-black">
                    <option value="all">All</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="deferred">Deferred</option>
                </select>
            </div>
             <div>
                <label className="text-sm font-medium mr-2">Priority:</label>
                <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as PoamPriority | 'all')} className="border p-1.5 rounded text-sm bg-white text-black">
                    <option value="all">All</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
            </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-md border overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="p-3"></th>
                <th className="p-3">Title</th>
                <th className="p-3">Practices</th>
                <th className="p-3">Status</th>
                <th className="p-3">Target Date</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map(item => {
                const srmEntry = item.relatedPracticeIds[0] ? responsibilityMatrix.find(e => e.practiceId === item.relatedPracticeIds[0]) : undefined;
                return (
                  <tr key={item.id} onClick={() => setSelectedItem(item)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="p-3">{getPriorityIcon(item.priority)}</td>
                    <td className="p-3 font-medium text-gray-800">
                      {item.title}
                      {srmEntry && (
                          <p className="text-xs text-blue-600 mt-1 italic">
                              SRM: {srmEntry.responsibility}; Provider: {srmEntry.providerName || 'N/A'}; Owner: {srmEntry.internalOwner || 'N/A'}
                          </p>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">{item.relatedPracticeIds.map(id => <span key={id} className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">{id}</span>)}</div>
                    </td>
                    <td className="p-3">{getStatusChip(item.status)}</td>
                    <td className="p-3">{item.targetDate ? new Date(item.targetDate).toLocaleDateString() : 'N/A'}</td>
                    <td className="p-3 text-gray-600">{item.owner || 'N/A'}</td>
                    <td className="p-3 capitalize">{item.source}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredItems.length === 0 && <p className="text-center text-gray-500 py-8">No items match the current filters.</p>}
        </div>
      </div>
      
      {/* FIX: Correctly pass props to PoamItemModal for new and existing items. */}
      {selectedItem && (
        <PoamItemModal 
            item={selectedItem === 'new'
                ? {
                    title: '',
                    description: '',
                    relatedPracticeIds: [],
                    category: 'technical',
                    priority: 'medium',
                    status: 'open',
                }
                : selectedItem
            }
            allPractices={allPractices}
            onClose={() => setSelectedItem(null)}
            onSave={handleSaveItem}
        />
      )}
    </>
  );
};