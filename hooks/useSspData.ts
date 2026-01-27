import { useState, useCallback, useEffect } from 'react';
import { SSP_PROFILE_KEY } from '../constants';

export interface SystemProfile {
  organizationName: string;
  systemName: string;
  contactName: string;
  contactEmail: string;
  systemDescription: string;
  scopeNotes: string;
}

interface SspState {
  systemProfile: SystemProfile;
  activePolicies: string[];
}

const defaultProfile: SystemProfile = {
  organizationName: '',
  systemName: 'CMMC Launch Pad – Level 1 Environment',
  contactName: '',
  contactEmail: '',
  systemDescription: '',
  scopeNotes: 'This system is limited to the storage, processing, and transmission of Federal Contract Information (FCI). No Controlled Unclassified Information (CUI) is handled.',
};

const loadSspState = (): SspState => {
  try {
    const saved = localStorage.getItem(SSP_PROFILE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure default values are present if the saved state is partial
      return {
        systemProfile: { ...defaultProfile, ...parsed.systemProfile },
        activePolicies: parsed.activePolicies || [],
      };
    }
  } catch (error) {
    console.error("Failed to load SSP state:", error);
  }
  return { systemProfile: defaultProfile, activePolicies: [] };
};

const saveSspState = (state: SspState) => {
  try {
    localStorage.setItem(SSP_PROFILE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save SSP state:", error);
  }
};

export const useSspData = () => {
  const [sspState, setSspState] = useState<SspState>(loadSspState);

  const { systemProfile, activePolicies } = sspState;

  useEffect(() => {
    saveSspState(sspState);
  }, [sspState]);

  const updateSystemProfile = useCallback((updates: Partial<SystemProfile>) => {
    setSspState(prev => ({
      ...prev,
      systemProfile: { ...prev.systemProfile, ...updates },
    }));
  }, []);

  const togglePolicy = useCallback((policyName: string) => {
    setSspState(prev => {
      const newActivePolicies = prev.activePolicies.includes(policyName)
        ? prev.activePolicies.filter(p => p !== policyName)
        : [...prev.activePolicies, policyName];
      return { ...prev, activePolicies: newActivePolicies };
    });
  }, []);

  return {
    systemProfile,
    activePolicies,
    updateSystemProfile,
    togglePolicy,
  };
};