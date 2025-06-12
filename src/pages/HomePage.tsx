import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Download, Monitor, CheckCircle, XCircle, HardDrive, Calendar, RotateCcw, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { exportToCSV } from '../utils/csvExport';

interface Host {
  id: number;
  display_name: string;
  status: string;
  issues: { total_issues_count: number };
  gigs_disk_space_available: number;
  os_version: string;
  osquery_version: string;
  primary_ip: string;
  detail_updated_at: string;
  last_restarted_at: string;
}

interface HostsResponse {
  hosts: Host[];
  count: number;
}

interface HostSummary {
  totals_hosts_count: number;
  online_count: number;
  offline_count: number;
  mia_count: number;
  missing_30_days_count: number;
  new_count: number;
  all_linux_count: number;
}

interface SoftwareDetails {
  id: number;
  name: string;
  version?: string;
}

export const HomePage: React.FC = () => {
  const [allHosts, setAllHosts] = useState<Host[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [offlineCount, setOfflineCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [softwareDetails, setSoftwareDetails] = useState<SoftwareDetails | null>(null);
  
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hostsPerPage = 50;

  const softwareTitleId = searchParams.get('software_title_id');
  const softwareVersionId = searchParams.get('software_version_id');

  useEffect(() => {
    if (token) {
      fetchHostSummary();
      fetchAllHosts();
      if (softwareTitleId || softwareVersionId) {
        fetchSoftwareDetails();
      } else {
        setSoftwareDetails(null);
      }
    } else {
      setError('Authentication required');
      setIsLoading(false);
    }
  }, [token, softwareTitleId, softwareVersionId, currentPage]);

  const fetchHostSummary = async () => {
    try {
      let countResponse;
      if (softwareTitleId) {
        countResponse = await fetch(
          `http://localhost:3001/api/latest/fleet/hosts/count?software_title_id=${softwareTitleId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } else if (softwareVersionId) {
        countResponse = await fetch(
          `http://localhost:3001/api/latest/fleet/hosts/count?software_version_id=${softwareVersionId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } else {
        countResponse = await fetch(
          'http://localhost:3001/api/latest/fleet/host_summary',
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
      }
      
      if (!countResponse.ok) {
        throw new Error(`HTTP ${countResponse.status}: ${countResponse.statusText}`);
      }
      
      const data = await countResponse.json();
      
      if (softwareTitleId || softwareVersionId) {
        setTotalCount(data.count || 0);
        // For filtered views, we don't have online/offline counts
        setOnlineCount(0);
        setOfflineCount(0);
      } else {
        setTotalCount(data.totals_hosts_count);
        setOnlineCount(data.online_count);
        setOfflineCount(data.offline_count);
      }
    } catch (error) {
      console.error('Error fetching host summary:', error);
    }
  };

  const fetchAllHosts = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: hostsPerPage.toString(),
        device_mapping: 'true',
        order_key: 'display_name',
        order_direction: 'asc'
      });

      if (softwareTitleId) {
        params.append('software_title_id', softwareTitleId);
      }
      if (softwareVersionId) {
        params.append('software_version_id', softwareVersionId);
      }

      // First get the total count
      let countResponse;
      if (softwareTitleId) {
        countResponse = await fetch(
          `http://localhost:3001/api/latest/fleet/hosts/count?software_title_id=${softwareTitleId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } else if (softwareVersionId) {
        countResponse = await fetch(
          `http://localhost:3001/api/latest/fleet/hosts/count?software_version_id=${softwareVersionId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      if (countResponse && !countResponse.ok) {
        throw new Error(`HTTP ${countResponse.status}: ${countResponse.statusText}`);
      }

      if (countResponse) {
        const countData = await countResponse.json();
        setTotalCount(countData.count || 0);
      }

      // Then get the paginated hosts
      const response = await fetch(
        `http://localhost:3001/api/latest/fleet/hosts?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const data: HostsResponse = await response.json();
      
      if (!data || !Array.isArray(data.hosts)) {
        throw new Error('Invalid response format: hosts array is missing');
      }

      setAllHosts(data.hosts || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch hosts');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSoftwareDetails = async () => {
    try {
      let response;
      if (softwareVersionId) {
        response = await fetch(
          `http://localhost:3001/api/latest/fleet/software/versions/${softwareVersionId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } else if (softwareTitleId) {
        response = await fetch(
          `http://localhost:3001/api/latest/fleet/software/titles/${softwareTitleId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      if (response && !response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (response) {
        const data = await response.json();
        if (softwareVersionId) {
          setSoftwareDetails({
            id: data.software_version.id,
            name: data.software_version.name,
            version: data.software_version.version
          });
        } else {
          setSoftwareDetails({
            id: data.software_title.id,
            name: data.software_title.name
          });
        }
      }
    } catch (error) {
      console.error('Error fetching software details:', error);
    }
  };

  // Filter hosts based on search term
  const filteredHosts = allHosts.filter(host =>
    host.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        device_mapping: 'true',
        order_key: 'display_name',
        order_direction: 'asc'
      });

      if (softwareTitleId) {
        params.append('software_title_id', softwareTitleId);
      }
      if (softwareVersionId) {
        params.append('software_version_id', softwareVersionId);
      }

      const response = await fetch(
        `http://localhost:3001/api/latest/fleet/hosts?${params.toString()}`,
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
      
      const data: HostsResponse = await response.json();
      
      if (!data || !Array.isArray(data.hosts)) {
        throw new Error('Invalid response format: hosts array is missing');
      }

      const exportData = data.hosts.map(host => ({
        Host: host.display_name,
        Status: host.status,
        Issues: host.issues?.total_issues_count || 0,
        'Disk Space (GB)': host.gigs_disk_space_available || 0,
        OS: host.os_version,
        Osquery: host.osquery_version,
        'Private IP': host.primary_ip,
        'Last Fetched': host.detail_updated_at,
        'Last Restarted': host.last_restarted_at
      }));
      
      exportToCSV(exportData, 'hosts-report');
    } catch (error) {
      console.error('Error exporting hosts:', error);
      setError(error instanceof Error ? error.message : 'Failed to export hosts');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading hosts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Hosts</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchAllHosts}
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
        <h1 className="text-3xl font-bold text-gray-900">Fleet Dashboard</h1>
        <button
          onClick={handleExport}
          disabled={allHosts.length === 0}
          className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Filter Indicator */}
      {softwareDetails && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-500">Filtered by:</span>
              <span className="text-sm font-medium text-gray-900">
                {softwareDetails.name}
                {softwareDetails.version && ` (${softwareDetails.version})`}
              </span>
            </div>
            <button
              onClick={() => navigate('/home')}
              className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
              <span>Clear filter</span>
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Monitor className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                {softwareTitleId || softwareVersionId ? 'Filtered Hosts' : 'Total Hosts'}
              </p>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
            </div>
          </div>
        </div>

        {!softwareTitleId && !softwareVersionId && (
          <>
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Online Hosts</p>
                  <p className="text-2xl font-bold text-gray-900">{onlineCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Offline Hosts</p>
                  <p className="text-2xl font-bold text-gray-900">{offlineCount}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search hosts by name..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(0); // Reset to first page on search
          }}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Hosts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issues</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disk Space</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OS</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Osquery</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Private IP</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Fetched</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Restarted</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredHosts.map((host) => (
                <tr 
                  key={host.id}
                  onClick={() => navigate(`/host/${host.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Monitor className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">{host.display_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      host.status === 'online' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {host.status === 'online' ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                      {host.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {host.issues?.total_issues_count || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <HardDrive className="h-4 w-4 text-gray-400 mr-1" />
                      {host.gigs_disk_space_available || 0} GB
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {host.os_version || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {host.osquery_version || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {host.primary_ip || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                      {formatDate(host.detail_updated_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <RotateCcw className="h-4 w-4 text-gray-400 mr-1" />
                      {formatDate(host.last_restarted_at)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredHosts.length === 0 && (
          <div className="text-center py-12">
            <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {allHosts.length === 0 ? 'No hosts found.' : 'No hosts found matching your search.'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalCount > hostsPerPage && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{currentPage * hostsPerPage + 1}</span> to{' '}
                <span className="font-medium">{Math.min((currentPage + 1) * hostsPerPage, totalCount)}</span> of{' '}
                <span className="font-medium">{totalCount}</span> results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 0}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={(currentPage + 1) * hostsPerPage >= totalCount}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};