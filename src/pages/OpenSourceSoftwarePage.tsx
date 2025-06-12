import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Package, Shield, AlertTriangle, Users, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { exportToCSV } from '../utils/csvExport';

interface OpenSourceSoftware {
  id: number;
  software_title_id: number;
  name: string;
}

interface SoftwareTitle {
  id: number;
  name: string;
  hosts_count?: number;
  versions_count?: number;
  versions?: Array<{
    id: number;
    version: string;
    vulnerabilities: string[] | null;
    hosts_count: number;
  }>;
}

export const OpenSourceSoftwarePage: React.FC = () => {
  const [openSourceList, setOpenSourceList] = useState<OpenSourceSoftware[]>([]);
  const [softwareDetails, setSoftwareDetails] = useState<Map<number, SoftwareTitle>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { token, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOpenSourceList();
  }, []);

  const fetchOpenSourceList = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/open-source');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setOpenSourceList(data);
      
      // Fetch details for each software title
      const detailsMap = new Map();
      for (const software of data) {
        try {
          const detailResponse = await fetch(
            `/api/latest/fleet/software/titles/${software.software_title_id}`,
            { 
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              } 
            }
          );
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            detailsMap.set(software.software_title_id, detailData.software_title);
          }
        } catch (error) {
          console.error(`Error fetching details for software ${software.software_title_id}:`, error);
        }
      }
      setSoftwareDetails(detailsMap);
    } catch (error) {
      console.error('Error fetching open source list:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch open source software');
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromOpenSource = async (softwareId: number) => {
    if (!['admin', 'maintainer'].includes(user?.global_role || '')) return;

    try {
      const response = await fetch(`/api/open-source/${softwareId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setOpenSourceList(prev => prev.filter(item => item.software_title_id !== softwareId));
        setSoftwareDetails(prev => {
          const newMap = new Map(prev);
          newMap.delete(softwareId);
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error removing from open source list:', error);
    }
  };

  const filteredSoftware = openSourceList.filter(software =>
    software.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    const exportData = filteredSoftware.map(software => {
      const details = softwareDetails.get(software.software_title_id);
      const totalVulnerabilities = details?.versions?.reduce((count, version) => {
        return count + (version.vulnerabilities?.length || 0);
      }, 0) || 0;
      
      return {
        Name: software.name,
        'Host Count': details?.hosts_count || 0,
        'Version Count': details?.versions_count || 0,
        'Vulnerabilities Count': totalVulnerabilities,
        'Open Source': 'Yes'
      };
    });
    
    exportToCSV(exportData, 'open-source-software-report');
  };

  const canManageOpenSource = ['admin', 'maintainer'].includes(user?.global_role || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading open source software...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Open Source Software</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchOpenSourceList}
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Open Source Software</h1>
          <p className="text-gray-600">Software marked as open source in your inventory</p>
        </div>
        <button
          onClick={handleExport}
          disabled={filteredSoftware.length === 0}
          className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search open source software..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
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
                {canManageOpenSource && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSoftware.map((software) => {
                const details = softwareDetails.get(software.software_title_id);
                return (
                  <tr key={software.id} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/software/${software.software_title_id}`)}
                        className="flex items-center text-left hover:text-blue-600 transition-colors duration-200"
                      >
                        <div className="flex items-center">
                          <Shield className="h-4 w-4 text-emerald-500 mr-2" />
                          <Package className="h-4 w-4 text-gray-400 mr-2" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{software.name}</span>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Users className="h-4 w-4 text-gray-400 mr-1" />
                        {details?.hosts_count || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {details?.versions_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const totalVulnerabilities = details?.versions?.reduce((count, version) => {
                          return count + (version.vulnerabilities?.length || 0);
                        }, 0) || 0;
                        
                        return totalVulnerabilities > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {totalVulnerabilities}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">None</span>
                        );
                      })()}
                    </td>
                    {canManageOpenSource && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => removeFromOpenSource(software.software_title_id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors duration-200"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredSoftware.length === 0 && (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {openSourceList.length === 0 
                ? 'No software marked as open source yet.' 
                : 'No software found matching your search.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};