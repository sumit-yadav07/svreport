import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Package, Shield, AlertTriangle, Users, AlertCircle, X, Edit3 } from 'lucide-react';
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

interface VendorInfo {
  [softwareId: number]: string;
}

export const OpenSourceSoftwarePage: React.FC = () => {
  const [openSourceList, setOpenSourceList] = useState<OpenSourceSoftware[]>([]);
  const [softwareDetails, setSoftwareDetails] = useState<Map<number, SoftwareTitle>>(new Map());
  const [vendorInfo, setVendorInfo] = useState<VendorInfo>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<{ [key: number]: string }>({});
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [currentRemarkSoftwareId, setCurrentRemarkSoftwareId] = useState<number | null>(null);
  const [currentRemarkText, setCurrentRemarkText] = useState<string>('');
  const [isUpdatingRemark, setIsUpdatingRemark] = useState(false);
  
  const { token, user } = useAuth();
  const navigate = useNavigate();

  // Cache for vendor information
  const vendorCache = new Map<number, string>();

  const fetchVendorInfo = async (versionId: number, softwareId: number) => {
    // Return cached value if available
    if (vendorCache.has(softwareId)) {
      return vendorCache.get(softwareId);
    }

    // If we already have the vendor info in state, use that
    if (vendorInfo[softwareId]) {
      vendorCache.set(softwareId, vendorInfo[softwareId]);
      return vendorInfo[softwareId];
    }

    try {
      const response = await fetch(
        `/api/latest/fleet/software/${versionId}`,
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
      
      const data = await response.json();
      const vendor = data.software?.vendor || 'Unknown';
      
      // Update cache and state
      vendorCache.set(softwareId, vendor);
      setVendorInfo(prev => ({
        ...prev,
        [softwareId]: vendor
      }));
      
      return vendor;
    } catch (error) {
      console.error('Error fetching vendor info:', error);
      return 'Unknown';
    }
  };

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
      const vendorPromises: Promise<void>[] = [];
      const processedSoftwareIds = new Set<number>();

      for (const software of data) {
        // Skip if we've already processed this software
        if (processedSoftwareIds.has(software.software_title_id)) {
          continue;
        }
        processedSoftwareIds.add(software.software_title_id);

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
            const softwareTitle = detailData.software_title;
            detailsMap.set(software.software_title_id, softwareTitle);

            // If we have versions and haven't fetched vendor info yet, fetch it
            if (softwareTitle.versions && 
                softwareTitle.versions.length > 0 && 
                !vendorCache.has(software.software_title_id) && 
                !vendorInfo[software.software_title_id]) {
              const versionId = softwareTitle.versions[0].id;
              vendorPromises.push(
                fetchVendorInfo(versionId, software.software_title_id)
                  .then(vendor => {
                    if (vendor) {
                      setVendorInfo(prev => ({
                        ...prev,
                        [software.software_title_id]: vendor
                      }));
                    }
                  })
              );
            }
          }
        } catch (error) {
          console.error(`Error fetching details for software ${software.software_title_id}:`, error);
        }
      }

      setSoftwareDetails(detailsMap);
      await Promise.all(vendorPromises);
    } catch (error) {
      console.error('Error fetching open source list:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch open source software');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch remarks from your local API
  const fetchRemarks = async () => {
    try {
      const response = await fetch('/api/software-remarks');
      if (response.ok) {
        const data = await response.json();
        const remarksMap: { [key: number]: string } = {};
        data.forEach((item: any) => {
          remarksMap[item.software_title_id] = item.remark;
        });
        setRemarks(remarksMap);
      }
    } catch (error) {
      console.error('Error fetching remarks:', error);
    }
  };

  useEffect(() => {
    fetchOpenSourceList();
    fetchRemarks();
  }, []);

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

  const handleExport = async () => {
    try {
      // Create a map to store vendor information
      const vendorMap = new Map<number, string>();
      
      // Filter software that has versions
      const softwareWithVersions = filteredSoftware.filter(software => {
        const details = softwareDetails.get(software.software_title_id);
        return details?.versions && details.versions.length > 0;
      });
      
      // Process software in batches of 20
      const batchSize = 20;
      
      for (let i = 0; i < softwareWithVersions.length; i += batchSize) {
        const batch = softwareWithVersions.slice(i, i + batchSize);
        
        // Fetch vendor information for current batch
        const vendorPromises = batch.map(async (software) => {
          try {
            const details = softwareDetails.get(software.software_title_id);
            if (!details?.versions?.length) return;

            const versionId = details.versions[0].id;
            const response = await fetch(
              `/api/latest/fleet/software/${versionId}`,
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
            
            const data = await response.json();
            vendorMap.set(software.software_title_id, data.software?.vendor || 'Unknown');
          } catch (error) {
            console.error(`Error fetching vendor info for software ${software.software_title_id}:`, error);
            vendorMap.set(software.software_title_id, 'Unknown');
          }
        });
        
        // Wait for current batch to complete before moving to next batch
        await Promise.all(vendorPromises);
        
        // Add a small delay between batches to prevent overwhelming the server
        if (i + batchSize < softwareWithVersions.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Create export data with vendor information
      const exportData = filteredSoftware.map(software => {
        const details = softwareDetails.get(software.software_title_id);
        const totalVulnerabilities = details?.versions?.reduce((count, version) => {
          return count + (version.vulnerabilities?.length || 0);
        }, 0) || 0;
        
        return {
          Name: software.name,
          Vendor: vendorMap.get(software.software_title_id) || 'Unknown',
          'Host Count': details?.hosts_count || 0,
          'Version Count': details?.versions_count || 0,
          'Vulnerabilities Count': totalVulnerabilities,
          'Open Source': 'Yes',
          'Remarks': remarks[software.software_title_id] || ''
        };
      });
      
      exportToCSV(exportData, 'open-source-software-report');
    } catch (error) {
      console.error('Error exporting software data:', error);
      // You might want to show an error message to the user here
    }
  };

  const handleRemarkClick = (softwareId: number, currentRemark: string) => {
    setCurrentRemarkSoftwareId(softwareId);
    setCurrentRemarkText(currentRemark || '');
    setShowRemarkModal(true);
  };

  const handleCloseRemarkModal = () => {
    setShowRemarkModal(false);
    setCurrentRemarkSoftwareId(null);
    setCurrentRemarkText('');
  };

  const handleUpdateRemark = async () => {
    if (currentRemarkSoftwareId === null) return;
    
    setIsUpdatingRemark(true);
    try {
      const response = await fetch('/api/software-remarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          software_title_id: currentRemarkSoftwareId,
          remark: currentRemarkText 
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Update the local state with the new remark
      setRemarks(prev => ({
        ...prev,
        [currentRemarkSoftwareId]: currentRemarkText,
      }));

      handleCloseRemarkModal();
    } catch (error) {
      console.error('Error updating remark:', error);
      setError(error instanceof Error ? error.message : 'Failed to update remark');
    } finally {
      setIsUpdatingRemark(false);
    }
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vulnerabilities</th>
                {canManageOpenSource && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
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
                        className="flex items-center text-left hover:text-blue-600 transition-colors duration-200 w-full"
                      >
                        <div className="flex items-center flex-shrink-0">
                          <Shield className="h-4 w-4 text-emerald-500 mr-2" />
                          <Package className="h-4 w-4 text-gray-400 mr-2" />
                        </div>
                        <div className="max-w-[150px] truncate" title={software.name}>
                          <span className="text-sm font-medium text-gray-900">{software.name}</span>
                        </div>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="max-w-[120px] truncate" title={vendorInfo[software.software_title_id] || 'Loading...'}>
                        <span className="text-sm text-gray-900">{vendorInfo[software.software_title_id] || 'Loading...'}</span>
                      </div>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleRemarkClick(software.software_title_id, remarks[software.software_title_id] || '')}
                        className="flex items-center text-left hover:text-blue-600 transition-colors duration-200 w-full max-w-[150px]"
                        title={remarks[software.software_title_id] || 'Click to add remark'}
                      >
                        <Edit3 className="h-3 w-3 text-gray-400 mr-1 flex-shrink-0" />
                        <div className="truncate">
                          <span className="text-sm text-gray-900">
                            {remarks[software.software_title_id] || 'Add remark...'}
                          </span>
                        </div>
                      </button>
                    </td>
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

      {/* Remark Modal */}
      {showRemarkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Remark</h3>
              <button
                onClick={handleCloseRemarkModal}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4">
              <label htmlFor="remark" className="block text-sm font-medium text-gray-700 mb-2">
                Remark
              </label>
              <textarea
                id="remark"
                rows={4}
                value={currentRemarkText}
                onChange={(e) => setCurrentRemarkText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your remark here..."
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCloseRemarkModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRemark}
                disabled={isUpdatingRemark}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isUpdatingRemark ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};