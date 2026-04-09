import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { featuresApi } from '@/services/api';

export type FeatureType   = 'stat' | 'chart' | 'list' | 'alert';
export type TargetRole    = 'doctor' | 'patient';

export interface DashboardFeature {
  id:          number;
  title:       string;
  description: string;
  type:        FeatureType;
  targetRole:  TargetRole;
  enabled:     boolean;
  value?:      string;
  unit?:       string;
  isBuiltin?:  boolean;
}

interface FeaturesContextType {
  features:      DashboardFeature[];
  loading:       boolean;
  isEnabled:     (title: string) => boolean;
  addFeature:    (data: Omit<DashboardFeature, 'id'>) => Promise<void>;
  updateFeature: (id: number, data: Partial<DashboardFeature>) => Promise<void>;
  toggleFeature: (id: number) => Promise<void>;
  deleteFeature: (id: number) => Promise<void>;
  refresh:       () => Promise<void>;
}

const FeaturesContext = createContext<FeaturesContextType>({
  features: [], loading: false,
  isEnabled: () => true,
  addFeature: async () => {}, updateFeature: async () => {},
  toggleFeature: async () => {}, deleteFeature: async () => {},
  refresh: async () => {},
});

// Helper to safely cast API response to DashboardFeature
const toFeature = (raw: unknown): DashboardFeature => raw as DashboardFeature;
const toFeatures = (raw: unknown[]): DashboardFeature[] => raw as DashboardFeature[];

export const FeaturesProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [features, setFeatures] = useState<DashboardFeature[]>([]);
  const [loading, setLoading]   = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await featuresApi.list();
      setFeatures(toFeatures(data));
    } catch {
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    } else {
      setFeatures([]);
      setLoading(false);
    }
  }, [isAuthenticated, refresh]);

  const isEnabled = useCallback((title: string): boolean => {
    if (loading) return true;
    const feature = features.find(f => f.title === title);
    if (!feature) return true;
    return feature.enabled;
  }, [features, loading]);

  const addFeature = useCallback(async (data: Omit<DashboardFeature, 'id'>) => {
    const result = await featuresApi.create(data as Record<string, unknown>);
    setFeatures(prev => [...prev, toFeature(result.feature)]);
  }, []);

  const updateFeature = useCallback(async (id: number, data: Partial<DashboardFeature>) => {
    const result = await featuresApi.update(id, data as Record<string, unknown>);
    setFeatures(prev => prev.map(f => f.id === id ? toFeature(result.feature) : f));
  }, []);

  const toggleFeature = useCallback(async (id: number) => {
    const result = await featuresApi.toggle(id);
    setFeatures(prev => prev.map(f => f.id === id ? toFeature(result.feature) : f));
  }, []);

  const deleteFeature = useCallback(async (id: number) => {
    await featuresApi.delete(id);
    setFeatures(prev => prev.filter(f => f.id !== id));
  }, []);

  return (
    <FeaturesContext.Provider value={{
      features, loading, isEnabled,
      addFeature, updateFeature, toggleFeature, deleteFeature, refresh,
    }}>
      {children}
    </FeaturesContext.Provider>
  );
};

export const useFeatures = () => useContext(FeaturesContext);