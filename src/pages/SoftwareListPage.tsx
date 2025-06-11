import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Package, Shield, AlertTriangle, Users, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { exportToCSV } from '../utils/csvExport';

interface SoftwareTitle {
  id: number;
  name: string;
  hosts_count: number;
  versions_count: number;
  vulnerabilities: Array<{ cve: string; cvss_score: number }>;
}

interface SoftwareTitlesResponse {
  software_titles: SoftwareTitle[];
  count: number;
}

export const SoftwareListPage: React.FC = () => {
  const [softwareTitles, setSoftwareTitles] = useState<SoftwareTitle[]>([]);
  const [openSourceList, setOpenSourceList] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showVulnerable, setShowVulnerable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { token, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSoftwareTitles();
    fetchOpenSourceList();
  }, [showVulnerable]);

  const fetchSoftwareTitles = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: '0',
        per_page: '20',
        order_direction: 'desc',
        order_key: 'hosts_count'
      });

      if (showVulnerable) {
        params.append('vulnerable', 'true');
      }

      const response = await fetch(
        `http://localhost:3001/api/latest/fleet/software/titles?${params.toString()}`,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: SoftwareTitlesResponse = await response.json();
      setSoftwareTitles(data.software_titles || []);
    } catch (error) {
      console.error('Error fetching software titles:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch software');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOpenSourceList = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/open-source');
      if (response.ok) {
        const data = await response.json();
        const osSet = new Set(data.map((item: any) => item.software_title_id));
        setOpenSourceList(osSet);
      }
    } catch (error) {
      console.error('Error fetching open source list:', error);
    }
  };

  const toggleOpenSource = async (softwareId: number, name: string) => {
    if (!['admin', 'maintainer'].includes(user?.global_role || '')) return;

    try {
      if (openSourceList.has(softwareId)) {
        // Remove from open source
        const response = await fetch(`http://localhost:3001/api/open-source/${softwareId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setOpenSourceList(prev => {
            const newSet = new Set(prev);
            newSet.delete(softwareId);
            return newSet;
          });
        }
      } else {
        // Add to open source
        const response = await fetch('http://localhost:3001/api/open-source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ software_title_id: softwareId, name }),
        });
        if (response.ok) {
          setOpenSourceList(prev => new Set([...prev, softwareId]));
        }
      }
    } catch (error) {
      console.error('Error toggling open source status:', error);
    }
  };

  const filteredSoftware = softwareTitles.filter(software =>
    software.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    const exportData = filteredSoftware.map(software => ({
      Name: software.name,
      'Host Count': software.hosts_count,
      'Version Count': software.versions_count,
      'Vulnerabilities Count': software.vulnerabilities?.length || 0,
      'Open Source': openSourceList.has(software.id) ? 'Yes' : 'No'
    }));
    
    exportToCSV(exportData, 'software-report');
  };

  const canToggleOpenSource = ['admin', 'maintainer'].includes(user?.global_role || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading software...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Software</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchSoftwareTitles}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Software Inventory</h1>
        <button
          onClick={handleExport}
          disabled={filteredSoftware.length === 0}
          className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search software..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <label className="flex items-center space-x-2 bg-white px-4 py-3 border border-gray-300 rounded-lg">
          <input
            type="checkbox"
            checked={showVulnerable}
            onChange={(e) => setShowVulnerable(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="text-sm font-medium text-gray-700">Show vulnerable only</span>
        </label>
      </div>

      {/* Software Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vulnerabilities</th>
                {canToggleOpenSource && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Open Source</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSoftware.map((software) => (
                <tr key={software.id} className="hover:bg-gray-50 transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => navigate(`/software/${software.id}`)}
                      className="flex items-center text-left hover:text-blue-600 transition-colors duration-200"
                    >
                      <Package className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">{software.name}</span>
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Users className="h-4 w-4 text-gray-400 mr-1" />
                      {software.hosts_count}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {software.versions_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {software.vulnerabilities && software.vulnerabilities.length > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {software.vulnerabilities.length}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">None</span>
                    )}
                  </td>
                  {canToggleOpenSource && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleOpenSource(software.id, software.name)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          openSourceList.has(software.id) ? 'bg-emerald-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            openSourceList.has(software.id) ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredSoftware.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {softwareTitles.length === 0 ? 'No software found.' : 'No software found matching your criteria.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};