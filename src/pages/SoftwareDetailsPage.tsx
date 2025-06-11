import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Users, AlertTriangle, ChevronRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SoftwareVersion {
  id: number;
  version: string;
  hosts_count: number;
  vulnerabilities: Array<{ cve: string; cvss_score: number; details_link: string }>;
}

interface SoftwareDetails {
  id: number;
  name: string;
  hosts_count: number;
  versions: SoftwareVersion[];
}

export const SoftwareDetailsPage: React.FC = () => {
  const [software, setSoftware] = useState<SoftwareDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      fetchSoftwareDetails();
    }
  }, [id]);

  const fetchSoftwareDetails = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:3001/api/latest/fleet/software/titles/${id}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSoftware(data.software_title);
    } catch (error) {
      console.error('Error fetching software details:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch software details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTotalHostsClick = () => {
    navigate(`/home?software_title_id=${id}`);
  };

  const handleVersionHostsClick = (versionId: number) => {
    navigate(`/home?software_version_id=${versionId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading software details...</span>
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
            onClick={fetchSoftwareDetails}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!software) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Software not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/software')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{software.name}</h1>
          <p className="text-gray-600">Software package details</p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{software.name}</h2>
              <p className="text-gray-600">Installed across multiple hosts</p>
            </div>
          </div>
          <button
            onClick={handleTotalHostsClick}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Users className="h-4 w-4 mr-2" />
            {software.hosts_count} Total Hosts
            <ChevronRight className="h-4 w-4 ml-2" />
          </button>
        </div>
      </div>

      {/* Versions Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Software Versions</h3>
          <p className="text-sm text-gray-600">All versions of this software and their deployment status</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hosts Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vulnerabilities</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {software.versions?.map((version) => (
                <tr key={version.id} className="hover:bg-gray-50 transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">{version.version}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Users className="h-4 w-4 text-gray-400 mr-1" />
                      {version.hosts_count}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {version.vulnerabilities && version.vulnerabilities.length > 0 ? (
                      <div className="space-y-1">
                        {version.vulnerabilities.map((vuln, index) => (
                          <div key={index} className="flex items-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {vuln.cve}
                            </span>
                            <span className="ml-2 text-xs text-gray-500">
                              CVSS: {vuln.cvss_score}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleVersionHostsClick(version.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors duration-200"
                    >
                      View Hosts
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!software.versions || software.versions.length === 0) && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No version information available</p>
          </div>
        )}
      </div>
    </div>
  );
};